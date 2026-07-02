import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hardening = readFileSync('supabase/migrations/20260625015236_phase_7_2_supabase_hardening.sql', 'utf8');
const featuredGuardFix = readFileSync('supabase/migrations/20260702081733_fix_featured_guard_preserves_existing_value.sql', 'utf8');

test('fase 7.2 fija search_path de funciones marcadas por advisors', () => {
  assert.match(hardening, /ALTER FUNCTION %I\.%I\(%s\) SET search_path = public/);
  for (const name of [
    'update_likes_count',
    'get_user_id_by_email',
    'count_user_event_tickets',
    'increment_podcast_plays',
    'create_notification',
    'set_updated_at',
    'touch_ticket_refund_request',
    'apply_ticket_refund_status',
    'touch_support_case_updated_at',
  ]) {
    assert.match(hardening, new RegExp(`'${name}'`));
  }
});

test('fase 7.2 revoca RPC anonima en funciones SECURITY DEFINER sensibles', () => {
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.apply_ticket_refund_status\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(hardening, /REVOKE ALL ON FUNCTION public\.create_notification\(TEXT, TEXT, TEXT, TEXT, TEXT, UUID\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(hardening, /GRANT EXECUTE ON FUNCTION public\.create_notification\(TEXT, TEXT, TEXT, TEXT, TEXT, UUID\)\s+TO service_role/);

  for (const signature of [
    'get_event_attendees\\(UUID\\)',
    'update_attendee_profile\\(UUID, TEXT, TEXT\\)',
    'get_event_offline_pack\\(UUID\\)',
    'sync_offline_ticket_scans\\(JSONB\\)',
    'get_operational_alerts\\(\\)',
    'get_or_create_wallet\\(UUID\\)',
    'purchase_ticket\\(UUID, TEXT\\)',
    'request_payout\\(BIGINT\\)',
    'approve_payout\\(UUID, TEXT, TEXT\\)',
    'validate_ticket\\(UUID\\)',
    'validate_ticket_for_event\\(UUID, UUID\\)',
    'increment_podcast_plays\\(UUID\\)',
  ]) {
    assert.match(hardening, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon`));
    assert.match(hardening, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature} TO authenticated`));
  }
});

test('fase 7.2 elimina listing amplio de buckets publicos', () => {
  for (const policy of [
    'album_covers_public_read',
    'Avatar public read',
    'podcast_audio_public_read',
    'podcast_covers_public_read',
    'track_audio_public_read',
  ]) {
    assert.match(hardening, new RegExp(`DROP POLICY IF EXISTS "${policy}" ON storage\\.objects`));
  }
});

test('fase 7.2 corrige featured sin politica update siempre verdadera', () => {
  assert.match(hardening, /DROP POLICY IF EXISTS "solo_admin_puede_featured" ON public\.events/);
  assert.match(hardening, /CREATE POLICY "events_featured_admin_guard"/);
  assert.match(hardening, /AS RESTRICTIVE/);
  assert.doesNotMatch(hardening, /FOR UPDATE[\s\S]{0,120}USING \(true\)/);
  assert.match(hardening, /featured IS DISTINCT FROM true/);
  assert.match(hardening, /role = 'admin'/);
});

test('guard de featured preserva valores existentes en ediciones ajenas al banner', () => {
  assert.match(featuredGuardFix, /DROP POLICY IF EXISTS "events_featured_admin_guard" ON public\.events/);
  assert.match(featuredGuardFix, /CREATE OR REPLACE FUNCTION public\.guard_featured_admin_only\(\)/);
  assert.match(featuredGuardFix, /NEW\.featured IS TRUE/);
  assert.match(featuredGuardFix, /OLD\.featured IS DISTINCT FROM TRUE/);
  assert.match(featuredGuardFix, /NOT public\.is_current_user_admin\(\)/);
  assert.match(featuredGuardFix, /BEFORE UPDATE ON public\.events/);
  assert.match(featuredGuardFix, /GRANT EXECUTE ON FUNCTION public\.guard_featured_admin_only\(\) TO service_role/);
});
