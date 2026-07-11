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
const metricsMigration = readFileSync('supabase/migrations/20260630000001_usage_metrics_dashboard.sql', 'utf8');
const metricsInvokerMigration = readFileSync('supabase/migrations/20260630000002_usage_metrics_security_invoker.sql', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const streamMonitoringMigration = readFileSync('supabase/migrations/20260710000001_stream_resilience_and_monitoring.sql', 'utf8');
const radioHealthFunction = readFileSync('supabase/functions/check-radio-health/index.ts', 'utf8');

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
    'stream_connecting',
    'stream_playing',
    'stream_stalled',
    'stream_reconnect_attempt',
    'stream_recovered',
    'stream_failed',
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

test('la radio registra cortes, recuperaciones y calidad sin datos personales', () => {
  for (const eventName of ['stream_connecting', 'stream_playing', 'stream_stalled', 'stream_reconnect_attempt', 'stream_recovered', 'stream_failed']) {
    assert.match(player, new RegExp(`'${eventName}'`));
  }
  for (const property of ['quality', 'reason', 'attempt', 'delay_ms', 'duration_ms', 'network_type']) {
    assert.match(telemetry, new RegExp(`'${property}'`));
    assert.match(edgeFunction, new RegExp(`'${property}'`));
  }
});

test('el monitor externo comprueba API y tres mounts y alimenta alertas operativas', () => {
  assert.match(streamMonitoringMigration, /CREATE TABLE IF NOT EXISTS public\.radio_health_checks/);
  assert.match(streamMonitoringMigration, /get_radio_health_alerts\(\)/);
  assert.match(streamMonitoringMigration, /trigger_radio_health_check\(\)/);
  assert.match(streamMonitoringMigration, /polyfauna-radio-health/);
  assert.match(streamMonitoringMigration, /polyfauna-radio-alert-email/);
  assert.match(radioHealthFunction, /radio\.mp3/);
  assert.match(radioHealthFunction, /radio-128\.mp3/);
  assert.match(radioHealthFunction, /radio-64\.mp3/);
  assert.match(radioHealthFunction, /radio_health_checks/);
  assert.match(adminDashboard, /supabase\.rpc\('get_radio_health_alerts'/);
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
  assert.match(eventTerminal, /trackUsageEvent\('checkout_error'/);
});

test('fase 7.7 agrega metricas en servidor y restringe el tablero a admin', () => {
  assert.match(metricsMigration, /CREATE OR REPLACE FUNCTION public\.get_usage_metrics/);
  assert.match(metricsMigration, /SECURITY INVOKER/);
  assert.match(metricsInvokerMigration, /ALTER FUNCTION public\.get_usage_metrics\(INTEGER\) SECURITY INVOKER/);
  assert.match(metricsMigration, /role = 'admin'/);
  assert.match(metricsMigration, /p_hours IN \(1, 6, 24, 168, 720\)/);
  assert.match(metricsMigration, /COUNT\(DISTINCT session_id\)/);
  assert.match(metricsMigration, /'event_view'/);
  assert.match(metricsMigration, /'checkout_start'/);
  assert.match(metricsMigration, /'checkout_ready'/);
  assert.match(metricsMigration, /'ticket_claimed'/);
  assert.match(metricsMigration, /REVOKE ALL ON FUNCTION public\.get_usage_metrics\(INTEGER\) FROM PUBLIC, anon, authenticated/);
  assert.match(metricsMigration, /GRANT EXECUTE ON FUNCTION public\.get_usage_metrics\(INTEGER\) TO authenticated/);
});

test('fase 7.7 muestra resumen, embudo, actividad y errores en admin', () => {
  assert.match(adminDashboard, /id: 'analytics'/);
  assert.match(adminDashboard, /function UsageMetricsSection/);
  assert.match(adminDashboard, /supabase\.rpc\('get_usage_metrics'/);
  assert.match(adminDashboard, /Conversión de eventos/);
  assert.match(adminDashboard, /Errores de checkout/);
});
