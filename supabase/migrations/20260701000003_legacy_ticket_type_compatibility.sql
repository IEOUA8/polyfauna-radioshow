-- Keep the deployed GA clients compatible while the new ticket-tier UI rolls out.

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
  IF lower(v_type_name) IN ('ga', 'general admission') THEN
    v_type_name := 'General';
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
