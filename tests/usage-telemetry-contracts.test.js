import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260625120400_usage_telemetry.sql', 'utf8');
const edgeFunction = readFileSync('supabase/functions/collect-usage-event/index.ts', 'utf8');
const telemetry = readFileSync('src/lib/telemetry.js', 'utf8');
const usageComponent = readFileSync('src/components/UsageTelemetry.jsx', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');
const player = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');
const eventPublicPage = readFileSync('src/pages/EventPublicPage.jsx', 'utf8');

test('fase 7.6 crea telemetria de uso cerrada para escritura cliente', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.usage_events/);
  assert.match(migration, /ALTER TABLE public\.usage_events ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY usage_events_admin_read/);
  assert.match(migration, /REVOKE ALL ON public\.usage_events FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.usage_events TO authenticated/);
  assert.match(migration, /GRANT ALL ON public\.usage_events TO service_role/);
  assert.doesNotMatch(migration, /GRANT INSERT ON public\.usage_events TO authenticated/);
});

test('fase 7.6 recolector limita eventos, volumen y datos sensibles', () => {
  for (const eventName of [
    'session_heartbeat',
    'route_view',
    'stream_start',
    'media_start',
    'event_view',
    'checkout_start',
    'checkout_ready',
    'ticket_claimed',
    'checkout_error',
  ]) {
    assert.match(edgeFunction, new RegExp(`'${eventName}'`));
    assert.match(telemetry, new RegExp(`'${eventName}'`));
  }

  assert.match(edgeFunction, /MAX_EVENTS_PER_MINUTE = 24/);
  assert.match(edgeFunction, /ALLOWED_PROPERTIES/);
  assert.match(edgeFunction, /pathnameOnly/);
  assert.doesNotMatch(edgeFunction, /email/i);
});

test('fase 7.6 instrumenta actividad, escucha y checkout sin bloquear UX', () => {
  assert.match(app, /<UsageTelemetry \/>/);
  assert.match(usageComponent, /trackUsageEvent\('route_view'/);
  assert.match(usageComponent, /trackUsageEvent\('session_heartbeat'/);
  assert.match(player, /trackUsageEvent\(isOnDemand \? 'media_start' : 'stream_start'/);
  assert.match(eventTerminal, /trackUsageEvent\('event_view'/);
  assert.match(eventTerminal, /trackUsageEvent\('checkout_start'/);
  assert.match(eventTerminal, /trackUsageEvent\('checkout_ready'/);
  assert.match(eventTerminal, /trackUsageEvent\('ticket_claimed'/);
  assert.match(eventPublicPage, /trackUsageEvent\('event_view'/);
  assert.match(eventPublicPage, /trackUsageEvent\('checkout_start'/);
  assert.match(eventPublicPage, /trackUsageEvent\('checkout_error'/);
});
