-- POLYFAUNA — Solicitudes de devolución de tickets
-- La solicitud no reembolsa automáticamente ni invalida el ticket.
-- Operación/Admin revisa, aprueba y ejecuta el reembolso con el proveedor de pago.

DO $$
BEGIN
  IF to_regclass('public.user_tickets') IS NULL THEN
    RAISE EXCEPTION 'Falta public.user_tickets. Ejecuta primero 20260617000000_initial_schema.sql y las migraciones de tickets/pagos antes de 20260623000002_ticket_refund_requests.sql.';
  END IF;

  IF to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION 'Falta public.events. Ejecuta primero 20260617000000_initial_schema.sql antes de 20260623000002_ticket_refund_requests.sql.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Falta public.profiles. Ejecuta primero las migraciones de perfiles/roles antes de 20260623000002_ticket_refund_requests.sql.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ticket_refund_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.user_tickets(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  details         TEXT,
  status          TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'reviewing', 'approved', 'rejected', 'processing', 'refunded', 'cancelled')),
  admin_notes     TEXT,
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_refund_requests_user
  ON public.ticket_refund_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_refund_requests_event
  ON public.ticket_refund_requests(event_id, created_at DESC);

ALTER TABLE public.ticket_refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refund_requests_owner_read" ON public.ticket_refund_requests;
CREATE POLICY "refund_requests_owner_read" ON public.ticket_refund_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "refund_requests_owner_insert" ON public.ticket_refund_requests;
CREATE POLICY "refund_requests_owner_insert" ON public.ticket_refund_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_tickets t
      WHERE t.id = ticket_id
        AND t.user_id = auth.uid()
        AND t.status NOT IN ('used', 'cancelled', 'refunded')
    )
  );

DROP POLICY IF EXISTS "refund_requests_admin_all" ON public.ticket_refund_requests;
CREATE POLICY "refund_requests_admin_all" ON public.ticket_refund_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.touch_ticket_refund_request()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_refund_requests_touch ON public.ticket_refund_requests;
CREATE TRIGGER ticket_refund_requests_touch
  BEFORE UPDATE ON public.ticket_refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_ticket_refund_request();

CREATE OR REPLACE FUNCTION public.apply_ticket_refund_status()
RETURNS TRIGGER AS $$
DECLARE
  v_already_refunded BOOLEAN;
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT status = 'refunded' INTO v_already_refunded
    FROM public.user_tickets
    WHERE id = NEW.ticket_id;

    UPDATE public.user_tickets
    SET status = 'refunded'
    WHERE id = NEW.ticket_id;

    IF NOT COALESCE(v_already_refunded, false) AND NEW.event_id IS NOT NULL THEN
      UPDATE public.events
      SET tickets_sold = GREATEST(COALESCE(tickets_sold, 0) - 1, 0)
      WHERE id = NEW.event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ticket_refund_requests_apply_status ON public.ticket_refund_requests;
CREATE TRIGGER ticket_refund_requests_apply_status
  AFTER UPDATE OF status ON public.ticket_refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_ticket_refund_status();
