-- Community events, organizer identity, private attendee identity and courtesy issuance.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organizer_type TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_organizer_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_organizer_type_check
  CHECK (organizer_type IS NULL OR organizer_type IN ('promoter', 'collective', 'club'));

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'role_change_requires_admin';
  END IF;
  IF NEW.organizer_type IS DISTINCT FROM OLD.organizer_type
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
     )
     AND NOT (
       auth.uid() = OLD.id
       AND OLD.role = 'citizen'
       AND OLD.organizer_type IS NULL
       AND NEW.organizer_type IN ('promoter', 'collective', 'club')
     ) THEN
    RAISE EXCEPTION 'organizer_type_change_requires_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_access_fields ON public.profiles;
CREATE TRIGGER profiles_protect_access_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_access_fields();

REVOKE ALL ON FUNCTION public.protect_profile_access_fields() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.user_identity (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 3 AND 160),
  document_type    TEXT NOT NULL DEFAULT 'CC' CHECK (document_type IN ('CC', 'CE', 'TI', 'PP', 'PEP', 'NIT')),
  document_number  TEXT NOT NULL CHECK (char_length(trim(document_number)) BETWEEN 4 AND 32),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type, document_number)
);

ALTER TABLE public.user_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_identity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_identity TO authenticated;
GRANT ALL ON public.user_identity TO service_role;

DROP POLICY IF EXISTS "user_identity_owner_access" ON public.user_identity;
CREATE POLICY "user_identity_owner_access" ON public.user_identity
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP TRIGGER IF EXISTS user_identity_updated_at ON public.user_identity;
CREATE TRIGGER user_identity_updated_at
  BEFORE UPDATE ON public.user_identity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS courtesy_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS courtesies_issued INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_end_after_start_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_end_after_start_check
  CHECK (ends_at IS NULL OR date IS NULL OR ends_at > date);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_courtesy_counts_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_courtesy_counts_check
  CHECK (
    courtesy_limit >= 0
    AND courtesies_issued >= 0
    AND courtesies_issued <= courtesy_limit
  );

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

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

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
  WHERE lower(email) = lower(trim(p_user_email))
  LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'identity_required'; END IF;

  SELECT * INTO v_existing
  FROM public.user_tickets
  WHERE user_id = v_user_id
    AND event_id = p_event_id
    AND status NOT IN ('cancelled', 'refunded')
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'ticket_id', v_existing.id,
      'ticket_number', v_existing.ticket_number,
      'ticket_type', v_existing.ticket_type,
      'user_id', v_user_id,
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

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO public.user_tickets (user_id, event_id, ticket_number, ticket_type, status, ticket_index)
  VALUES (v_user_id, p_event_id, v_ticket_number, 'Cortesía', 'valid', 1)
  RETURNING id INTO v_ticket_id;

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
    jsonb_build_object('event_id', p_event_id, 'recipient_email', lower(trim(p_user_email)))
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', 'Cortesía',
    'user_id', v_user_id,
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

