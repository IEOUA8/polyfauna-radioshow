-- POLYFAUNA - Fase 7.3c: limitar politicas privadas a authenticated
--
-- Muchas politicas owner/admin usan auth.uid(), pero al no declarar TO se
-- evaluaban para anon y roles internos. Esta migracion conserva las
-- expresiones y solo limita esas politicas privadas a usuarios autenticados.
-- Se excluyen politicas con lectura publica intencional.

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      pol.polname AS policy_name
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND (
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ILIKE '%auth.uid%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ILIKE '%auth.uid%'
        OR COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ILIKE '%is_current_user_admin%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ILIKE '%is_current_user_admin%'
      )
      AND pol.polname <> 'events_visible_read'
      AND pol.polname <> 'notif_select'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name
    );
  END LOOP;
END $$;

-- Estas politicas admin no siempre contienen auth.uid() literalmente despues
-- de varias migraciones, pero tampoco deben evaluarse para anon.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT
      ns.nspname AS schema_name,
      cls.relname AS table_name,
      pol.polname AS policy_name
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public'
      AND (
        pol.polname ILIKE '%admin%'
        OR pol.polname ILIKE '%owner%'
        OR pol.polname ILIKE '%own%'
        OR pol.polname ILIKE '%promoter%'
        OR pol.polname ILIKE '%user%'
      )
      AND pol.polname NOT ILIKE '%public%'
      AND pol.polname NOT ILIKE 'events_visible_read'
      AND pol.polname NOT ILIKE 'notif_select'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_record.policy_name,
      policy_record.schema_name,
      policy_record.table_name
    );
  END LOOP;
END $$;
