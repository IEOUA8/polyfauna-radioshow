import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildVisitorContext } from '../api/visitor-context.js';

const migration = readFileSync('supabase/migrations/20260718160000_audience_analytics.sql', 'utf8');
const telemetry = readFileSync('src/lib/telemetry.js', 'utf8');
const collector = readFileSync('supabase/functions/collect-usage-event/index.ts', 'utf8');
const dashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const editProfile = readFileSync('src/components/EditProfile.jsx', 'utf8');

test('el contexto de visita usa geografía de Vercel y clasifica el dispositivo sin exponer IP', () => {
  const context = buildVisitorContext({
    'x-vercel-ip-country': 'co',
    'x-vercel-ip-country-region': 'DC',
    'x-vercel-ip-city': 'Bogot%C3%A1',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  assert.deepEqual(context, {
    country_code: 'CO',
    region: 'DC',
    city: 'Bogotá',
    device_type: 'mobile',
    os_name: 'iOS',
    browser_name: 'Safari',
  });
  assert.doesNotMatch(readFileSync('api/visitor-context.js', 'utf8'), /x-forwarded-for|client-ip/i);
});

test('la telemetría persiste ciudad y dispositivo como dimensiones agregables', () => {
  for (const key of ['country_code', 'region', 'city', 'device_type', 'os_name', 'browser_name']) {
    assert.match(telemetry, new RegExp(`'${key}'`));
    assert.match(collector, new RegExp(`'${key}'`));
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${key}`));
  }
  assert.match(telemetry, /fetch\('\/api\/visitor-context'/);
  assert.match(migration, /'page_views'/);
  assert.match(migration, /'cities'/);
  assert.match(migration, /'devices'/);
});

test('la demografía es voluntaria, privada y el admin recibe únicamente agregados', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_demographics/);
  assert.match(migration, /user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_audience_demographics/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.doesNotMatch(migration, /user_demographics_admin/);
  assert.match(editProfile, /Autorizo el uso de estos datos para estadísticas agregadas/);
  assert.match(editProfile, /set_user_demographics/);
  assert.match(editProfile, /Prefiero no responder/);
});

test('el panel muestra visitas, ciudades, dispositivos, género, edad y cobertura', () => {
  assert.match(dashboard, /label="Visitas"/);
  assert.match(dashboard, /Ciudades principales/);
  assert.match(dashboard, /Tipo de dispositivo/);
  assert.match(dashboard, /title: 'Género'/);
  assert.match(dashboard, /title: 'Rangos de edad'/);
  assert.match(dashboard, /Cobertura:/);
  assert.match(dashboard, /get_audience_demographics/);
});
