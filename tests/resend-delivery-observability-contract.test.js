import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sharedResend = readFileSync('supabase/functions/_shared/resend.ts', 'utf8');
const webhook = readFileSync('supabase/functions/resend-webhook/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260715210000_resend_delivery_observability.sql', 'utf8');
const privacy = readFileSync('src/components/ControlCenter.jsx', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

test('Resend expone id de envio, idempotencia y tags sin PII', () => {
  assert.match(sharedResend, /Promise<SendEmailResult>/);
  assert.match(sharedResend, /requestHeaders\['Idempotency-Key'\]/);
  assert.match(sharedResend, /tags: validateTags\(tags\)/);
  assert.match(sharedResend, /return \{ id: data\.id \}/);
});

test('webhook verifica el cuerpo crudo y persiste eventos deduplicables', () => {
  assert.match(webhook, /const rawBody = await req\.text\(\)/);
  assert.match(webhook, /new Webhook\(webhookSecret\)\.verify\(rawBody/);
  assert.match(webhook, /req\.headers\.get\('svix-id'\)/);
  assert.match(webhook, /rpc\('record_resend_email_event'/);
  assert.doesNotMatch(webhook, /p_(recipient|subject|body)/);
});

test('tablas de entrega quedan cerradas a clientes y RPC solo para service role', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_delivery_events/);
  assert.match(migration, /svix_id\s+TEXT PRIMARY KEY/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.email_delivery_events FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /SET search_path = public/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_resend_email_event[\s\S]+TO service_role/);
});

test('entorno y politica explican el nuevo tratamiento operativo', () => {
  assert.match(envExample, /^RESEND_WEBHOOK_SECRET=whsec_xxx$/m);
  assert.match(privacy, /Proveedores y transmisión de datos/);
  assert.match(privacy, /dentro o fuera de Colombia/);
});
