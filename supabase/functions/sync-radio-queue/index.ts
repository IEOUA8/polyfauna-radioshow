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
// Distinto del VITE_AZURACAST_API_KEY del cliente (ese no existe, nunca se
// uso) — esta key vive solo en secrets de la Edge Function, jamas en un
// bundle que llegue al navegador. El endpoint de cola de AzuraCast exige
// autenticacion; no hay forma publica de leerlo.
const API_KEY = Deno.env.get('AZURACAST_API_KEY') || '';
const MAX_QUEUE_ITEMS = 10;

type AzuraFile = {
  song_id: string;
  genre?: string;
  length?: number;
  art?: string;
};

type QueueItem = {
  artist: string;
  title: string;
  song_id: string;
};

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
  if (!response.ok) throw new Error(`azuracast_http_${response.status}`);
  return response.json();
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

  if (!API_KEY) return json({ error: 'AZURACAST_API_KEY not configured' }, 500);

  try {
    const playlists = await fetchJson(`${API_BASE}/station/${STATION}/playlists`);
    const enabled = (Array.isArray(playlists) ? playlists : [])
      .filter((p: { is_enabled?: boolean; type?: string }) => p.is_enabled && p.type === 'default');

    const queues = await Promise.all(
      enabled.map((p: { id: number }) =>
        fetchJson(`${API_BASE}/station/${STATION}/playlist/${p.id}/queue`).catch(() => [])
      )
    );
    const rawQueue: QueueItem[] = queues.flat();

    const files: AzuraFile[] = await fetchJson(`${API_BASE}/station/${STATION}/files?rows=200`).catch(() => []);
    const bySongId = new Map(files.map((f) => [f.song_id, f]));

    const queue = rawQueue.slice(0, MAX_QUEUE_ITEMS).map((item) => {
      const meta = bySongId.get(item.song_id);
      return {
        artist: item.artist || '',
        title: item.title || '',
        genre: meta?.genre || null,
        duration_seconds: meta?.length || null,
        art: meta?.art || null,
      };
    });

    await admin.from('radio_queue_cache').delete().neq('id', 0);
    const { error } = await admin.from('radio_queue_cache').insert({ queue });
    if (error) return json({ error: 'Could not persist radio queue' }, 500);

    return json({ ok: true, count: queue.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'sync_failed' }, 500);
  }
});
