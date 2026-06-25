import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hardening = readFileSync('supabase/migrations/20260625022121_phase_7_5_security_definer_surface.sql', 'utf8');
const sourceFiles = [
  readFileSync('src/pages/AdminDashboard.jsx', 'utf8'),
  readFileSync('src/components/admin/UserManager.jsx', 'utf8'),
  readFileSync('src/components/RoleRequestsPanel.jsx', 'utf8'),
  readFileSync('src/components/admin/EventManager.jsx', 'utf8'),
  readFileSync('src/components/PromoterDashboard.jsx', 'utf8'),
  readFileSync('src/components/PodcastsPage.jsx', 'utf8'),
  readFileSync('src/pages/EventPublicPage.jsx', 'utf8'),
  readFileSync('src/components/EventTerminal.jsx', 'utf8'),
  readFileSync('src/lib/offlineTickets.js', 'utf8'),
].join('\n');

test('fase 7.5 cierra helpers admin internos como RPC directas', () => {
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.is_current_user_admin\(\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.log_admin_action\(TEXT, TEXT, UUID, UUID, JSONB\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(hardening, /GRANT EXECUTE ON FUNCTION public\.is_current_user_admin\(\)\s+TO service_role/);
  assert.match(hardening, /GRANT EXECUTE ON FUNCTION public\.log_admin_action\(TEXT, TEXT, UUID, UUID, JSONB\)\s+TO service_role/);
});

test('frontend no invoca helpers admin internos directamente', () => {
  assert.doesNotMatch(sourceFiles, /rpc\('is_current_user_admin'/);
  assert.doesNotMatch(sourceFiles, /rpc\('log_admin_action'/);
});
