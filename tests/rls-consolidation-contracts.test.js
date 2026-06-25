import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const consolidation = readFileSync('supabase/migrations/20260625020755_phase_7_4_rls_policy_consolidation.sql', 'utf8');

test('fase 7.4 separa escritura admin de lecturas publicas', () => {
  for (const table of ['artists', 'albums', 'blog_articles', 'interviews', 'radio_shows', 'tracks']) {
    assert.match(consolidation, new RegExp(`DROP POLICY IF EXISTS "${table}_admin_write" ON public\\.${table}`));
    assert.match(consolidation, new RegExp(`CREATE POLICY "${table}_admin_insert" ON public\\.${table}`));
    assert.match(consolidation, new RegExp(`CREATE POLICY "${table}_admin_update" ON public\\.${table}`));
    assert.match(consolidation, new RegExp(`CREATE POLICY "${table}_admin_delete" ON public\\.${table}`));
  }

  assert.doesNotMatch(consolidation, /CREATE POLICY "[^"]+_admin_write"[\s\S]{0,80}FOR ALL/);
});

test('fase 7.4 consolida eventos, mensajes, tickets y perfiles', () => {
  for (const policy of [
    'events_insert_access',
    'events_update_access',
    'events_delete_access',
    'messages_select_access',
    'messages_insert_access',
    'messages_update_access',
    'tickets_select_access',
    'profiles_public_read',
    'profiles_update_access',
  ]) {
    assert.match(consolidation, new RegExp(`CREATE POLICY "${policy}"`));
  }

  assert.match(consolidation, /DROP POLICY IF EXISTS "events_admin_write" ON public\.events/);
  assert.match(consolidation, /DROP POLICY IF EXISTS "messages_admin_write" ON public\.messages/);
  assert.match(consolidation, /DROP POLICY IF EXISTS "tickets_admin_write" ON public\.user_tickets/);
  assert.match(consolidation, /DROP POLICY IF EXISTS "Public profiles viewable" ON public\.profiles/);
});

test('fase 7.4 combina politicas owner admin restantes', () => {
  for (const policy of [
    'promoter_accounts_access',
    'wallets_select_access',
    'transactions_select_access',
    'payouts_select_access',
    'role_requests_select_access',
    'support_cases_select_access',
    'refund_requests_select_access',
    'show_questions_select_access',
    'comments_delete_access',
  ]) {
    assert.match(consolidation, new RegExp(`CREATE POLICY "${policy}"`));
  }
});

test('fase 7.4 maneja playlists de forma condicional', () => {
  assert.match(consolidation, /IF to_regclass\('public\.playlists'\) IS NOT NULL THEN/);
  assert.match(consolidation, /DROP POLICY IF EXISTS "Public playlists viewable" ON public\.playlists/);
  assert.match(consolidation, /CREATE POLICY "playlists_select_access" ON public\.playlists/);
  assert.match(consolidation, /is_public = true OR \(SELECT auth\.uid\(\)\) = user_id/);
});
