import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAnalyticsWindow,
  normalizeAggregateRows,
  normalizeAnalyticsHours,
} from '../api/vercel-analytics.js';

const endpoint = readFileSync('api/vercel-analytics.js', 'utf8');
const dashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

test('normaliza solo las ventanas permitidas por el tablero', () => {
  assert.equal(normalizeAnalyticsHours('1'), 1);
  assert.equal(normalizeAnalyticsHours('168'), 168);
  assert.equal(normalizeAnalyticsHours(['720']), 720);
  assert.equal(normalizeAnalyticsHours('12'), 24);
  assert.equal(normalizeAnalyticsHours('invalid'), 24);
});

test('adapta ventanas subdiarias al mínimo diario de Vercel', () => {
  const window = buildAnalyticsWindow(6, Date.parse('2026-07-21T15:30:00.000Z'));
  assert.deepEqual(window, {
    requestedHours: 6,
    effectiveHours: 24,
    since: '2026-07-21T00:00:00.000Z',
    until: '2026-07-22T00:00:00.000Z',
  });

  const weekly = buildAnalyticsWindow(168, Date.parse('2026-07-21T15:30:00.000Z'));
  assert.equal(weekly.effectiveHours, 168);
  assert.equal(weekly.since, '2026-07-15T00:00:00.000Z');
  assert.equal(weekly.until, '2026-07-22T00:00:00.000Z');
});

test('sanitiza agregados externos antes de enviarlos al navegador', () => {
  const rows = normalizeAggregateRows({
    data: [
      { requestPath: '/eventos', visitors: 4, pageviews: 7 },
      { requestPath: '', visitors: -2, pageviews: 'invalid' },
    ],
  }, 'requestPath', '/');

  assert.deepEqual(rows, [
    { key: '/eventos', visitors: 4, pageviews: 7 },
    { key: '/', visitors: 0, pageviews: 0 },
  ]);
});

test('la conexión mantiene credenciales en servidor y exige rol admin', () => {
  assert.match(endpoint, /VERCEL_ANALYTICS_ACCESS_TOKEN/);
  assert.match(endpoint, /\/auth\/v1\/user/);
  assert.match(endpoint, /profiles\?*/);
  assert.match(endpoint, /role !== 'admin'/);
  assert.match(endpoint, /Cache-Control', 'private, no-store/);
  assert.doesNotMatch(dashboard, /VERCEL_ANALYTICS_ACCESS_TOKEN/);
  assert.match(envExample, /never prefix the access token with VITE_/);
});

test('el tablero enriquece métricas con adquisición sin mezclar conversiones internas', () => {
  assert.match(dashboard, /\/api\/vercel-analytics\?hours=/);
  assert.match(dashboard, /Adquisición y contenido · Vercel Analytics/);
  assert.match(dashboard, /Páginas principales/);
  assert.match(dashboard, /Fuentes de tráfico/);
  assert.match(dashboard, /Estos conteos complementan las sesiones y conversiones internas; no se suman entre sí/);
});
