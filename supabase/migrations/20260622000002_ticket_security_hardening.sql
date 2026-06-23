-- POLYFAUNA — Endurecimiento de tickets, wallets y retiros

-- Esta función solo se usa desde create-payment con service_role. Permitirla a
-- authenticated filtraba conteos de tickets de cualquier usuario.
REVOKE EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) TO service_role;

-- Un promotor puede crear/leer únicamente su propio wallet; service_role puede
-- operar cualquiera para el webhook y tareas administrativas.
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_user_id UUID)
RETURNS public.wallets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  RETURN v_wallet;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) TO service_role;

-- Solo los eventos visibles se exponen públicamente; dueño y admin conservan
-- acceso a borradores/cancelados para gestión.
DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_visible_read" ON public.events
  FOR SELECT USING (
    status IN ('published', 'upcoming', 'live')
    OR auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Alinear eventos gratuitos con los estados aceptados por create-payment.
CREATE OR REPLACE FUNCTION public.purchase_ticket(
  p_event_id UUID,
  p_ticket_type TEXT DEFAULT 'GA'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event events%ROWTYPE;
  v_ticket_id UUID;
  v_ticket_number TEXT;
  v_existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT id INTO v_existing FROM user_tickets
  WHERE user_id = auth.uid() AND event_id = p_event_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya tienes una entrada para este evento', 'code', 'DUPLICATE');
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento no encontrado', 'code', 'NOT_FOUND');
  END IF;
  IF v_event.status NOT IN ('published', 'upcoming', 'live') THEN
    RETURN jsonb_build_object('success', false, 'error', 'El evento no está disponible', 'code', 'UNAVAILABLE');
  END IF;
  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entradas agotadas', 'code', 'SOLD_OUT');
  END IF;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO user_tickets (user_id, event_id, ticket_number, ticket_type, status)
  VALUES (auth.uid(), p_event_id, v_ticket_number, p_ticket_type, 'valid')
  RETURNING id INTO v_ticket_id;
  UPDATE events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;

  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number, 'event_title', v_event.title);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

-- Solicitud atómica: valida saldo descontando retiros ya pendientes y toma la
-- cuenta bancaria desde la base, no desde datos manipulables del cliente.
CREATE OR REPLACE FUNCTION public.request_payout(p_amount BIGINT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
  v_account public.promoter_accounts;
  v_reserved BIGINT;
  v_payout_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Solicitud inválida';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet no encontrado'; END IF;

  SELECT * INTO v_account FROM public.promoter_accounts WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Configura una cuenta bancaria antes de solicitar el retiro'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved FROM public.payouts
  WHERE user_id = auth.uid() AND status IN ('pending', 'processing');

  IF p_amount > v_wallet.balance_available - v_reserved THEN
    RAISE EXCEPTION 'Saldo disponible insuficiente';
  END IF;

  INSERT INTO public.payouts (user_id, amount, account_snapshot)
  VALUES (auth.uid(), p_amount, to_jsonb(v_account) - 'id' - 'user_id')
  RETURNING id INTO v_payout_id;
  RETURN v_payout_id;
END;
$$;

DROP POLICY IF EXISTS "payout_own_insert" ON public.payouts;
REVOKE INSERT ON public.payouts FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.request_payout(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_payout(BIGINT) TO authenticated;

-- Nunca marcar como pagado un retiro superior al saldo disponible.
CREATE OR REPLACE FUNCTION public.approve_payout(
  p_payout_id UUID,
  p_transfer_reference TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payout public.payouts;
  v_available BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_payout FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'Retiro no encontrado o ya procesado';
  END IF;

  SELECT balance_available INTO v_available FROM public.wallets
  WHERE user_id = v_payout.user_id FOR UPDATE;
  IF v_available IS NULL OR v_payout.amount <= 0 OR v_payout.amount > v_available THEN
    RAISE EXCEPTION 'Saldo insuficiente para aprobar el retiro';
  END IF;

  UPDATE public.wallets
  SET balance_available = balance_available - v_payout.amount, updated_at = NOW()
  WHERE user_id = v_payout.user_id;

  UPDATE public.payouts
  SET status = 'completed', transfer_reference = p_transfer_reference,
      admin_notes = COALESCE(p_admin_notes, admin_notes), processed_at = NOW()
  WHERE id = p_payout_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) TO authenticated;
