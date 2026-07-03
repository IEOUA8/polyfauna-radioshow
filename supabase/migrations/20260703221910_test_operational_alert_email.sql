-- POLYFAUNA — utilidad de prueba para el envio de alertas operativas.
--
-- Permite a un admin disparar un correo de prueba a info@polyfauna.com sin
-- esperar a que ocurra una alerta critica real, para verificar el circuito
-- completo (pg_net -> Edge Function send-operational-alert -> Resend).
-- No toca operational_alert_notifications ni afecta el debounce del cron real.
CREATE OR REPLACE FUNCTION public.send_test_operational_alert_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret  TEXT;
  v_payload JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_alert_secret';

  IF v_secret IS NULL THEN
    RETURN 'error: cron_alert_secret no existe en Vault';
  END IF;

  v_payload := jsonb_build_array(jsonb_build_object(
    'severity', 'critical',
    'code', 'test_alert',
    'title', 'Alerta de prueba',
    'detail', 'Este correo confirma que el circuito pg_net -> Edge Function -> Resend funciona correctamente.',
    'action', 'Ninguna accion requerida, es solo una prueba.',
    'affected_count', 1,
    'latest_at', NOW()
  ));

  PERFORM net.http_post(
    url := 'https://gtusktqehukiizdfpdpm.supabase.co/functions/v1/send-operational-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('alerts', v_payload)
  );

  RETURN 'ok: solicitud enviada, revisa info@polyfauna.com en unos segundos';
END;
$$;

REVOKE ALL ON FUNCTION public.send_test_operational_alert_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_test_operational_alert_email() TO authenticated;
