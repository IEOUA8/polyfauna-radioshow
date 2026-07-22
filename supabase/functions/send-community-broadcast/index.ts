import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { escapeEmailValue, publicEmailUrl, renderEmailTemplate } from '../_shared/email-templates.ts';
import { dispatchNotification } from '../_shared/notifications.ts';

// Batch size to avoid Resend rate limits
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Se requiere rol de administrador' }), {
        status: 403,
        headers: CORS_HEADERS,
      });
    }

    const payload = await req.json();
    const { subject, title, body, ctaLabel, ctaUrl, templateType = 'generic', templateData = {} } = payload;
    const broadcastId = typeof payload.broadcastId === 'string' && /^[0-9a-f-]{20,80}$/i.test(payload.broadcastId)
      ? payload.broadcastId
      : crypto.randomUUID();
    if (typeof subject !== 'string' || !subject.trim()) {
      return new Response(JSON.stringify({ error: 'El asunto es obligatorio' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }
    const safeSubject = subject.replace(/[\r\n]/g, ' ').trim().slice(0, 180);

    // Fetch all user emails via auth admin API
    const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('created_at');

    // Get emails from auth.users using service role
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    users?.forEach(u => { emailMap[u.id] = u.email || ''; });

    const recipients = (profilesData || [])
      .map(p => ({ id: p.id, email: emailMap[p.id], name: p.display_name || 'Raver' }))
      .filter(r => !!r.email);

    let html: string;
    if (templateType === 'radio-special') {
      const required = ['programName', 'artist', 'datetime', 'genre', 'bpm', 'listenUrl'];
      if (!required.every(key => typeof templateData[key] === 'string' && templateData[key].trim())) {
        return new Response(JSON.stringify({ error: 'Completa todos los datos del programa especial' }), { status: 400, headers: CORS_HEADERS });
      }
      html = renderEmailTemplate('radioSpecial', {
        program_name: templateData.programName,
        artist: templateData.artist,
        datetime: templateData.datetime,
        genre: templateData.genre,
        bpm: templateData.bpm,
        listen_url: publicEmailUrl(templateData.listenUrl, appUrl),
      });
    } else if (templateType === 'upcoming-events') {
      const required = ['eventName', 'eventDate', 'eventVenue', 'lineup', 'eventImage', 'ticketsUrl', 'event2Name', 'event2Date', 'event2Venue'];
      if (!required.every(key => typeof templateData[key] === 'string' && templateData[key].trim())) {
        return new Response(JSON.stringify({ error: 'Completa todos los datos de próximos eventos' }), { status: 400, headers: CORS_HEADERS });
      }
      html = renderEmailTemplate('upcomingEvents', {
        event_name: templateData.eventName,
        event_date: templateData.eventDate,
        event_venue: templateData.eventVenue,
        lineup: templateData.lineup,
        event_image: publicEmailUrl(templateData.eventImage),
        tickets_url: publicEmailUrl(templateData.ticketsUrl, appUrl),
        event2_name: templateData.event2Name,
        event2_date: templateData.event2Date,
        event2_venue: templateData.event2Venue,
      });
    } else {
      if (![title, body].every(value => typeof value === 'string' && value.trim())) {
        return new Response(JSON.stringify({ error: 'Título y mensaje son obligatorios' }), { status: 400, headers: CORS_HEADERS });
      }
      const safeBody = escapeEmailValue(body).replace(/\n/g, '<br/>');
      const safeCta = ctaLabel && ctaUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:12px;"><a href="${escapeEmailValue(publicEmailUrl(ctaUrl, appUrl))}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:12px;"><span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">${escapeEmailValue(ctaLabel)}</span></a></td></tr></table>`
        : '';
      html = emailWrapper(`
        <h1 style="margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#ECECEC !important;">${escapeEmailValue(title)}</h1>
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#9A9A9A !important;line-height:1.7;margin-bottom:28px;">${safeBody}</div>
        ${safeCta}
      `);
    }

    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(r => sendEmail({
          to: r.email,
          subject: safeSubject,
          html,
          idempotencyKey: `community-broadcast/${broadcastId}/${r.id}`,
          tags: [
            { name: 'category', value: 'community_broadcast' },
            { name: 'entity_id', value: broadcastId },
          ],
        }))
      );
      sent += results.filter(result => result.status === 'fulfilled').length;
      if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
    }

    const notification = templateType === 'radio-special'
      ? {
          notificationType: 'radio' as const,
          actionSection: 'radio-console',
          title: 'Transmisión especial en vivo',
          body: `${templateData.programName} · ${templateData.artist}`,
          url: publicEmailUrl(templateData.listenUrl, appUrl),
        }
      : templateType === 'upcoming-events'
        ? {
            notificationType: 'event' as const,
            actionSection: 'events',
            title: 'Próximos eventos en Polyfauna',
            body: `${templateData.eventName} · ${templateData.event2Name}`,
            url: `${appUrl}/?section=events`,
          }
        : {
            notificationType: 'system' as const,
            actionSection: undefined,
            title: String(title).trim(),
            body: String(body).trim(),
            url: ctaUrl ? publicEmailUrl(ctaUrl, appUrl) : appUrl,
          };

    await dispatchNotification({
      broadcast: true,
      ...notification,
      dedupeKey: `community-broadcast/${broadcastId}`,
      emailDelivery: {
        status: sent > 0 ? 'sent' : 'failed',
        metadata: { sent, attempted: recipients.length, broadcastId },
      },
    });

    return new Response(JSON.stringify({ ok: true, sent, broadcastId }), { headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
});
