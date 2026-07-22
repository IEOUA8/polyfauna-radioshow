import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @deno-types="npm:@types/web-push"
import webpush from 'npm:web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'info@polyfauna.com';
const APP_URL = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAX_BODY_BYTES = 8192;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTIFICATION_TYPES = new Set(['radio', 'podcast', 'event', 'blog', 'system', 'ticket']);

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${SUPPORT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function safeNotificationUrl(value: unknown) {
  try {
    const app = new URL(APP_URL);
    const parsed = new URL(String(value || APP_URL), app.origin);
    if (parsed.origin !== app.origin) return app.origin;
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch (_) {
    return APP_URL;
  }
}

function safeAssetUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = new URL(value, new URL(APP_URL).origin);
    if (!['https:', 'http:'].includes(parsed.protocol)) return undefined;
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch (_) {
    return undefined;
  }
}

function inferSection(url: string, explicit: unknown) {
  const section = cleanText(explicit, 40);
  if (section) return section;
  try {
    return cleanText(new URL(url).searchParams.get('section'), 40) || null;
  } catch (_) {
    return null;
  }
}

function inferType(explicit: unknown, section: string | null) {
  const candidate = cleanText(explicit, 20);
  if (NOTIFICATION_TYPES.has(candidate)) return candidate;
  if (section === 'events') return 'event';
  if (section === 'tickets') return 'ticket';
  if (section === 'podcasts') return 'podcast';
  if (section === 'blog') return 'blog';
  if (section === 'radio-console') return 'radio';
  return 'system';
}

async function recordDeliveries(
  supabase: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;
  const { error } = await supabase.from('notification_deliveries').insert(rows);
  if (error) console.error('notification delivery log failed:', error.message);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY);
    const payload = await req.json();
    const {
      userId, broadcast, title, body, url, icon, image, actionId, dedupeKey,
      persist = true, emailDelivery,
    } = payload;
    const safeTitle = cleanText(title, 90);
    const safeBody = cleanText(body, 220);
    const safeUrl = safeNotificationUrl(url);
    const actionSection = inferSection(safeUrl, payload.actionSection);
    const notificationType = inferType(payload.notificationType, actionSection);
    const safeActionId = typeof actionId === 'string' && UUID_RE.test(actionId) ? actionId : null;
    const safeDedupeKey = cleanText(dedupeKey, 180) || null;

    if (!safeTitle || (!broadcast && !userId)) return json({ error: 'Payload inválido' }, 400);

    const isServiceRole = Boolean(SERVICE_ROLE_KEY) && token === SERVICE_ROLE_KEY;
    const { data: { user } } = isServiceRole
      ? { data: { user: null } }
      : await supabase.auth.getUser(token);

    let isAdmin = false;
    if (user?.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      isAdmin = profile?.role === 'admin';
    }

    let canBroadcastEvent = false;
    if (broadcast && user?.id && notificationType === 'event' && safeActionId) {
      const [{ data: event }, { data: collaboration }] = await Promise.all([
        supabase.from('events').select('owner_id').eq('id', safeActionId).maybeSingle(),
        supabase.from('event_co_promoters').select('id').eq('event_id', safeActionId)
          .eq('promoter_id', user.id).eq('status', 'active').maybeSingle(),
      ]);
      canBroadcastEvent = event?.owner_id === user.id || Boolean(collaboration);
    }

    if (broadcast && !isServiceRole && !isAdmin && !canBroadcastEvent) {
      return json({ error: 'Admin or event owner required for broadcast push' }, 403);
    }
    if (!broadcast && userId && !isServiceRole && !isAdmin && user?.id !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    let notificationId: string | null = null;
    if (persist !== false) {
      if (safeDedupeKey) {
        const { data: existing } = await supabase
          .from('notifications').select('id').eq('dedupe_key', safeDedupeKey).maybeSingle();
        if (existing?.id) {
          return json({ notificationId: existing.id, sent: 0, failed: 0, duplicate: true });
        }
      }

      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: broadcast ? null : userId,
          type: notificationType,
          title: safeTitle,
          body: safeBody || null,
          image_url: safeAssetUrl(image) || null,
          action_section: actionSection,
          action_id: safeActionId,
          action_url: safeUrl,
          dedupe_key: safeDedupeKey,
        })
        .select('id')
        .single();

      if (notificationError) {
        if (notificationError.code === '23505' && safeDedupeKey) {
          const { data: existing } = await supabase
            .from('notifications').select('id').eq('dedupe_key', safeDedupeKey).single();
          return json({ notificationId: existing?.id, sent: 0, failed: 0, duplicate: true });
        }
        throw notificationError;
      }
      notificationId = notification.id;

      await recordDeliveries(supabase, [{
        notification_id: notificationId,
        user_id: broadcast ? null : userId,
        channel: 'in_app',
        status: 'sent',
      }]);

      if (emailDelivery && typeof emailDelivery === 'object') {
        await recordDeliveries(supabase, [{
          notification_id: notificationId,
          user_id: broadcast ? null : userId,
          channel: 'email',
          status: ['sent', 'failed', 'skipped'].includes(emailDelivery.status)
            ? emailDelivery.status
            : 'sent',
          provider_message_id: cleanText(emailDelivery.providerMessageId, 200) || null,
          error: cleanText(emailDelivery.error, 500) || null,
          metadata: emailDelivery.metadata && typeof emailDelivery.metadata === 'object'
            ? emailDelivery.metadata
            : {},
        }]);
      }
    }

    const tag = cleanText(payload.tag, 120)
      || (notificationId ? `polyfauna-${notificationType}-${notificationId}` : `polyfauna-test-${userId}`);
    if (notificationId) {
      const { error: tagError } = await supabase.from('notifications').update({ tag }).eq('id', notificationId);
      if (tagError) console.error('notification tag update failed:', tagError.message);
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      if (persist === false) {
        return json({ error: 'Web Push no está configurado en el servidor' }, 503);
      }
      if (notificationId) {
        await recordDeliveries(supabase, [{
          notification_id: notificationId,
          user_id: broadcast ? null : userId,
          channel: 'push',
          status: 'skipped',
          metadata: { reason: 'server_not_configured' },
        }]);
      }
      return json({
        notificationId,
        sent: 0,
        failed: 0,
        pushConfigured: false,
        warning: 'Web Push no está configurado en el servidor',
      });
    }

    const pushPayload = JSON.stringify({
      title: safeTitle,
      body: safeBody,
      url: safeUrl,
      icon: safeAssetUrl(icon),
      image: safeAssetUrl(image),
      tag,
      notificationId,
    });

    let subscriptions: { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string }[] = [];
    if (broadcast) {
      const { data } = await supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth_key');
      subscriptions = data || [];
    } else if (userId) {
      const { data } = await supabase.from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth_key').eq('user_id', userId);
      subscriptions = data || [];
    }

    if (subscriptions.length === 0) {
      if (notificationId) {
        await recordDeliveries(supabase, [{
          notification_id: notificationId,
          user_id: broadcast ? null : userId,
          channel: 'push',
          status: 'skipped',
          metadata: { reason: 'no_subscriptions' },
        }]);
      }
      return json({ notificationId, sent: 0, failed: 0 });
    }

    const results = await Promise.allSettled(subscriptions.map((sub) =>
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      }, pushPayload)
    ));

    const expiredEndpoints: string[] = [];
    const deliveryRows = results.map((result, index) => {
      const subscription = subscriptions[index];
      if (result.status === 'fulfilled') {
        return {
          notification_id: notificationId,
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          channel: 'push',
          status: 'sent',
        };
      }
      const reason = result.reason as { statusCode?: number; message?: string };
      if (reason?.statusCode === 404 || reason?.statusCode === 410) expiredEndpoints.push(subscription.endpoint);
      return {
        notification_id: notificationId,
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        channel: 'push',
        status: 'failed',
        error: cleanText(reason?.message || 'Push delivery failed', 500),
        metadata: { statusCode: reason?.statusCode || null },
      };
    });

    if (notificationId) await recordDeliveries(supabase, deliveryRows);
    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    const sent = results.filter((result) => result.status === 'fulfilled').length;
    return json({ notificationId, sent, failed: results.length - sent });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