CREATE OR REPLACE FUNCTION public.purchase_ticket(
  p_event_id UUID,
  p_ticket_type TEXT DEFAULT 'General'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_ticket_id UUID;
  v_ticket_number TEXT;
  v_existing UUID;
  v_type_name TEXT;
  v_tier JSONB;
  v_tier_price NUMERIC;
  v_tier_capacity INTEGER;
  v_tier_sold INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid()
      AND trim(full_name) <> ''
      AND trim(document_number) <> ''
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Completa tu nombre y documento en el Control Center antes de adquirir tickets',
      'code', 'IDENTITY_REQUIRED'
    );
  END IF;

  SELECT id INTO v_existing
  FROM public.user_tickets
  WHERE user_id = auth.uid() AND event_id = p_event_id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya tienes una entrada para este evento', 'code', 'DUPLICATE');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento no encontrado', 'code', 'NOT_FOUND');
  END IF;
  IF v_event.status NOT IN ('published', 'upcoming', 'live') THEN
    RETURN jsonb_build_object('success', false, 'error', 'El evento no está disponible', 'code', 'UNAVAILABLE');
  END IF;

  v_type_name := left(trim(COALESCE(p_ticket_type, 'General')), 60);
  IF lower(v_type_name) IN ('ga', 'general admission') THEN v_type_name := 'General'; END IF;
  IF lower(v_type_name) IN ('cortesía', 'cortesia') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Las cortesías solo pueden ser emitidas por el organizador', 'code', 'FORBIDDEN');
  END IF;

  SELECT value INTO v_tier
  FROM jsonb_array_elements(v_event.ticket_types) AS value
  WHERE lower(value->>'name') = lower(v_type_name)
  LIMIT 1;
  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de entrada no disponible', 'code', 'INVALID_TIER');
  END IF;

  v_type_name := v_tier->>'name';
  v_tier_price := COALESCE((v_tier->>'price')::NUMERIC, 0);
  v_tier_capacity := GREATEST(COALESCE((v_tier->>'capacity')::INTEGER, 0), 0);
  IF v_tier_price > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta entrada requiere pago', 'code', 'PAYMENT_REQUIRED');
  END IF;

  SELECT count(*)::INTEGER INTO v_tier_sold
  FROM public.user_tickets
  WHERE event_id = p_event_id AND lower(ticket_type) = lower(v_type_name);
  IF v_tier_sold >= v_tier_capacity
     OR COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entradas agotadas', 'code', 'SOLD_OUT');
  END IF;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO public.user_tickets (user_id, event_id, ticket_number, ticket_type, status)
  VALUES (auth.uid(), p_event_id, v_ticket_number, v_type_name, 'valid')
  RETURNING id INTO v_ticket_id;

  UPDATE public.events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', v_type_name,
    'event_title', v_event.title
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_identity public.user_identity%ROWTYPE;
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
  SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_ticket.user_id;
  IF v_ticket.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'error', 'Ticket ya utilizado',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type,
      'document_number', v_identity.document_number);
  END IF;
  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
      'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'),
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  UPDATE public.user_tickets SET status = 'used' WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true, 'code', 'VALID', 'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'event_date', v_event.date::text, 'event_venue', v_event.venue,
    'full_name', v_identity.full_name, 'document_type', v_identity.document_type,
    'document_number', v_identity.document_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_ticket_for_event(p_ticket_id UUID, p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ticket_event UUID;
BEGIN
  SELECT event_id INTO v_ticket_event FROM public.user_tickets WHERE id = p_ticket_id;
  IF v_ticket_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado', 'code', 'NOT_FOUND');
  END IF;
  IF v_ticket_event <> p_event_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'El ticket pertenece a otro evento', 'code', 'WRONG_EVENT');
  END IF;
  RETURN public.validate_ticket(p_ticket_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_ticket(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_ticket_for_event(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ticket_for_event(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_event_offline_pack(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_allowed BOOLEAN;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado'; END IF;

  SELECT (
    v_event.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  ) INTO v_allowed;
  IF auth.uid() IS NULL OR NOT v_allowed THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN jsonb_build_object(
    'eventId', v_event.id,
    'eventTitle', v_event.title,
    'eventDate', v_event.date,
    'generatedAt', NOW(),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tickets.id,
        'number', tickets.ticket_number,
        'type', tickets.ticket_type,
        'status', tickets.status,
        'full_name', identity.full_name,
        'document_type', identity.document_type,
        'document_number', identity.document_number
      ) ORDER BY tickets.created_at)
      FROM public.user_tickets AS tickets
      LEFT JOIN public.user_identity AS identity ON identity.user_id = tickets.user_id
      WHERE tickets.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.get_event_attendees(UUID);
CREATE FUNCTION public.get_event_attendees(p_event_id UUID)
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
      event.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles AS profile WHERE profile.id = auth.uid() AND profile.role = 'admin'
      )
    )
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT ticket.id, ticket.ticket_number, ticket.ticket_type, ticket.status, ticket.created_at, ticket.user_id,
    profile.display_name, profile.phone, users.email, transaction.wompi_reference, transaction.amount_total,
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

REVOKE ALL ON FUNCTION public.get_event_offline_pack(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_attendees(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_offline_pack(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
