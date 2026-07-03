-- Anular y transferir tickets manuales/cortesia (no pasarela): el dueno del
-- evento (o admin) puede invalidar un QR emitido por error liberando el cupo,
-- o reasignarlo a otro correo sin tocar el numero/QR original. Los tickets
-- pagados por pasarela (Wompi) no pasan por aqui, usan el flujo de
-- devoluciones existente.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tickets_voided INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_tickets_voided_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_tickets_voided_check CHECK (tickets_voided >= 0);

-- ─── Autorizacion compartida: dueno del evento, co-promotor activo o admin ──
CREATE OR REPLACE FUNCTION public.is_authorized_for_event(p_actor_id UUID, p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id UUID;
  v_actor_role TEXT;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.events WHERE id = p_event_id;
  IF v_owner_id IS NULL THEN RETURN FALSE; END IF;
  IF v_owner_id = p_actor_id THEN RETURN TRUE; END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = p_actor_id;
  IF v_actor_role = 'admin' THEN RETURN TRUE; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.event_co_promoters
    WHERE event_id = p_event_id AND promoter_id = p_actor_id AND status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_for_event(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_for_event(UUID, UUID) TO service_role;

-- ─── Anular ──────────────────────────────────────────────────────────────
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

  IF NOT public.is_authorized_for_event(p_actor_id, v_event.id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_ticket.transaction_id IS NOT NULL THEN
    SELECT * INTO v_transaction FROM public.transactions WHERE id = v_ticket.transaction_id;
    IF v_transaction.payment_method IS DISTINCT FROM 'bank_transfer' THEN
      RAISE EXCEPTION 'not_voidable_use_refund';
    END IF;
  END IF;

  IF v_ticket.status = 'used' THEN RAISE EXCEPTION 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'already_cancelled'; END IF;

  UPDATE public.user_tickets SET status = 'cancelled' WHERE id = p_ticket_id;

  UPDATE public.events
  SET tickets_sold = GREATEST(COALESCE(tickets_sold, 0) - 1, 0),
      courtesies_issued = CASE
        WHEN v_ticket.ticket_type = 'Cortesía' THEN GREATEST(COALESCE(courtesies_issued, 0) - 1, 0)
        ELSE courtesies_issued
      END,
      tickets_voided = COALESCE(tickets_voided, 0) + 1
  WHERE id = v_event.id
  RETURNING tickets_voided INTO v_new_voided;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, target_user_id, metadata)
  VALUES (
    p_actor_id,
    'ticket.voided',
    'user_tickets',
    p_ticket_id,
    v_ticket.user_id,
    jsonb_build_object(
      'event_id', v_event.id,
      'ticket_type', v_ticket.ticket_type,
      'ticket_number', v_ticket.ticket_number,
      'reason', p_reason,
      'tickets_voided_total', v_new_voided
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'ticket_number', v_ticket.ticket_number,
    'event_title', v_event.title,
    'tickets_voided_total', v_new_voided
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_ticket(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_ticket(UUID, UUID, TEXT) TO service_role;

-- ─── Transferir ──────────────────────────────────────────────────────────
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

  IF NOT public.is_authorized_for_event(p_actor_id, v_event.id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_ticket.transaction_id IS NOT NULL THEN
    SELECT * INTO v_transaction FROM public.transactions WHERE id = v_ticket.transaction_id;
    IF v_transaction.payment_method IS DISTINCT FROM 'bank_transfer' THEN
      RAISE EXCEPTION 'not_transferable_use_refund';
    END IF;
  END IF;

  IF v_ticket.status = 'used' THEN RAISE EXCEPTION 'already_used'; END IF;
  IF v_ticket.status IN ('cancelled', 'refunded') THEN RAISE EXCEPTION 'already_cancelled'; END IF;

  SELECT id INTO v_new_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  UPDATE public.user_tickets
  SET user_id = v_new_user_id,
      assigned_email = CASE WHEN v_new_user_id IS NULL THEN v_email ELSE NULL END,
      status = CASE WHEN v_ticket.status = 'pending_registration' AND v_new_user_id IS NULL THEN 'pending_registration' ELSE 'valid' END
  WHERE id = p_ticket_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, target_user_id, metadata)
  VALUES (
    p_actor_id,
    'ticket.transferred',
    'user_tickets',
    p_ticket_id,
    v_new_user_id,
    jsonb_build_object(
      'event_id', v_event.id,
      'ticket_number', v_ticket.ticket_number,
      'previous_user_id', v_ticket.user_id,
      'previous_assigned_email', v_ticket.assigned_email,
      'new_recipient_email', v_email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'pending', v_new_user_id IS NULL,
    'ticket_id', p_ticket_id,
    'ticket_number', v_ticket.ticket_number,
    'ticket_type', v_ticket.ticket_type,
    'user_id', v_new_user_id,
    'recipient_email', v_email,
    'event_id', v_event.id,
    'event_title', v_event.title,
    'event_date', v_event.date,
    'event_city', COALESCE(v_event.venue, v_event.city)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_ticket(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ticket(UUID, UUID, TEXT) TO service_role;
