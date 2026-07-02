-- Restore professional role requests and add first-class ticket tiers.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'citizen');
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'citizen'
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
        'email', NEW.email
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.role_requests
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

INSERT INTO public.role_requests (user_id, requested_role, status, form_data)
SELECT
  users.id,
  users.raw_user_meta_data->>'requested_role',
  'pending',
  jsonb_build_object(
    'name', COALESCE(users.raw_user_meta_data->>'name', split_part(users.email, '@', 1)),
    'email', users.email,
    'source', 'migration_recovery'
  )
FROM auth.users AS users
WHERE users.raw_user_meta_data->>'requested_role' IN ('artist', 'promoter', 'club', 'sello')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_requests AS requests
    WHERE requests.user_id = users.id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'role_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.role_requests;
  END IF;
END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ticket_types_array_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ticket_types_array_check
  CHECK (jsonb_typeof(ticket_types) = 'array');

UPDATE public.events
SET ticket_types = jsonb_build_array(jsonb_build_object(
  'name', 'General',
  'price', COALESCE(price, 0),
  'capacity', COALESCE(tickets_total, 100)
))
WHERE ticket_types = '[]'::jsonb;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ticket_type TEXT NOT NULL DEFAULT 'General';

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

  UPDATE public.events
  SET tickets_sold = COALESCE(tickets_sold, 0) + 1
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', v_type_name,
    'event_title', v_event.title
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fulfill_paid_transaction(
  p_transaction_id UUID,
  p_wompi_transaction_id TEXT,
  p_payment_method TEXT,
  p_wompi_payload JSONB,
  p_release_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_tier JSONB;
  v_tier_capacity INTEGER;
  v_tier_sold INTEGER;
  v_ticket_id UUID;
  v_ticket_ids JSONB := '[]'::jsonb;
  v_ticket_number TEXT;
  v_assigned_email TEXT;
  v_target_user UUID;
  v_i INTEGER;
BEGIN
  SELECT * INTO v_tx FROM public.transactions
  WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transacción no encontrada'; END IF;

  IF v_tx.status = 'approved' THEN
    SELECT COALESCE(jsonb_agg(id ORDER BY ticket_index), '[]'::jsonb)
      INTO v_ticket_ids
    FROM public.user_tickets WHERE transaction_id = v_tx.id;
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'ticket_ids', v_ticket_ids);
  END IF;

  IF v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'La transacción ya fue cerrada con estado %', v_tx.status;
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_tx.event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado'; END IF;

  IF v_tx.quantity IS NULL OR v_tx.quantity < 1 OR v_tx.quantity > 4 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;
  IF COALESCE(v_event.tickets_sold, 0) + v_tx.quantity > COALESCE(v_event.tickets_total, 0) THEN
    RAISE EXCEPTION 'No hay inventario suficiente';
  END IF;

  SELECT value INTO v_tier
  FROM jsonb_array_elements(v_event.ticket_types) AS value
  WHERE lower(value->>'name') = lower(v_tx.ticket_type)
  LIMIT 1;
  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'Tipo de entrada no disponible';
  END IF;

  v_tier_capacity := GREATEST(COALESCE((v_tier->>'capacity')::INTEGER, 0), 0);
  SELECT count(*)::INTEGER INTO v_tier_sold
  FROM public.user_tickets
  WHERE event_id = v_tx.event_id AND lower(ticket_type) = lower(v_tx.ticket_type);
  IF v_tier_sold + v_tx.quantity > v_tier_capacity THEN
    RAISE EXCEPTION 'No hay inventario suficiente para %', v_tx.ticket_type;
  END IF;

  FOR v_i IN 1..v_tx.quantity LOOP
    v_assigned_email := CASE WHEN v_i = 1 THEN NULL ELSE NULLIF(v_tx.assigned_emails->>(v_i - 2), '') END;
    v_target_user := v_tx.buyer_id;

    IF v_assigned_email IS NOT NULL THEN
      SELECT id INTO v_target_user FROM auth.users
      WHERE lower(email) = lower(v_assigned_email) LIMIT 1;
      v_target_user := COALESCE(v_target_user, v_tx.buyer_id);
    END IF;

    v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    INSERT INTO public.user_tickets
      (user_id, event_id, ticket_number, ticket_type, status, ticket_index, assigned_email, transaction_id)
    VALUES
      (v_target_user, v_tx.event_id, v_ticket_number, v_tx.ticket_type, 'valid', v_i, v_assigned_email, v_tx.id)
    RETURNING id INTO v_ticket_id;
    v_ticket_ids := v_ticket_ids || jsonb_build_array(v_ticket_id);
  END LOOP;

  UPDATE public.events
  SET tickets_sold = COALESCE(tickets_sold, 0) + v_tx.quantity
  WHERE id = v_tx.event_id;

  UPDATE public.transactions SET
    status = 'approved', wompi_transaction_id = p_wompi_transaction_id,
    payment_method = p_payment_method, wompi_payload = p_wompi_payload,
    paid_at = NOW(), release_at = p_release_at,
    ticket_id = (v_ticket_ids->>0)::UUID
  WHERE id = v_tx.id;

  IF v_tx.promoter_id IS NOT NULL THEN
    INSERT INTO public.wallets (user_id, balance_pending, total_earned, updated_at)
    VALUES (v_tx.promoter_id, v_tx.promoter_amount, v_tx.promoter_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET balance_pending = wallets.balance_pending + EXCLUDED.balance_pending,
          total_earned = wallets.total_earned + EXCLUDED.total_earned,
          updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'ticket_type', v_tx.ticket_type,
    'ticket_ids', v_ticket_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fulfill_paid_transaction(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_transaction(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;
