-- Offline-first access control: event packs, idempotent scan queue and audit log.

CREATE TABLE IF NOT EXISTS public.ticket_scan_log (
  scan_id          UUID PRIMARY KEY,
  ticket_id        UUID NOT NULL REFERENCES public.user_tickets(id) ON DELETE CASCADE,
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanner_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  device_id        TEXT NOT NULL,
  scanned_at       TIMESTAMPTZ NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode             TEXT NOT NULL DEFAULT 'offline' CHECK (mode IN ('offline', 'online')),
  result           TEXT NOT NULL CHECK (result IN ('VALID', 'ALREADY_USED', 'INVALID_STATUS', 'NOT_FOUND', 'WRONG_EVENT'))
);

CREATE INDEX IF NOT EXISTS ticket_scan_log_event_scanned_idx
  ON public.ticket_scan_log(event_id, scanned_at DESC);

ALTER TABLE public.ticket_scan_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_log_event_staff_read" ON public.ticket_scan_log;
CREATE POLICY "scan_log_event_staff_read" ON public.ticket_scan_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

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
        'id', t.id,
        'number', t.ticket_number,
        'type', t.ticket_type,
        'status', t.status
      ) ORDER BY t.created_at)
      FROM public.user_tickets t WHERE t.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_offline_ticket_scans(p_scans JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan JSONB;
  v_scan_id UUID;
  v_ticket_id UUID;
  v_event_id UUID;
  v_ticket public.user_tickets%ROWTYPE;
  v_existing TEXT;
  v_result TEXT;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF jsonb_typeof(p_scans) <> 'array' OR jsonb_array_length(p_scans) > 500 THEN
    RAISE EXCEPTION 'Lote inválido';
  END IF;

  FOR v_scan IN SELECT * FROM jsonb_array_elements(p_scans)
  LOOP
    v_scan_id := (v_scan->>'scanId')::UUID;
    v_ticket_id := (v_scan->>'ticketId')::UUID;
    v_event_id := (v_scan->>'eventId')::UUID;

    IF NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = v_event_id AND (
        e.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    ) THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT result INTO v_existing FROM public.ticket_scan_log WHERE scan_id = v_scan_id;
    IF FOUND THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('scanId', v_scan_id, 'code', v_existing, 'idempotent', true));
      CONTINUE;
    END IF;

    SELECT * INTO v_ticket FROM public.user_tickets WHERE id = v_ticket_id FOR UPDATE;
    IF NOT FOUND THEN v_result := 'NOT_FOUND';
    ELSIF v_ticket.event_id <> v_event_id THEN v_result := 'WRONG_EVENT';
    ELSIF v_ticket.status = 'used' THEN v_result := 'ALREADY_USED';
    ELSIF v_ticket.status <> 'valid' THEN v_result := 'INVALID_STATUS';
    ELSE
      UPDATE public.user_tickets SET status = 'used' WHERE id = v_ticket_id;
      v_result := 'VALID';
    END IF;

    IF v_result <> 'NOT_FOUND' THEN
      INSERT INTO public.ticket_scan_log(scan_id, ticket_id, event_id, scanner_user_id, device_id, scanned_at, result)
      VALUES (
        v_scan_id, v_ticket_id, v_event_id, auth.uid(),
        LEFT(COALESCE(v_scan->>'deviceId', 'unknown'), 120),
        COALESCE((v_scan->>'scannedAt')::TIMESTAMPTZ, NOW()), v_result
      );
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('scanId', v_scan_id, 'ticketId', v_ticket_id, 'code', v_result));
  END LOOP;
  RETURN v_results;
END;
$$;

-- Event owners (promoters/clubs) may read their own attendee list; admins retain global access.
CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id UUID)
RETURNS TABLE (
  ticket_id UUID, ticket_number TEXT, ticket_type TEXT, ticket_status TEXT,
  ticket_created TIMESTAMPTZ, user_id UUID, display_name TEXT, phone TEXT,
  email TEXT, wompi_reference TEXT, amount_total NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND (
      e.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT t.id, t.ticket_number, t.ticket_type, t.status, t.created_at, t.user_id,
    p.display_name, p.phone, u.email, tx.wompi_reference, tx.amount_total
  FROM user_tickets t
  LEFT JOIN profiles p ON p.id = t.user_id
  LEFT JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN transactions tx ON tx.id = t.transaction_id
  WHERE t.event_id = p_event_id
  ORDER BY t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_offline_pack(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_offline_ticket_scans(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_offline_pack(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_ticket_scans(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO authenticated;

