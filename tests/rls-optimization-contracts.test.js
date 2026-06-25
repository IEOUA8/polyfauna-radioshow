import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260625015951_phase_7_3_rls_initplan_optimization.sql', 'utf8');
const literalRewrite = readFileSync('supabase/migrations/20260625020218_phase_7_3b_rls_auth_literal_rewrite.sql', 'utf8');
const policyRoles = readFileSync('supabase/migrations/20260625020339_phase_7_3c_rls_policy_roles.sql', 'utf8');

test('fase 7.3 reescribe politicas RLS existentes con initplans auth', () => {
  assert.match(migration, /FROM pg_policy pol/);
  assert.match(migration, /pg_get_expr\(pol\.polqual, pol\.polrelid\)/);
  assert.match(migration, /regexp_replace\(new_using, '\\bauth\\.uid\\\(\\\)'/);
  assert.match(migration, /regexp_replace\(new_using, '\\bauth\\.role\\\(\\\)'/);
  assert.match(migration, /ALTER POLICY %I ON %I\.%I/);
  assert.match(migration, /WITH CHECK \(%s\)/);
});

test('fase 7.3 elimina politicas service_role redundantes', () => {
  for (const policy of [
    ['artists_service_write', 'artists'],
    ['events_service_write', 'events'],
    ['podcasts_service_write', 'podcasts'],
    ['podcasts_service_all', 'podcasts'],
    ['radio_shows_service_write', 'radio_shows'],
    ['blog_articles_service_write', 'blog_articles'],
    ['interviews_service_write', 'interviews'],
    ['messages_service_write', 'messages'],
    ['tickets_service_write', 'user_tickets'],
    ['albums_service_write', 'albums'],
    ['tracks_service_write', 'tracks'],
  ]) {
    assert.match(migration, new RegExp(`DROP POLICY IF EXISTS "${policy[0]}" ON public\\.${policy[1]}`));
  }
});

test('fase 7.3 conserva lectura publica de eventos solo por estado visible', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "events_public_read" ON public\.events/);
  assert.match(migration, /CREATE POLICY "events_visible_read" ON public\.events/);
  assert.match(migration, /status IN \('published', 'upcoming', 'live'\)/);
  assert.match(migration, /\(SELECT auth\.uid\(\)\) = owner_id/);
  assert.match(migration, /role = 'admin'/);
});

test('fase 7.3b reescribe auth helpers restantes con replace literal', () => {
  assert.match(literalRewrite, /FROM pg_policy pol/);
  assert.match(literalRewrite, /LIKE '%auth\.uid\(\)%'/);
  assert.match(literalRewrite, /LIKE '%auth\.role\(\)%'/);
  assert.match(literalRewrite, /replace\(new_using, 'auth\.uid\(\)', '\(SELECT auth\.uid\(\)\)'\)/);
  assert.match(literalRewrite, /replace\(new_check, 'auth\.role\(\)', '\(SELECT auth\.role\(\)\)'\)/);
  assert.match(literalRewrite, /ALTER POLICY %I ON %I\.%I/);
});

test('fase 7.3c limita politicas privadas a authenticated sin cerrar lecturas publicas', () => {
  assert.match(policyRoles, /ALTER POLICY %I ON %I\.%I TO authenticated/);
  assert.match(policyRoles, /ILIKE '%auth\.uid%'/);
  assert.match(policyRoles, /pol\.polname ILIKE '%admin%'/);
  assert.match(policyRoles, /pol\.polname ILIKE '%owner%'/);
  assert.match(policyRoles, /pol\.polname <> 'events_visible_read'/);
  assert.match(policyRoles, /pol\.polname <> 'notif_select'/);
  assert.match(policyRoles, /pol\.polname NOT ILIKE '%public%'/);
});
