-- POLYFAUNA — alertas operativas externas por correo (info@polyfauna.com)
--
-- get_operational_alerts() ya calcula el estado operativo, pero solo se ve
-- dentro del panel admin (requiere sesion de admin logueado revisando la
-- pantalla). Esto agrega un envio automatico por correo cuando aparecen
-- alertas criticas nuevas, via pg_cron + pg_net -> Edge Function
-- send-operational-alert -> Resend.
--
-- El secreto compartido entre pg_net y la Edge Function se genera en el
-- servidor con datos aleatorios (gen_random_uuid) al aplicar esta migracion:
-- nunca aparece en texto plano en este archivo ni en el historial de git,
-- porque este repositorio es publico.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_alert_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'cron_alert_secret',
      'Secreto compartido entre el cron de alertas operativas y la Edge Function send-operational-alert.'
    );
  END IF;
END $$;

-- ─── Debounce: evita reenviar el mismo aviso cada 15 minutos mientras siga activo ──
CREATE TABLE IF NOT EXISTS public.operational_alert_notifications (
  code         TEXT PRIMARY KEY,
  notified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operational_alert_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_alert_notifications_admin_read" ON public.operational_alert_notifications;
CREATE POLICY "operational_alert_notifications_admin_read" ON public.operational_alert_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

REVOKE ALL ON public.operational_alert_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operational_alert_notifications TO authenticated;
GRANT ALL ON public.operational_alert_notifications TO service_role;

-- ─── Core sin chequeo de sesion, reutilizado por la version publica y por el cron ──
CREATE OR REPLACE FUNCTION public.get_operational_alerts_unsafe()
RETURNS TABLE (
  severity TEXT,
  code TEXT,
  title TEXT,
  detail TEXT,
  action TEXT,
  affected_count BIGINT,
  latest_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'critical'::TEXT,
    'approved_payment_without_ticket'::TEXT,
    'Pagos aprobados sin tickets'::TEXT,
    'Hay transacciones aprobadas sin entradas emitidas asociadas.'::TEXT,
    'Revisar webhook Wompi y ejecutar soporte manual antes de responder al comprador.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(tx.paid_at)::TIMESTAMPTZ
  FROM public.transactions tx
  WHERE tx.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_tickets t WHERE t.transaction_id = tx.id
    )
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'critical'::TEXT,
    'ticket_quantity_mismatch'::TEXT,
    'Cantidad de tickets inconsistente'::TEXT,
    'La cantidad registrada en transacciones aprobadas no coincide con tickets emitidos.'::TEXT,
    'Comparar transactions.quantity contra user_tickets por transaction_id y corregir inventario antes de nuevas ventas.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(tx.paid_at)::TIMESTAMPTZ
  FROM public.transactions tx
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::BIGINT AS issued
    FROM public.user_tickets t
    WHERE t.transaction_id = tx.id
  ) issued ON true
  WHERE tx.status = 'approved'
    AND COALESCE(tx.quantity, 1) <> COALESCE(issued.issued, 0)
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'critical'::TEXT,
    'oversold_event'::TEXT,
    'Evento sobrevendido'::TEXT,
    'Un evento tiene mas tickets vendidos que cupo total.'::TEXT,
    'Pausar ventas del evento y reconciliar tickets_sold contra user_tickets.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(e.created_at)::TIMESTAMPTZ
  FROM public.events e
  WHERE COALESCE(e.tickets_total, 0) > 0
    AND COALESCE(e.tickets_sold, 0) > COALESCE(e.tickets_total, 0)
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'warning'::TEXT,
    'stale_pending_payment'::TEXT,
    'Pagos pendientes antiguos'::TEXT,
    'Hay checkouts pendientes con mas de 45 minutos que si iniciaron pago en Wompi.'::TEXT,
    'Verificar en Wompi si quedaron aprobados sin webhook y ejecutar soporte manual si corresponde.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(tx.created_at)::TIMESTAMPTZ
  FROM public.transactions tx
  WHERE tx.status = 'pending'
    AND tx.wompi_transaction_id IS NOT NULL
    AND tx.created_at < NOW() - INTERVAL '45 minutes'
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    CASE WHEN COUNT(*) FILTER (WHERE ce.severity = 'fatal') > 0 THEN 'critical' ELSE 'warning' END::TEXT,
    'client_errors_recent'::TEXT,
    'Errores recientes en cliente'::TEXT,
    'Se registraron errores de cliente durante la ultima hora.'::TEXT,
    'Revisar client_errors por ruta, release y stack; priorizar errores fatal.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(ce.created_at)::TIMESTAMPTZ
  FROM public.client_errors ce
  WHERE ce.created_at >= NOW() - INTERVAL '1 hour'
    AND ce.severity IN ('error', 'fatal')
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'warning'::TEXT,
    'refund_requests_waiting'::TEXT,
    'Devoluciones sin respuesta'::TEXT,
    'Hay solicitudes de devolucion abiertas con mas de 24 horas.'::TEXT,
    'Entrar a Devoluciones, cambiar estado y dejar nota interna antes de contactar al usuario.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(r.created_at)::TIMESTAMPTZ
  FROM public.ticket_refund_requests r
  WHERE r.status IN ('requested', 'reviewing', 'approved', 'processing')
    AND r.created_at < NOW() - INTERVAL '24 hours'
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'warning'::TEXT,
    'payouts_waiting'::TEXT,
    'Retiros pendientes'::TEXT,
    'Hay solicitudes de retiro pendientes con mas de 48 horas.'::TEXT,
    'Validar saldo, ejecutar transferencia y registrar referencia bancaria.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(p.requested_at)::TIMESTAMPTZ
  FROM public.payouts p
  WHERE p.status = 'pending'
    AND p.requested_at < NOW() - INTERVAL '48 hours'
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    'warning'::TEXT,
    'offline_scan_conflicts'::TEXT,
    'Conflictos de validacion offline'::TEXT,
    'Se sincronizaron escaneos offline rechazados durante las ultimas 12 horas.'::TEXT,
    'Revisar ticket_scan_log por evento y dispositivo; confirmar si hubo doble acceso o paquete desactualizado.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(s.received_at)::TIMESTAMPTZ
  FROM public.ticket_scan_log s
  WHERE s.received_at >= NOW() - INTERVAL '12 hours'
    AND s.result IN ('ALREADY_USED', 'INVALID_STATUS', 'WRONG_EVENT')
  HAVING COUNT(*) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_operational_alerts_unsafe() FROM PUBLIC, anon, authenticated;

