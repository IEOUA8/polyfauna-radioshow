-- ============================================================
-- POLYFAUNA — Sistema de tickets: funciones atómicas
-- purchase_ticket / validate_ticket + RLS promotor
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. COMPRA ATÓMICA DE TICKET
--    Previene overselling con FOR UPDATE lock.
--    Retorna JSONB con success, ticket_id, ticket_number o error.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purchase_ticket(
  p_event_id   UUID,
  p_ticket_type TEXT DEFAULT 'GA'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          events%ROWTYPE;
  v_ticket_id      UUID;
  v_ticket_number  TEXT;
  v_existing       UUID;
BEGIN
  -- Requiere autenticación
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- ¿El usuario ya tiene entrada para este evento?
  SELECT id INTO v_existing
  FROM user_tickets
  WHERE user_id = auth.uid() AND event_id = p_event_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya tienes una entrada para este evento', 'code', 'DUPLICATE');
  END IF;

  -- Bloquea la fila del evento para evitar race conditions
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento no encontrado', 'code', 'NOT_FOUND');
  END IF;

  IF v_event.status != 'published' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El evento no está disponible', 'code', 'UNAVAILABLE');
  END IF;

  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entradas agotadas', 'code', 'SOLD_OUT');
  END IF;

  -- Número de ticket: 8 caracteres alfanuméricos en mayúscula
  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  -- Inserta el ticket
  INSERT INTO user_tickets (user_id, event_id, ticket_number, ticket_type, status)
  VALUES (auth.uid(), p_event_id, v_ticket_number, p_ticket_type, 'valid')
  RETURNING id INTO v_ticket_id;

  -- Incrementa tickets_sold en el evento
  UPDATE events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success',        true,
    'ticket_id',      v_ticket_id,
    'ticket_number',  v_ticket_number,
    'event_title',    v_event.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. VALIDACIÓN DE TICKET EN PUERTA (con cámara QR)
--    Solo el dueño del evento o un admin puede validar.
--    Retorna JSONB con resultado y datos del ticket.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket    user_tickets%ROWTYPE;
  v_event     events%ROWTYPE;
  v_is_admin  BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado', 'code', 'UNAUTHENTICATED');
  END IF;

  -- ¿Es admin?
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  -- Obtiene el ticket (FOR UPDATE para evitar doble escaneo simultáneo)
  SELECT * INTO v_ticket FROM user_tickets WHERE id = p_ticket_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado', 'code', 'NOT_FOUND');
  END IF;

  -- Obtiene el evento
  SELECT * INTO v_event FROM events WHERE id = v_ticket.event_id;

  -- Verifica autorización: admin o dueño del evento
  IF NOT v_is_admin AND (v_event.owner_id IS NULL OR v_event.owner_id != auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin autorización para este evento', 'code', 'UNAUTHORIZED');
  END IF;

  -- ¿Ya fue usado?
  IF v_ticket.status = 'used' THEN
    RETURN jsonb_build_object(
      'success',        false,
      'code',           'ALREADY_USED',
      'error',          'Ticket ya utilizado',
      'ticket_type',    v_ticket.ticket_type,
      'ticket_number',  v_ticket.ticket_number,
      'event_title',    v_event.title
    );
  END IF;

  -- Marca como usado
  UPDATE user_tickets SET status = 'used' WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'success',        true,
    'code',           'VALID',
    'ticket_type',    v_ticket.ticket_type,
    'ticket_number',  v_ticket.ticket_number,
    'event_title',    v_event.title,
    'event_date',     v_event.date::text,
    'event_venue',    v_event.venue
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS: PROMOTOR VE LOS TICKETS DE SUS EVENTOS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tickets_promoter_read" ON public.user_tickets;
CREATE POLICY "tickets_promoter_read" ON public.user_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
