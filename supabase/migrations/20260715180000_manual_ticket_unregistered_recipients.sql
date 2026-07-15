-- Las ventas manuales pueden emitirse a correos que aun no tienen cuenta.
-- El ticket queda pendiente y se activa automaticamente cuando el destinatario
-- se registra con el mismo correo (handle_new_user ya reclama todos los tickets
-- con status pending_registration). La referencia visible de venta se separa
-- de la llave tecnica/idempotente de la transaccion.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS sale_reference TEXT;

DROP FUNCTION IF EXISTS public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.issue_manual_transfer_ticket(
  p_actor_id UUID,
  p_event_id UUID,
  p_user_email TEXT,
  p_ticket_type TEXT,
  p_payment_reference TEXT,
  p_issuance_key TEXT
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
  v_tier JSONB;
  v_tier_name TEXT;
  v_tier_price BIGINT;
  v_tier_capacity INTEGER;
  v_tier_sold INTEGER;
  v_reference TEXT;
  v_sale_reference TEXT := left(trim(p_payment_reference), 160);
  v_existing_transaction public.transactions%ROWTYPE;
  v_existing_ticket public.user_tickets%ROWTYPE;
  v_transaction_id UUID;
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;

  IF v_actor_role <> 'admin'
     AND v_event.owner_id <> p_actor_id
     AND NOT EXISTS (
       SELECT 1 FROM public.event_co_promoters
       WHERE event_id = p_event_id
         AND promoter_id = p_actor_id
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid_recipient_email';
  END IF;
  IF v_sale_reference = '' THEN RAISE EXCEPTION 'payment_reference_required'; END IF;

  v_reference := 'MANUAL-' || upper(left(regexp_replace(trim(p_issuance_key), '[^A-Za-z0-9_-]+', '', 'g'), 80));
  IF v_reference = 'MANUAL-' THEN RAISE EXCEPTION 'issuance_key_required'; END IF;

  SELECT * INTO v_existing_transaction
  FROM public.transactions
  WHERE wompi_reference = v_reference;

  IF FOUND THEN
    IF v_existing_transaction.event_id <> p_event_id
       OR v_existing_transaction.promoter_id <> p_actor_id THEN
      RAISE EXCEPTION 'issuance_key_already_used';
    END IF;

    SELECT * INTO v_existing_ticket
    FROM public.user_tickets
    WHERE transaction_id = v_existing_transaction.id
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'manual_ticket_incomplete'; END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'pending', v_existing_ticket.user_id IS NULL,
      'ticket_id', v_existing_ticket.id,
      'ticket_number', v_existing_ticket.ticket_number,
      'ticket_type', v_existing_ticket.ticket_type,
      'user_id', v_existing_ticket.user_id,
      'recipient_email', COALESCE(v_existing_ticket.assigned_email, v_email),
      'sale_reference', v_existing_transaction.sale_reference,
      'event_title', v_event.title,
      'event_date', v_event.date,
      'event_city', COALESCE(v_event.venue, v_event.city)
    );
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  SELECT value INTO v_tier
  FROM jsonb_array_elements(v_event.ticket_types) AS value
  WHERE lower(value->>'name') = lower(trim(p_ticket_type))
    AND COALESCE(value->>'active', 'true') <> 'false'
  LIMIT 1;
  IF v_tier IS NULL THEN RAISE EXCEPTION 'invalid_ticket_type'; END IF;

  v_tier_name := v_tier->>'name';
  v_tier_price := GREATEST(COALESCE((v_tier->>'price')::BIGINT, 0), 0);
  v_tier_capacity := GREATEST(COALESCE((v_tier->>'capacity')::INTEGER, 0), 0);

  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RAISE EXCEPTION 'event_sold_out';
  END IF;

  SELECT count(*)::INTEGER INTO v_tier_sold
  FROM public.user_tickets
  WHERE event_id = p_event_id
    AND lower(ticket_type) = lower(v_tier_name)
    AND status NOT IN ('cancelled', 'refunded');
  IF v_tier_sold >= v_tier_capacity THEN RAISE EXCEPTION 'ticket_type_sold_out'; END IF;

  INSERT INTO public.transactions (
    event_id, buyer_id, promoter_id, amount_total, platform_fee,
    promoter_amount, payment_method, wompi_reference, sale_reference,
    status, quantity, assigned_emails, ticket_type, paid_at
  ) VALUES (
    p_event_id, v_user_id, p_actor_id, v_tier_price, 0,
    v_tier_price, 'manual_sale', v_reference, v_sale_reference,
    'approved', 1, jsonb_build_array(v_email), v_tier_name, NOW()
  )
  RETURNING id INTO v_transaction_id;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO public.user_tickets (
    user_id, event_id, ticket_number, ticket_type, status,
    ticket_index, transaction_id, assigned_email
  ) VALUES (
    v_user_id, p_event_id, v_ticket_number, v_tier_name,
    CASE WHEN v_user_id IS NULL THEN 'pending_registration' ELSE 'valid' END,
    1, v_transaction_id, CASE WHEN v_user_id IS NULL THEN v_email ELSE NULL END
  )
  RETURNING id INTO v_ticket_id;

  UPDATE public.transactions SET ticket_id = v_ticket_id WHERE id = v_transaction_id;
  UPDATE public.events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, target_table, target_id, target_user_id, metadata
  ) VALUES (
    p_actor_id,
    'ticket.manual_sale',
    'user_tickets',
    v_ticket_id,
    v_user_id,
    jsonb_build_object(
      'event_id', p_event_id,
      'ticket_type', v_tier_name,
      'recipient_email', v_email,
      'pending', v_user_id IS NULL,
      'sale_reference', v_sale_reference,
      'transaction_reference', v_reference
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'pending', v_user_id IS NULL,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', v_tier_name,
    'user_id', v_user_id,
    'recipient_email', v_email,
    'sale_reference', v_sale_reference,
    'event_title', v_event.title,
    'event_date', v_event.date,
    'event_city', COALESCE(v_event.venue, v_event.city)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Conserva la referencia tecnica Wompi y expone aparte la descripcion libre
-- escrita por el vendedor.
DROP FUNCTION IF EXISTS public.get_event_attendees(UUID);
CREATE FUNCTION public.get_event_attendees(p_event_id UUID)
RETURNS TABLE (
  ticket_id UUID, ticket_number TEXT, ticket_type TEXT, ticket_status TEXT,
  ticket_created TIMESTAMPTZ, user_id UUID, display_name TEXT, phone TEXT,
  email TEXT, wompi_reference TEXT, sale_reference TEXT, amount_total NUMERIC,
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
    profile.display_name, profile.phone, COALESCE(users.email::TEXT, ticket.assigned_email),
    transaction.wompi_reference, transaction.sale_reference, transaction.amount_total::NUMERIC,
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

-- Al crear la cuenta se reclama el ticket y tambien se enlaza la transaccion
-- manual con el nuevo usuario para mantener consistente el historial de venta.
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

  UPDATE public.user_tickets
  SET user_id = NEW.id,
      status = 'valid',
      assigned_email = NULL
  WHERE status = 'pending_registration'
    AND lower(assigned_email) = lower(NEW.email);

  UPDATE public.transactions AS transaction
  SET buyer_id = NEW.id
  WHERE transaction.buyer_id IS NULL
    AND transaction.assigned_emails @> jsonb_build_array(lower(NEW.email))
    AND EXISTS (
      SELECT 1 FROM public.user_tickets AS ticket
      WHERE ticket.transaction_id = transaction.id
        AND ticket.user_id = NEW.id
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Los tickets de venta manual tienen las mismas operaciones de anulacion y
-- transferencia que los antiguos tickets marcados como bank_transfer.
CREATE OR REPLACE FUNCTION public.void_ticket(
  p_actor_id UUID,
  p_ticket_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_new_voided INTEGER;
BEGIN
  SELECT * INTO v_ticket FROM public.user_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF NOT public.is_authorized_for_event(p_actor_id, v_event.id) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  IF v_ticket.transaction_id IS NOT NULL THEN
    SELECT * INTO v_transaction FROM public.transactions WHERE id = v_ticket.transaction_id;
    IF v_transaction.payment_method NOT IN ('bank_transfer', 'manual_sale') THEN
      RAISE EXCEPTION 'not_voidable_use_refund';
    END IF;
  END IF;
  IF v_ticket.status = 'used' THEN RAISE EXCEPTION 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'already_cancelled'; END IF;

  UPDATE public.user_tickets SET status = 'cancelled' WHERE id = p_ticket_id;
  UPDATE public.events
  SET tickets_sold = GREATEST(COALESCE(tickets_sold, 0) - 1, 0),
      courtesies_issued = CASE WHEN v_ticket.ticket_type = 'Cortesía'
        THEN GREATEST(COALESCE(courtesies_issued, 0) - 1, 0) ELSE courtesies_issued END,
      tickets_voided = COALESCE(tickets_voided, 0) + 1
  WHERE id = v_event.id
  RETURNING tickets_voided INTO v_new_voided;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, target_user_id, metadata)
  VALUES (p_actor_id, 'ticket.voided', 'user_tickets', p_ticket_id, v_ticket.user_id,
    jsonb_build_object('event_id', v_event.id, 'ticket_type', v_ticket.ticket_type,
      'ticket_number', v_ticket.ticket_number, 'reason', p_reason, 'tickets_voided_total', v_new_voided));

  RETURN jsonb_build_object('success', true, 'ticket_id', p_ticket_id,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'tickets_voided_total', v_new_voided);
END;
$$;

REVOKE ALL ON FUNCTION public.void_ticket(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_ticket(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_ticket(
  p_actor_id UUID,
  p_ticket_id UUID,
  p_new_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_email TEXT := lower(trim(p_new_email));
  v_new_user_id UUID;
BEGIN
  SELECT * INTO v_ticket FROM public.user_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF NOT public.is_authorized_for_event(p_actor_id, v_event.id) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  IF v_ticket.transaction_id IS NOT NULL THEN
    SELECT * INTO v_transaction FROM public.transactions WHERE id = v_ticket.transaction_id;
    IF v_transaction.payment_method NOT IN ('bank_transfer', 'manual_sale') THEN
      RAISE EXCEPTION 'not_transferable_use_refund';
    END IF;
  END IF;
  IF v_ticket.status = 'used' THEN RAISE EXCEPTION 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'already_cancelled'; END IF;

  SELECT id INTO v_new_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  UPDATE public.user_tickets
  SET user_id = v_new_user_id,
      assigned_email = CASE WHEN v_new_user_id IS NULL THEN v_email ELSE NULL END,
      status = CASE WHEN v_new_user_id IS NULL THEN 'pending_registration' ELSE 'valid' END,
      confirmation_email_sent_at = NULL
  WHERE id = p_ticket_id;

  UPDATE public.transactions
  SET buyer_id = v_new_user_id,
      assigned_emails = jsonb_build_array(v_email)
  WHERE id = v_ticket.transaction_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, target_user_id, metadata)
  VALUES (p_actor_id, 'ticket.transferred', 'user_tickets', p_ticket_id, v_new_user_id,
    jsonb_build_object('event_id', v_event.id, 'ticket_number', v_ticket.ticket_number,
      'previous_user_id', v_ticket.user_id, 'previous_assigned_email', v_ticket.assigned_email,
      'new_recipient_email', v_email));

  RETURN jsonb_build_object(
    'success', true, 'pending', v_new_user_id IS NULL, 'ticket_id', p_ticket_id,
    'ticket_number', v_ticket.ticket_number, 'ticket_type', v_ticket.ticket_type,
    'user_id', v_new_user_id, 'recipient_email', v_email, 'event_id', v_event.id,
    'event_title', v_event.title, 'event_date', v_event.date,
    'event_city', COALESCE(v_event.venue, v_event.city)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_ticket(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ticket(UUID, UUID, TEXT) TO service_role;

-- Mensaje generico: pending_registration ahora tambien representa ventas
-- manuales, no solo cortesias. Se preservan las reglas de horario Early.
CREATE OR REPLACE FUNCTION public.validate_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_identity public.user_identity%ROWTYPE;
  v_tier JSONB;
  v_entry_cutoff_at TIMESTAMPTZ;
  v_late_entry_fee NUMERIC := 0;
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
  IF v_ticket.user_id IS NOT NULL THEN
    SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_ticket.user_id;
  END IF;
  IF v_ticket.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'error', 'Ticket ya utilizado',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
  END IF;
  IF v_ticket.status = 'pending_registration' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PENDING_REGISTRATION',
      'error', 'Ticket pendiente de activación: el destinatario (' || COALESCE(v_ticket.assigned_email, 'sin correo') || ') debe crear su cuenta en Polyfauna con ese correo antes de poder validar este QR',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
      'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'),
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
  END IF;

  IF lower(v_ticket.ticket_type) = 'early' THEN
    SELECT value INTO v_tier FROM jsonb_array_elements(v_event.ticket_types) AS value
    WHERE lower(value->>'name') = lower(v_ticket.ticket_type) LIMIT 1;
    BEGIN
      v_entry_cutoff_at := NULLIF(v_tier->>'entry_cutoff_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN invalid_datetime_format THEN v_entry_cutoff_at := NULL;
    END;
    IF COALESCE(v_tier->>'late_entry_fee', '') ~ '^[0-9]+([.][0-9]+)?$' THEN
      v_late_entry_fee := (v_tier->>'late_entry_fee')::NUMERIC;
    END IF;
    IF v_entry_cutoff_at IS NOT NULL AND NOW() > v_entry_cutoff_at THEN
      RETURN jsonb_build_object(
        'success', false, 'code', 'EARLY_ENTRY_WINDOW_EXPIRED',
        'error', 'Ticket Early fuera de su horario de ingreso. Debe pagar el recargo indicado antes de ingresar.',
        'ticket_id', v_ticket.id, 'event_id', v_event.id, 'ticket_type', v_ticket.ticket_type,
        'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
        'entry_cutoff_at', v_entry_cutoff_at, 'late_entry_fee', v_late_entry_fee,
        'full_name', v_identity.full_name, 'document_type', v_identity.document_type,
        'document_number', v_identity.document_number
      );
    END IF;
  END IF;

  UPDATE public.user_tickets SET status = 'used' WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true, 'code', 'VALID', 'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'event_date', v_event.date::text, 'event_venue', v_event.venue,
    'full_name', v_identity.full_name, 'document_type', v_identity.document_type,
    'document_number', v_identity.document_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
