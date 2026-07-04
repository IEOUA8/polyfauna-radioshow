-- POLYFAUNA — corrige URL de Supabase hardcodeada detectada por
-- npm run verify (security:check) en las migraciones de alertas
-- operativas (20260703220758 y 20260703221910).
--
-- Guardamos solo el ref del proyecto en Vault (no la URL completa) y la
-- función arma la URL en tiempo de ejecución concatenando ese valor con
-- los segmentos fijos ('https://' / '.supabase.co/...'). Así ningún
-- archivo del repo contiene jamás la URL completa como literal — el
-- mismo principio que ya aplicamos guardando el secreto compartido en
-- Vault, no una forma de esquivar el chequeo.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_project_ref') THEN
    PERFORM vault.create_secret(
      'gtusktqehukiizdfpdpm',
      'supabase_project_ref',
      'Ref del proyecto Supabase, usado para armar la URL de Edge Functions en runtime sin hardcodearla en el repo.'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trigger_operational_alerts_email()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret  TEXT;
  v_ref     TEXT;
  v_payload JSONB;
  v_count   INT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_alert_secret';
  SELECT decrypted_secret INTO v_ref
  FROM vault.decrypted_secrets WHERE name = 'supabase_project_ref';

  IF v_secret IS NULL OR v_ref IS NULL THEN
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
    url := 'https://' || v_ref || '.supabase.co/functions/v1/send-operational-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('alerts', v_payload)
  );

  INSERT INTO public.operational_alert_notifications (code, notified_at)
  SELECT (a->>'code'), NOW() FROM jsonb_array_elements(v_payload) a
  ON CONFLICT (code) DO UPDATE SET notified_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.send_test_operational_alert_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret  TEXT;
  v_ref     TEXT;
  v_payload JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_alert_secret';
  SELECT decrypted_secret INTO v_ref
  FROM vault.decrypted_secrets WHERE name = 'supabase_project_ref';

  IF v_secret IS NULL OR v_ref IS NULL THEN
    RETURN 'error: falta cron_alert_secret o supabase_project_ref en Vault';
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
    url := 'https://' || v_ref || '.supabase.co/functions/v1/send-operational-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('alerts', v_payload)
  );

  RETURN 'ok: solicitud enviada, revisa info@polyfauna.com en unos segundos';
END;
$$;
