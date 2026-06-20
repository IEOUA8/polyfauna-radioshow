-- ============================================================
-- POLYFAUNA — Funciones admin para lista de asistentes
-- ============================================================

-- ─── Añadir teléfono al perfil ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ─── Admin puede leer todos los tickets ────────────────────
DROP POLICY IF EXISTS "tickets_admin_read" ON public.user_tickets;
CREATE POLICY "tickets_admin_read" ON public.user_tickets
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Función: lista de asistentes por evento ───────────────
-- Solo admins. Accede a auth.users para obtener el email.
CREATE OR REPLACE FUNCTION get_event_attendees(p_event_id UUID)
RETURNS TABLE (
  ticket_id        UUID,
  ticket_number    TEXT,
  ticket_type      TEXT,
  ticket_status    TEXT,
  ticket_created   TIMESTAMPTZ,
  user_id          UUID,
  display_name     TEXT,
  phone            TEXT,
  email            TEXT,
  wompi_reference  TEXT,
  amount_total     NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.ticket_number,
    t.ticket_type,
    t.status,
    t.created_at,
    t.user_id,
    p.display_name,
    p.phone,
    u.email,
    tx.wompi_reference,
    tx.amount_total
  FROM user_tickets t
  LEFT JOIN profiles p       ON p.id  = t.user_id
  LEFT JOIN auth.users u     ON u.id  = t.user_id
  LEFT JOIN transactions tx  ON tx.event_id  = p_event_id
                             AND tx.buyer_id = t.user_id
                             AND tx.status   = 'approved'
  WHERE t.event_id = p_event_id
  ORDER BY t.created_at DESC;
END;
$$;

-- ─── Función: editar datos de asistente (solo admin) ───────
CREATE OR REPLACE FUNCTION update_attendee_profile(
  p_user_id     UUID,
  p_display_name TEXT,
  p_phone        TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE profiles
  SET
    display_name = COALESCE(NULLIF(p_display_name, ''), display_name),
    phone        = p_phone,
    updated_at   = NOW()
  WHERE id = p_user_id;
END;
$$;
