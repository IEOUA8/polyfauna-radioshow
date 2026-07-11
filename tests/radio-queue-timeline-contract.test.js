import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectQueueTimes } from '../src/lib/radioQueueTiming.js';

const timing = readFileSync('src/lib/radioQueueTiming.js', 'utf8');
const queueHook = readFileSync('src/hooks/useRadioQueue.js', 'utf8');
const timeline = readFileSync('src/components/RadioQueueTimeline.jsx', 'utf8');
const radioConsole = readFileSync('src/components/RadioConsolePage.jsx', 'utf8');
const nowPlaying = readFileSync('src/hooks/useNowPlaying.js', 'utf8');
const migration = readFileSync('supabase/migrations/20260711000003_radio_queue_cache.sql', 'utf8');
const syncFunction = readFileSync('supabase/functions/sync-radio-queue/index.ts', 'utf8');

test('la cola de AzuraCast se sincroniza server-side, la API key nunca llega al cliente', () => {
  // El endpoint de cola de AzuraCast exige X-API-Key — llamarlo directo
  // desde el navegador expondria la key a cualquiera que inspeccione el
  // bundle. Debe vivir solo en la Edge Function, como secret de servidor.
  assert.match(syncFunction, /Deno\.env\.get\('AZURACAST_API_KEY'\)/);
  assert.doesNotMatch(radioConsole, /AZURACAST_API_KEY/);
  assert.doesNotMatch(timeline, /AZURACAST_API_KEY/);
  assert.doesNotMatch(queueHook, /X-API-Key/);
});

test('la Edge Function verifica x-cron-secret antes de sincronizar', () => {
  assert.match(syncFunction, /verify_cron_alert_secret/);
  assert.match(syncFunction, /x-cron-secret/);
});

test('radio_queue_cache es de lectura publica, escritura solo service_role, con cron cada 3 min', () => {
  assert.match(migration, /CREATE POLICY radio_queue_cache_public_read ON public\.radio_queue_cache\s*\n\s*FOR SELECT USING \(true\)/);
  assert.match(migration, /GRANT ALL ON public\.radio_queue_cache TO service_role/);
  assert.match(migration, /cron\.schedule\('polyfauna-radio-queue-sync', '\*\/3 \* \* \* \*'/);
});

test('la proyeccion de hora usa la zona horaria de Bogota, no la del navegador', () => {
  assert.match(timing, /timeZone: 'America\/Bogota'/);
});

test('projectQueueTimes acumula la duracion restante del track actual mas cada item previo', () => {
  const now = new Date('2026-07-11T12:00:00-05:00');
  const queue = [
    { title: 'A', duration_seconds: 600 },
    { title: 'B', duration_seconds: 300 },
  ];
  const result = projectQueueTimes(queue, 120, now);
  assert.equal(result[0].startsAt.getTime(), now.getTime() + 120_000);
  assert.equal(result[1].startsAt.getTime(), now.getTime() + 120_000 + 600_000);
});

test('useNowPlaying expone remainingSeconds del track en vivo', () => {
  assert.match(nowPlaying, /remainingSeconds: isOnline \? \(data\.now_playing\?\.remaining \?\? 0\) : 0/);
});

test('RadioQueueTimeline muestra hasta 6 proximos ademas de "Ahora", con genero y duracion', () => {
  assert.match(timeline, /const MAX_UPCOMING = 6;/);
  assert.match(timeline, /AHORA|Ahora/);
  assert.match(timeline, /item\.genre/);
  assert.match(timeline, /formatDuration\(item\.duration_seconds\)/);
});
