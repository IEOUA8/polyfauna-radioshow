-- POLYFAUNA — Integridad de emisión y validación para lanzamiento

ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_tickets_transaction_index_unique
  ON public.user_tickets(transaction_id, ticket_index)
  WHERE transaction_id IS NOT NULL;

-- Emite todos los tickets, acredita el wallet y aprueba la transacción en una
-- sola transacción PostgreSQL. Si cualquier paso falla, no queda un pago
-- aprobado con tickets incompletos. Una repetición del webhook es idempotente.
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
      (v_target_user, v_tx.event_id, v_ticket_number, 'GA', 'valid', v_i, v_assigned_email, v_tx.id)
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

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'ticket_ids', v_ticket_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fulfill_paid_transaction(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_transaction(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;

-- Un ticket solo es consumible si sigue válido.
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

REVOKE EXECUTE ON FUNCTION public.validate_ticket_for_event(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ticket_for_event(UUID, UUID) TO authenticated;
