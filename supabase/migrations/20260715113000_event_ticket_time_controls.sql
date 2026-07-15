-- Horarios operativos por tipo de ticket:
--   sales_end_at: cierre de venta digital.
--   entry_cutoff_at / late_entry_fee: control de ingreso para Early.
-- Los datos viven dentro de events.ticket_types para conservar el inventario
-- por tier como una sola configuración atómica.

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
  v_sales_end_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND trim(full_name) <> '' AND trim(document_number) <> ''
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

  BEGIN
    v_sales_end_at := COALESCE(NULLIF(v_tier->>'sales_end_at', '')::TIMESTAMPTZ, v_event.date);
  EXCEPTION WHEN invalid_datetime_format THEN
    RETURN jsonb_build_object('success', false, 'error', 'La entrada no tiene un límite de venta válido', 'code', 'INVALID_SALES_END');
  END;
  IF v_sales_end_at IS NOT NULL AND NOW() > v_sales_end_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La venta digital de esta entrada ya finalizó. Consulta disponibilidad en la puerta del evento.',
      'code', 'TICKET_SALES_CLOSED',
      'sales_end_at', v_sales_end_at
    );
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
      'error', 'Cortesía pendiente: el destinatario (' || COALESCE(v_ticket.assigned_email, 'sin correo') || ') debe crear su cuenta en Polyfauna con ese correo antes de poder validar este QR',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
      'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'),
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
  END IF;

  IF lower(v_ticket.ticket_type) = 'early' THEN
    SELECT value INTO v_tier
    FROM jsonb_array_elements(v_event.ticket_types) AS value
    WHERE lower(value->>'name') = lower(v_ticket.ticket_type)
    LIMIT 1;
    BEGIN
      v_entry_cutoff_at := NULLIF(v_tier->>'entry_cutoff_at', '')::TIMESTAMPTZ;
    EXCEPTION WHEN invalid_datetime_format THEN
      v_entry_cutoff_at := NULL;
    END;
    IF COALESCE(v_tier->>'late_entry_fee', '') ~ '^[0-9]+([.][0-9]+)?$' THEN
      v_late_entry_fee := (v_tier->>'late_entry_fee')::NUMERIC;
    END IF;
    IF v_entry_cutoff_at IS NOT NULL AND NOW() > v_entry_cutoff_at THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'EARLY_ENTRY_WINDOW_EXPIRED',
        'error', 'Ticket Early fuera de su horario de ingreso. Debe pagar el recargo indicado antes de ingresar.',
        'ticket_id', v_ticket.id,
        'event_id', v_event.id,
        'ticket_type', v_ticket.ticket_type,
        'ticket_number', v_ticket.ticket_number,
        'event_title', v_event.title,
        'entry_cutoff_at', v_entry_cutoff_at,
        'late_entry_fee', v_late_entry_fee,
        'full_name', v_identity.full_name,
        'document_type', v_identity.document_type,
        'document_number', v_identity.document_number
      );
    END IF;
  END IF;

  UPDATE public.user_tickets SET status = 'used' WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true, 'code', 'VALID', 'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'event_date', v_event.date::text, 'event_venue', v_event.venue,
    'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;

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
        'id', ticket.id,
        'number', ticket.ticket_number,
        'type', ticket.ticket_type,
        'status', ticket.status,
        'entry_cutoff_at', tier.value->>'entry_cutoff_at',
        'late_entry_fee', CASE
          WHEN COALESCE(tier.value->>'late_entry_fee', '') ~ '^[0-9]+([.][0-9]+)?$'
          THEN (tier.value->>'late_entry_fee')::NUMERIC
          ELSE 0
        END,
        'full_name', identity.full_name,
        'document_type', identity.document_type,
        'document_number', identity.document_number
      ) ORDER BY ticket.created_at)
      FROM public.user_tickets AS ticket
      LEFT JOIN public.user_identity AS identity ON identity.user_id = ticket.user_id
      LEFT JOIN LATERAL (
        SELECT value
        FROM jsonb_array_elements(v_event.ticket_types) AS value
        WHERE lower(value->>'name') = lower(ticket.ticket_type)
        LIMIT 1
      ) AS tier ON TRUE
      WHERE ticket.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_offline_pack(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_offline_pack(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.early_entry_surcharge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.user_tickets(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'door' CHECK (payment_method IN ('door')),
  confirmed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS early_entry_surcharge_event_idx
  ON public.early_entry_surcharge_log(event_id, confirmed_at DESC);

ALTER TABLE public.early_entry_surcharge_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.early_entry_surcharge_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.early_entry_surcharge_log TO authenticated;

DROP POLICY IF EXISTS "early_surcharge_event_staff_read" ON public.early_entry_surcharge_log;
CREATE POLICY "early_surcharge_event_staff_read" ON public.early_entry_surcharge_log
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.events AS event
    WHERE event.id = early_entry_surcharge_log.event_id AND event.owner_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid()) AND profile.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.event_co_promoters AS collaborator
    WHERE collaborator.event_id = early_entry_surcharge_log.event_id
      AND collaborator.promoter_id = (SELECT auth.uid())
      AND collaborator.status = 'active'
  )
);

