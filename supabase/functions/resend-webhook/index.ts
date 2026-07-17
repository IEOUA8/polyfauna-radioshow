import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'npm:svix@1.97.0';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface ResendEventData {
  email_id?: unknown;
  tags?: unknown;
  bounce?: unknown;
  failed?: unknown;
  error?: unknown;
  reason?: unknown;
}

interface ResendWebhookEvent {
  type?: unknown;
  created_at?: unknown;
  data?: ResendEventData;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function tagValue(tags: unknown, name: string): string | null {
  if (Array.isArray(tags)) {
    const match = tags.find((tag) => tag && typeof tag === 'object' && 'name' in tag && tag.name === name);
    if (match && 'value' in match && typeof match.value === 'string') return match.value;
  }
  if (tags && typeof tags === 'object' && name in tags) {
    const value = (tags as Record<string, unknown>)[name];
    if (typeof value === 'string') return value;
  }
  return null;
}

function nestedMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['message', 'reason', 'type', 'subType']) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  return null;
}

function deliveryReason(data: ResendEventData): string | null {
  return nestedMessage(data.bounce)
    || nestedMessage(data.failed)
    || nestedMessage(data.error)
    || nestedMessage(data.reason);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('resend-webhook is missing required secrets');
    return json({ error: 'Webhook not configured' }, 500);
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return json({ error: 'Missing signature headers' }, 400);
  }

  const rawBody = await req.text();
  let event: ResendWebhookEvent;
  try {
    event = new Webhook(webhookSecret).verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent;
  } catch (error) {
    console.warn('Rejected invalid Resend webhook signature', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Invalid signature' }, 400);
  }

  const eventType = typeof event.type === 'string' ? event.type : '';
  if (!eventType.startsWith('email.')) return json({ ok: true, ignored: true });

  const data = event.data || {};
  const resendEmailId = typeof data.email_id === 'string' ? data.email_id : '';
  const occurredAt = typeof event.created_at === 'string' && Number.isFinite(Date.parse(event.created_at))
    ? event.created_at
    : new Date().toISOString();
  if (!resendEmailId) return json({ error: 'Missing email id' }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: inserted, error } = await admin.rpc('record_resend_email_event', {
    p_svix_id: svixId,
    p_resend_email_id: resendEmailId,
    p_event_type: eventType,
    p_occurred_at: occurredAt,
    p_category: tagValue(data.tags, 'category'),
    p_entity_id: tagValue(data.tags, 'entity_id'),
    p_reason: deliveryReason(data),
  });

  if (error) {
    console.error('Could not persist Resend webhook event', error.message);
    return json({ error: 'Persistence failed' }, 500);
  }

  return json({ ok: true, duplicate: inserted === false });
});
