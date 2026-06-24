-- POLYFAUNA — alertas operativas calculadas para admin
-- La función no persiste alertas: calcula el estado actual para reducir ruido.

CREATE OR REPLACE FUNCTION public.get_operational_alerts()
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

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
    'Un evento tiene más tickets vendidos que cupo total.'::TEXT,
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
    'Hay checkouts pendientes con más de 45 minutos.'::TEXT,
    'Verificar en Wompi si quedaron aprobados sin webhook o marcarlos como abandonados según soporte.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(tx.created_at)::TIMESTAMPTZ
  FROM public.transactions tx
  WHERE tx.status = 'pending'
    AND tx.created_at < NOW() - INTERVAL '45 minutes'
  HAVING COUNT(*) > 0;

  RETURN QUERY
  SELECT
    CASE WHEN COUNT(*) FILTER (WHERE ce.severity = 'fatal') > 0 THEN 'critical' ELSE 'warning' END::TEXT,
    'client_errors_recent'::TEXT,
    'Errores recientes en cliente'::TEXT,
    'Se registraron errores de cliente durante la última hora.'::TEXT,
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
    'Hay solicitudes de devolución abiertas con más de 24 horas.'::TEXT,
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
    'Hay solicitudes de retiro pendientes con más de 48 horas.'::TEXT,
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
    'Conflictos de validación offline'::TEXT,
    'Se sincronizaron escaneos offline rechazados durante las últimas 12 horas.'::TEXT,
    'Revisar ticket_scan_log por evento y dispositivo; confirmar si hubo doble acceso o paquete desactualizado.'::TEXT,
    COUNT(*)::BIGINT,
    MAX(s.received_at)::TIMESTAMPTZ
  FROM public.ticket_scan_log s
  WHERE s.received_at >= NOW() - INTERVAL '12 hours'
    AND s.result IN ('ALREADY_USED', 'INVALID_STATUS', 'WRONG_EVENT')
  HAVING COUNT(*) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_operational_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_alerts() TO authenticated;
