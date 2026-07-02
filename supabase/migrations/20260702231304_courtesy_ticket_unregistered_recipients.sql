-- Cortesías a correos sin cuenta PolyFauna: el ticket queda pendiente
-- (user_id NULL, assigned_email = destinatario) hasta que esa persona se
-- registre con el mismo correo, momento en el que handle_new_user() lo
-- reclama automáticamente. validate_ticket bloquea el escaneo mientras
-- el estado sea 'pending_registration'.

CREATE OR REPLACE FUNCTION public.issue_courtesy_ticket(
  p_actor_id UUID,
  p_event_id UUID,
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_event public.events%ROWTYPE;
  v_email TEXT := lower(trim(p_user_email));
  v_user_id UUID;
  v_identity public.user_identity%ROWTYPE;
  v_existing public.user_tickets%ROWTYPE;
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;

  IF v_actor_role <> 'admin'
     AND NOT (v_actor_role IN ('promoter', 'club') AND v_event.owner_id = p_actor_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  -- Ya existe un ticket vigente para este destinatario (registrado o pendiente).
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.user_tickets
    WHERE user_id = v_user_id
      AND event_id = p_event_id
      AND status NOT IN ('cancelled', 'refunded')
    LIMIT 1;
  ELSE
    SELECT * INTO v_existing
    FROM public.user_tickets
    WHERE user_id IS NULL
      AND lower(assigned_email) = v_email
      AND event_id = p_event_id
      AND status = 'pending_registration'
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'pending', v_existing.user_id IS NULL,
      'ticket_id', v_existing.id,
      'ticket_number', v_existing.ticket_number,
      'ticket_type', v_existing.ticket_type,
      'user_id', v_existing.user_id,
      'recipient_email', v_email,
      'event_title', v_event.title,
      'event_date', v_event.date,
      'event_city', COALESCE(v_event.venue, v_event.city)
    );
  END IF;

  IF v_event.courtesy_limit <= 0 THEN RAISE EXCEPTION 'courtesy_not_configured'; END IF;
  IF v_event.courtesies_issued >= v_event.courtesy_limit THEN RAISE EXCEPTION 'courtesy_sold_out'; END IF;
  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RAISE EXCEPTION 'event_sold_out';
  END IF;

  -- Correo sin cuenta PolyFauna: el identity_required solo aplica a
  -- destinatarios ya registrados (ver rama de abajo); un ticket pendiente no
  -- tiene identidad todavía y se completa cuando la persona use su Ticket Vault.
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'identity_required'; END IF;
  END IF;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_tickets (user_id, event_id, ticket_number, ticket_type, status, ticket_index)
    VALUES (v_user_id, p_event_id, v_ticket_number, 'Cortesía', 'valid', 1)
    RETURNING id INTO v_ticket_id;
  ELSE
    INSERT INTO public.user_tickets (user_id, event_id, ticket_number, ticket_type, status, ticket_index, assigned_email)
    VALUES (NULL, p_event_id, v_ticket_number, 'Cortesía', 'pending_registration', 1, v_email)
    RETURNING id INTO v_ticket_id;
  END IF;

  UPDATE public.events
  SET tickets_sold = COALESCE(tickets_sold, 0) + 1,
      courtesies_issued = courtesies_issued + 1
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_table, target_id, target_user_id, metadata
  )
  VALUES (
    p_actor_id,
    'ticket.courtesy',
    'user_tickets',
    v_ticket_id,
    v_user_id,
    jsonb_build_object('event_id', p_event_id, 'recipient_email', v_email, 'pending', v_user_id IS NULL)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'pending', v_user_id IS NULL,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', 'Cortesía',
    'user_id', v_user_id,
    'recipient_email', v_email,
    'event_title', v_event.title,
    'event_date', v_event.date,
    'event_city', COALESCE(v_event.venue, v_event.city)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_courtesy_ticket(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_courtesy_ticket(UUID, UUID, TEXT)
  TO service_role;

-- ─── Escaneo en puerta: mensaje explícito para cortesías aún no activadas ──
CREATE OR REPLACE FUNCTION public.validate_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_is_admin BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado', 'code', 'UNAUTHENTICATED');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
  SELECT * INTO v_ticket FROM public.user_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado', 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT v_is_admin AND (v_event.owner_id IS NULL OR v_event.owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin autorización para este evento', 'code', 'UNAUTHORIZED');
  END IF;
  IF v_ticket.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'error', 'Ticket ya utilizado',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  IF v_ticket.status = 'pending_registration' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PENDING_REGISTRATION',
      'error', 'Cortesía pendiente: el destinatario (' || COALESCE(v_ticket.assigned_email, 'sin correo') || ') debe crear su cuenta en Polyfauna con ese correo antes de poder validar este QR',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
      'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'),
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  UPDATE public.user_tickets SET status = 'used' WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true, 'code', 'VALID', 'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'event_date', v_event.date::text, 'event_venue', v_event.venue);
END;
$$;

-- ─── Asistentes: el correo de invitación queda visible mientras el ticket
-- esté pendiente de registro (no hay auth.users ni profile todavía) ──
CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id UUID)
RETURNS TABLE (
  ticket_id UUID, ticket_number TEXT, ticket_type TEXT, ticket_status TEXT,
  ticket_created TIMESTAMPTZ, user_id UUID, display_name TEXT, phone TEXT,
  email TEXT, wompi_reference TEXT, amount_total NUMERIC,
  full_name TEXT, document_type TEXT, document_number TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events AS event WHERE event.id = p_event_id AND (
      event.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles AS profile WHERE profile.id = auth.uid() AND profile.role = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.event_co_promoters
        WHERE event_id = event.id AND promoter_id = auth.uid() AND status = 'active'
      )
    )
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT ticket.id, ticket.ticket_number, ticket.ticket_type, ticket.status, ticket.created_at, ticket.user_id,
    profile.display_name, profile.phone, COALESCE(users.email, ticket.assigned_email), transaction.wompi_reference, transaction.amount_total,
    identity.full_name, identity.document_type, identity.document_number
  FROM public.user_tickets AS ticket
  LEFT JOIN public.profiles AS profile ON profile.id = ticket.user_id
  LEFT JOIN public.user_identity AS identity ON identity.user_id = ticket.user_id
  LEFT JOIN auth.users AS users ON users.id = ticket.user_id
  LEFT JOIN public.transactions AS transaction ON transaction.id = ticket.transaction_id
  WHERE ticket.event_id = p_event_id
  ORDER BY ticket.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_attendees(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO authenticated;

-- ─── Registro: reclama automáticamente las cortesías pendientes del correo ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'citizen');
  organizer_kind TEXT := NEW.raw_user_meta_data->>'organizer_type';
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role, organizer_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'citizen',
    CASE
      WHEN requested_role = 'promoter' AND organizer_kind IN ('promoter', 'collective') THEN organizer_kind
      WHEN requested_role = 'club' THEN 'club'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  IF requested_role IN ('artist', 'promoter', 'club', 'sello') THEN
    INSERT INTO public.role_requests (user_id, requested_role, status, form_data)
    VALUES (
      NEW.id,
      requested_role,
      'pending',
      jsonb_build_object(
        'name', COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'email', NEW.email,
        'organizer_type', organizer_kind
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Cortesías enviadas antes de que este correo tuviera cuenta: se activan solas.
  UPDATE public.user_tickets
  SET user_id = NEW.id,
      status = 'valid',
      assigned_email = NULL
  WHERE status = 'pending_registration'
    AND lower(assigned_email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
