import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @deno-types="npm:@types/web-push"
import webpush from 'npm:web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const ADMIN_EMAIL       = Deno.env.get('ADMIN_EMAIL') || 'admin@polyfauna.com';
const APP_URL           = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
const MAX_BODY_BYTES    = 8192;

webpush.setVapidDetails(
  `mailto:${ADMIN_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { userId, broadcast, title, body, url, icon, image } = await req.json();
    const safeTitle = cleanText(title, 90);
    const safeBody = cleanText(body, 220);
    if (!safeTitle || (!broadcast && !userId)) {
      return new Response(JSON.stringify({ error: 'Payload inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const { data: { user } } = isServiceRole
      ? { data: { user: null } }
      : await supabase.auth.getUser(token);

    let isAdmin = false;
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      isAdmin = profile?.role === 'admin';
    }

    if (broadcast && !isServiceRole && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin required for broadcast push' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!broadcast && userId && !isServiceRole && !isAdmin && user?.id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: safeTitle,
      body: safeBody,
      url: safeNotificationUrl(url),
      icon: typeof icon === 'string' ? safeNotificationUrl(icon) : undefined,
      image: typeof image === 'string' ? safeNotificationUrl(image) : undefined,
    });

    let subscriptions: { endpoint: string; p256dh: string; auth_key: string }[] = [];

    if (broadcast) {
      const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key');
      subscriptions = data || [];
    } else if (userId) {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .eq('user_id', userId);
      subscriptions = data || [];
    }

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload,
        )
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Clean up expired subscriptions (410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const err = (r as PromiseRejectedResult).reason;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });
    if (expiredEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
