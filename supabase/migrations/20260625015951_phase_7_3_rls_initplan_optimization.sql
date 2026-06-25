-- POLYFAUNA - Fase 7.3: optimizacion RLS para usuarios activos
--
-- Objetivo:
-- - Reducir costo por fila en politicas RLS reescribiendo auth.uid()/auth.role()
--   como initplans: (SELECT auth.uid()) y (SELECT auth.role()).
-- - Quitar politicas service_role redundantes que se evaluaban para anon/auth.
-- - Mantener eventos publicos solo por la politica visible_read basada en estado.

DO $$
DECLARE
  policy_record RECORD;
  new_using TEXT;
  new_check TEXT;
  alter_sql TEXT;
BEGIN
  FOR policy_record IN
    SELECT
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      pol.polname AS policy_name,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expression
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname IN ('public', 'storage')
      AND (
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ~* 'auth\.(uid|role)\(\)'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~* 'auth\.(uid|role)\(\)'
      )
  LOOP
    new_using := policy_record.using_expression;
    new_check := policy_record.check_expression;

    IF new_using IS NOT NULL THEN
      new_using := regexp_replace(new_using, '\bauth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      new_using := regexp_replace(new_using, '\bauth\.role\(\)', '(SELECT auth.role())', 'gi');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\bauth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      new_check := regexp_replace(new_check, '\bauth\.role\(\)', '(SELECT auth.role())', 'gi');
    END IF;

    alter_sql := format(
      'ALTER POLICY %I ON %I.%I',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name
    );

    IF new_using IS NOT NULL THEN
      alter_sql := alter_sql || format(' USING (%s)', new_using);
    END IF;

    IF new_check IS NOT NULL THEN
      alter_sql := alter_sql || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE alter_sql;
  END LOOP;
END $$;

-- service_role ya bypassa RLS en Supabase. Estas politicas no aportan acceso
-- real adicional y si agregaban evaluaciones redundantes a anon/authenticated.
DROP POLICY IF EXISTS "artists_service_write" ON public.artists;
DROP POLICY IF EXISTS "events_service_write" ON public.events;
DROP POLICY IF EXISTS "podcasts_service_write" ON public.podcasts;
DROP POLICY IF EXISTS "podcasts_service_all" ON public.podcasts;
DROP POLICY IF EXISTS "radio_shows_service_write" ON public.radio_shows;
DROP POLICY IF EXISTS "blog_articles_service_write" ON public.blog_articles;
DROP POLICY IF EXISTS "interviews_service_write" ON public.interviews;
DROP POLICY IF EXISTS "messages_service_write" ON public.messages;
DROP POLICY IF EXISTS "tickets_service_write" ON public.user_tickets;
DROP POLICY IF EXISTS "albums_service_write" ON public.albums;
DROP POLICY IF EXISTS "tracks_service_write" ON public.tracks;

-- La politica abierta fue reintroducida por una migracion posterior. La lectura
-- publica de eventos debe pasar por events_visible_read para no exponer drafts.
DROP POLICY IF EXISTS "events_public_read" ON public.events;

DROP POLICY IF EXISTS "events_visible_read" ON public.events;
CREATE POLICY "events_visible_read" ON public.events
  FOR SELECT
  USING (
    status IN ('published', 'upcoming', 'live')
    OR (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );
