-- POLYFAUNA - Fase 7.3b: reescritura literal de auth.* en RLS
--
-- La fase 7.3 elimino politicas service_role redundantes y reescribio parte
-- de las politicas. Esta subfase usa replace() literal sobre pg_policy para
-- cubrir expresiones que no coincidieron con el regex anterior.

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
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') LIKE '%auth.uid()%'
        OR COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') LIKE '%auth.role()%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') LIKE '%auth.uid()%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') LIKE '%auth.role()%'
      )
  LOOP
    new_using := policy_record.using_expression;
    new_check := policy_record.check_expression;

    IF new_using IS NOT NULL THEN
      new_using := replace(new_using, 'auth.uid()', '(SELECT auth.uid())');
      new_using := replace(new_using, 'auth.role()', '(SELECT auth.role())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, 'auth.uid()', '(SELECT auth.uid())');
      new_check := replace(new_check, 'auth.role()', '(SELECT auth.role())');
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
