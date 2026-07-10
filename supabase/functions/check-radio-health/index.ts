import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
  'Content-Type': 'application/json',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const API_BASE = Deno.env.get('AZURACAST_API_URL') || 'https://radio.polyfauna.com/api';
const STATION = Deno.env.get('AZURACAST_STATION') || 'polyfauna';
const STREAM_BASE = Deno.env.get('RADIO_STREAM_BASE_URL') || 'https://radio.polyfauna.com/listen/polyfauna';
const MOUNTS = [
  { name: 'high', file: 'radio.mp3', bitrate: 192 },
  { name: 'medium', file: 'radio-128.mp3', bitrate: 128 },
  { name: 'low', file: 'radio-64.mp3', bitrate: 64 },
];

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Polyfauna-Radio-Monitor/1.0' } });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeMount(mount: typeof MOUNTS[number]) {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(`${STREAM_BASE}/${mount.file}`, 8_000);
    const reader = response.body?.getReader();
    const firstChunk = reader ? await reader.read() : { value: null, done: true };
    await reader?.cancel();
    const contentType = response.headers.get('content-type') || '';
    const bytes = firstChunk.value?.byteLength || 0;
    return {
      ...mount,
      ok: response.ok && contentType.startsWith('audio/') && bytes > 0,
      status: response.status,
      bytes,
      latency_ms: Date.now() - startedAt,
      reported_bitrate: Number(response.headers.get('icy-br') || 0) || null,
    };
  } catch (error) {
    return {
      ...mount,
      ok: false,
      status: 0,
      bytes: 0,
      latency_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.name : 'probe_failed',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const providedSecret = req.headers.get('x-cron-secret') || '';
  const { data: isValid } = await admin.rpc('verify_cron_alert_secret', { p_secret: providedSecret });
  if (!isValid) return json({ error: 'Unauthorized' }, 401);

  const startedAt = Date.now();
  let apiOk = false;
  let isOnline = false;
  let apiError: string | null = null;
  try {
    const response = await fetchWithTimeout(`${API_BASE}/nowplaying/${STATION}`, 6_000);
    const payload = response.ok ? await response.json() : null;
    apiOk = response.ok && payload !== null;
    isOnline = payload?.is_online === true;
    if (!response.ok) apiError = `api_http_${response.status}`;
  } catch (error) {
    apiError = error instanceof Error ? error.name : 'api_failed';
  }

  const mounts = await Promise.all(MOUNTS.map(probeMount));
  const healthy = apiOk && isOnline && mounts.every((mount) => mount.ok);
  const errorCode = healthy
    ? null
    : !apiOk ? (apiError || 'api_unavailable')
    : !isOnline ? 'station_offline'
    : 'mount_unavailable';

  const { error } = await admin.from('radio_health_checks').insert({
    healthy,
    api_ok: apiOk,
    is_online: isOnline,
    mounts,
    latency_ms: Date.now() - startedAt,
    error_code: errorCode,
  });
  if (error) return json({ error: 'Could not persist radio health check' }, 500);

  return json({ ok: true, healthy, api_ok: apiOk, is_online: isOnline, mounts, error_code: errorCode });
});
