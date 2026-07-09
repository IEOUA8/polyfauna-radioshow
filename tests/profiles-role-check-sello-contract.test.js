import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixMigration = readFileSync('supabase/migrations/20260708165000_profiles_role_check_add_sello.sql', 'utf8');
const governanceMigration = readFileSync('supabase/migrations/20260624000002_governance_audit_support.sql', 'utf8');

test('profiles_role_check incluye sello (aprobar solicitud de Sello Discografico ya no revienta el CHECK)', () => {
  // set_user_role() y process_role_request_admin() ya validaban/aceptaban
  // 'sello' desde 20260624000002_governance_audit_support.sql, pero el
  // CHECK constraint de la tabla profiles nunca se actualizo — aprobar una
  // solicitud de sello pasaba la validacion de la funcion y luego reventaba
  // en el UPDATE con "violates check constraint profiles_role_check".
  assert.match(fixMigration, /DROP CONSTRAINT profiles_role_check/);
  assert.match(fixMigration, /ADD CONSTRAINT profiles_role_check/);
  assert.match(fixMigration, /'sello'::text/);

  assert.match(governanceMigration, /IF p_role NOT IN \('citizen','artist','promoter','club','sello','admin'\)/);
});
