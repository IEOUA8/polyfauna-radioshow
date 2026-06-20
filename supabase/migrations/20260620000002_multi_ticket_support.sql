-- ============================================================
-- POLYFAUNA — Soporte multi-ticket: máx 4 por persona/evento
-- + asignación de email por ticket (transferencia de ownership)
-- ============================================================

-- ── Extender transactions ──────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS quantity        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_emails JSONB   NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_quantity_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_quantity_check CHECK (quantity BETWEEN 1 AND 4);

-- ── Extender user_tickets ──────────────────────────────────────
ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS assigned_email TEXT,
  ADD COLUMN IF NOT EXISTS ticket_index   INTEGER NOT NULL DEFAULT 1;

-- ── Lookup de user_id por email (para ownership transfer) ──────
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

-- ── Contar tickets válidos de un usuario en un evento ──────────
CREATE OR REPLACE FUNCTION public.count_user_event_tickets(
  p_user_id  UUID,
  p_event_id UUID
) RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_tickets
  WHERE user_id = p_user_id
    AND event_id = p_event_id
    AND status NOT IN ('cancelled', 'refunded');
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_user_event_tickets(UUID, UUID) TO authenticated;

-- ── Emitir ticket v2: permite múltiples por usuario/evento ─────
-- (Reemplaza issue_ticket_for_user para el flujo multi-ticket)
CREATE OR REPLACE FUNCTION public.issue_ticket_v2(
  p_event_id       UUID,
  p_user_id        UUID,
  p_ticket_type    TEXT    DEFAULT 'GA',
  p_ticket_index   INTEGER DEFAULT 1,
  p_assigned_email TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event         events%ROWTYPE;
  v_ticket_id     UUID;
  v_ticket_number TEXT;
  v_count         INTEGER;
BEGIN
  -- Verificar límite de 4 tickets por persona en este evento
  SELECT COUNT(*) INTO v_count
  FROM user_tickets
  WHERE user_id = p_user_id
    AND event_id = p_event_id
    AND status NOT IN ('cancelled', 'refunded');

  IF v_count >= 4 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Límite de 4 tickets por persona alcanzado',
      'code',    'LIMIT_EXCEEDED'
    );
  END IF;

  -- Lock del evento para evitar overselling
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento no encontrado', 'code', 'NOT_FOUND');
  END IF;

  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 999999) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entradas agotadas', 'code', 'SOLD_OUT');
  END IF;

  -- Número único de ticket
  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  INSERT INTO user_tickets
    (user_id, event_id, ticket_number, ticket_type, status, ticket_index, assigned_email)
  VALUES
    (p_user_id, p_event_id, v_ticket_number, p_ticket_type, 'valid', p_ticket_index, p_assigned_email)
  RETURNING id INTO v_ticket_id;

  UPDATE events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success',       true,
    'ticket_id',     v_ticket_id,
    'ticket_number', v_ticket_number,
    'event_title',   v_event.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_ticket_v2(UUID, UUID, TEXT, INTEGER, TEXT) TO service_role;