CREATE OR REPLACE FUNCTION public.admit_early_ticket_with_surcharge(
  p_ticket_id UUID,
  p_event_id UUID
)
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
  v_existing_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado', 'code', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_ticket FROM public.user_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado', 'code', 'NOT_FOUND');
  END IF;
  IF v_ticket.event_id <> p_event_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'El ticket pertenece a otro evento', 'code', 'WRONG_EVENT');
  END IF;
  IF NOT public.is_authorized_for_event(auth.uid(), v_ticket.event_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin autorización para este evento', 'code', 'UNAUTHORIZED');
  END IF;

  SELECT amount INTO v_existing_amount
  FROM public.early_entry_surcharge_log
  WHERE ticket_id = p_ticket_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'code', 'VALID', 'already_processed', true,
      'ticket_id', v_ticket.id, 'ticket_type', v_ticket.ticket_type,
      'ticket_number', v_ticket.ticket_number, 'late_entry_fee', v_existing_amount,
      'surcharge_collected', true
    );
  END IF;

  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'), 'code', 'INVALID_STATUS');
  END IF;
  IF lower(v_ticket.ticket_type) <> 'early' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El ticket no es Early', 'code', 'INVALID_TIER');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  SELECT value INTO v_tier
  FROM jsonb_array_elements(v_event.ticket_types) AS value
  WHERE lower(value->>'name') = 'early'
  LIMIT 1;
  BEGIN
    v_entry_cutoff_at := NULLIF(v_tier->>'entry_cutoff_at', '')::TIMESTAMPTZ;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_entry_cutoff_at := NULL;
  END;
  IF COALESCE(v_tier->>'late_entry_fee', '') ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_late_entry_fee := (v_tier->>'late_entry_fee')::NUMERIC;
  END IF;
  IF v_entry_cutoff_at IS NULL OR NOW() <= v_entry_cutoff_at OR v_late_entry_fee <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El ticket no requiere un recargo de ingreso', 'code', 'SURCHARGE_NOT_REQUIRED');
  END IF;

  IF v_ticket.user_id IS NOT NULL THEN
    SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_ticket.user_id;
  END IF;

  INSERT INTO public.early_entry_surcharge_log(ticket_id, event_id, amount, confirmed_by)
  VALUES (v_ticket.id, v_ticket.event_id, v_late_entry_fee, auth.uid());
  UPDATE public.user_tickets SET status = 'used' WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true, 'code', 'VALID',
    'ticket_id', v_ticket.id,
    'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number,
    'event_id', v_event.id,
    'event_title', v_event.title,
    'event_date', v_event.date::text,
    'event_venue', v_event.venue,
    'late_entry_fee', v_late_entry_fee,
    'surcharge_collected', true,
    'full_name', v_identity.full_name,
    'document_type', v_identity.document_type,
    'document_number', v_identity.document_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admit_early_ticket_with_surcharge(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admit_early_ticket_with_surcharge(UUID, UUID) TO authenticated;