-- get_operational_alerts() sigue siendo la unica forma de leer alertas desde
-- el cliente: exige sesion de admin y delega el calculo a la version unsafe.
CREATE OR REPLACE FUNCTION public.get_operational_alerts()
RETURNS TABLE (
  severity TEXT, code TEXT, title TEXT, detail TEXT, action TEXT,
  affected_count BIGINT, latest_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT * FROM public.get_operational_alerts_unsafe();
END;
$$;

REVOKE ALL ON FUNCTION public.get_operational_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_alerts() TO authenticated;

-- ─── Verificacion del secreto, expuesta solo a service_role (la usa la Edge Function) ──
CREATE OR REPLACE FUNCTION public.verify_cron_alert_secret(p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'cron_alert_secret' AND decrypted_secret = p_secret
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_alert_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_alert_secret(TEXT) TO service_role;

-- ─── Disparador programado: cada 15 minutos, solo si hay algo critico nuevo ──
CREATE OR REPLACE FUNCTION public.trigger_operational_alerts_email()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret  TEXT;
  v_payload JSONB;
  v_count   INT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_alert_secret';

  IF v_secret IS NULL THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'severity', a.severity, 'code', a.code, 'title', a.title,
           'detail', a.detail, 'action', a.action,
           'affected_count', a.affected_count, 'latest_at', a.latest_at
         )),
         COUNT(*)
    INTO v_payload, v_count
  FROM public.get_operational_alerts_unsafe() a
  WHERE a.severity = 'critical'
    AND NOT EXISTS (
      SELECT 1 FROM public.operational_alert_notifications n
      WHERE n.code = a.code AND n.notified_at > NOW() - INTERVAL '2 hours'
    );

  IF v_count IS NULL OR v_count = 0 THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://gtusktqehukiizdfpdpm.supabase.co/functions/v1/send-operational-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('alerts', v_payload)
  );

  INSERT INTO public.operational_alert_notifications (code, notified_at)
  SELECT (a->>'code'), NOW() FROM jsonb_array_elements(v_payload) a
  ON CONFLICT (code) DO UPDATE SET notified_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_operational_alerts_email() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'operational-alerts-email',
  '*/15 * * * *',
  $$SELECT public.trigger_operational_alerts_email();$$
);
