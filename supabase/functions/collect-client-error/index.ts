import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, max: number) => String(value ?? '')
  .replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(req.headers.get('content-length') || 0) > 16_384) return json({ error: 'Payload too large' }, 413);

  try {
    const { admin, user } = await requireUser(req);
    const body = await req.json();
    const sessionId = clean(body.sessionId, 36);
    const severity = ['warning', 'error', 'fatal'].includes(body.severity) ? body.severity : 'error';
    const message = clean(body.message, 500);
    if (!UUID.test(sessionId) || !message) return json({ error: 'Datos inválidos' }, 400);

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from('client_errors').select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId).gte('created_at', since);
    if ((count || 0) >= 5) return json({ ok: true, throttled: true });

    const routeValue = clean(body.route, 300);
    let route = routeValue;
    try {
      const parsed = new URL(routeValue, 'https://www.polyfauna.com');
      route = parsed.pathname;
    } catch (_) {}

    const allowedContext: Record<string, string | number | boolean | null> = {};
    if (body.context && typeof body.context === 'object') {
      for (const key of ['component', 'action', 'release']) {
        const value = body.context[key];
        if (['string', 'number', 'boolean'].includes(typeof value) || value === null)
          allowedContext[key] = typeof value === 'string' ? clean(value, 120) : value;
      }
    }

    const { error } = await admin.from('client_errors').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      severity,
      message,
      source: clean(body.source, 120) || null,
      route: route || null,
      stack: clean(body.stack, 4000) || null,
      context: allowedContext,
    });
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    console.error('collect-client-error:', err);
    return json({ error: 'No se pudo registrar el incidente' }, 500);
  }
});
