import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8192;
const MAX_EVENTS_PER_MINUTE = 24;

const ALLOWED_EVENTS = new Set([
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
]);

const ALLOWED_PROPERTIES = new Set([
  'content_id',
  'event_id',
  'media_type',
  'mode',
  'status',
  'price_tier',
  'quantity',
  'section',
  'error_code',
  'quality',
  'reason',
  'attempt',
  'delay_ms',
  'duration_ms',
  'network_type',
  'country_code',
  'region',
  'city',
  'device_type',
  'os_name',
  'browser_name',
]);

const clean = (value: unknown, max: number) => String(value ?? '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, max);

function pathnameOnly(value: unknown): string | null {
  const raw = clean(value, 300);
  if (!raw) return null;
  try {
    const parsed = new URL(raw, 'https://www.polyfauna.com');
    return parsed.pathname.slice(0, 300) || '/';
  } catch (_) {
    return raw.startsWith('/') ? raw.slice(0, 300) : null;
  }
}

function sanitizeProperties(value: unknown): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return sanitized;

  for (const key of ALLOWED_PROPERTIES) {
    const prop = (value as Record<string, unknown>)[key];
    if (typeof prop === 'string') sanitized[key] = clean(prop, 80);
    else if (typeof prop === 'number' && Number.isFinite(prop)) sanitized[key] = prop;
    else if (typeof prop === 'boolean' || prop === null) sanitized[key] = prop;
  }

  return sanitized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);

  try {
    const { admin, user } = await requireUser(req);
    const body = await req.json();
    const sessionId = clean(body.sessionId, 36);
    const eventName = clean(body.eventName, 80);

    if (!UUID.test(sessionId) || !ALLOWED_EVENTS.has(eventName)) {
      return json({ error: 'Datos invalidos' }, 400);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .gte('created_at', since);

    if ((count || 0) >= MAX_EVENTS_PER_MINUTE) return json({ ok: true, throttled: true });

    const properties = sanitizeProperties(body.properties);
    const countryCode = clean(properties.country_code, 2).toUpperCase();
    const deviceType = clean(properties.device_type, 20);

    const { error } = await admin.from('usage_events').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      event_name: eventName,
      route: pathnameOnly(body.route),
      referrer: pathnameOnly(body.referrer),
      release: clean(body.release, 120) || null,
      properties,
      country_code: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
      region: clean(properties.region, 80) || null,
      city: clean(properties.city, 80) || null,
      device_type: ['mobile', 'tablet', 'desktop'].includes(deviceType) ? deviceType : null,
      os_name: clean(properties.os_name, 80) || null,
      browser_name: clean(properties.browser_name, 80) || null,
    });

    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    console.error('collect-usage-event:', err);
    return json({ error: 'No se pudo registrar telemetria' }, 500);
  }
});
