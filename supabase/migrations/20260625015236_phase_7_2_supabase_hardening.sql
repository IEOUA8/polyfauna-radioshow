-- POLYFAUNA - Fase 7.2: endurecimiento Supabase previo a mayor carga
--
-- Objetivo:
-- - Fijar search_path en funciones existentes marcadas por Database Advisors.
-- - Reducir RPCs SECURITY DEFINER expuestas a anon/public.
-- - Evitar listing amplio de buckets publicos.
-- - Corregir la politica de featured que tenia USING (true) en UPDATE.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'update_likes_count',
        'get_user_id_by_email',
        'count_user_event_tickets',
        'increment_podcast_plays',
        'create_notification',
        'set_updated_at',
        'touch_ticket_refund_request',
        'apply_ticket_refund_status',
        'touch_support_case_updated_at'
      ])
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  END LOOP;
END $$;

-- Funciones internas de triggers o mantenimiento: no deben ser RPC publicas.
REVOKE ALL ON FUNCTION public.apply_ticket_refund_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_ticket_refund_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_support_case_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;

  IF to_regprocedure('public.update_likes_count()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.update_likes_count() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Funciones que si se consumen desde la app, pero no deben estar disponibles
-- para usuarios anonimos.
REVOKE ALL ON FUNCTION public.get_event_attendees(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_attendee_profile(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_offline_pack(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_offline_ticket_scans(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_operational_alerts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_wallet(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_payout(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_ticket(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_ticket_for_event(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_podcast_plays(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_attendee_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_offline_pack(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_ticket_scans(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ticket_for_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_podcast_plays(UUID) TO authenticated;

-- create_notification no tiene chequeo de rol interno; se reserva para service_role.
REVOKE ALL ON FUNCTION public.create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

-- Los buckets publicos siguen sirviendo URLs publicas, pero estas politicas
-- permitian listar todos los objetos del bucket desde la API de storage.
DROP POLICY IF EXISTS "album_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "podcast_audio_public_read" ON storage.objects;
DROP POLICY IF EXISTS "podcast_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "track_audio_public_read" ON storage.objects;

-- Elimina una politica de UPDATE con USING (true) y reemplaza por una
-- restriccion que solo permite dejar featured=true a administradores.
DROP POLICY IF EXISTS "solo_admin_puede_featured" ON public.events;
CREATE POLICY "events_featured_admin_guard"
  ON public.events
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK (
    featured IS DISTINCT FROM true
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );
