import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateOfflineTicket } from '../src/lib/offlineTicketRules.js';

const migration = readFileSync('supabase/migrations/20260702231304_courtesy_ticket_unregistered_recipients.sql', 'utf8');
const courtesyFunction = readFileSync('supabase/functions/issue-courtesy-ticket/index.ts', 'utf8');
const emailTemplates = readFileSync('supabase/functions/_shared/email-templates.ts', 'utf8');
const emailTemplatesGenerated = readFileSync('supabase/functions/_shared/email-templates.generated.ts', 'utf8');
const importScript = readFileSync('tools/import-email-templates.js', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const signupPage = readFileSync('src/pages/SignupPage.jsx', 'utf8');

test('issue_courtesy_ticket crea un ticket pendiente cuando el correo no tiene cuenta', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.issue_courtesy_ticket/);
  assert.doesNotMatch(migration, /RAISE EXCEPTION 'user_not_found'/);
  assert.match(migration, /'pending_registration', 1, v_email/);
  assert.match(migration, /identity_required.*solo aplica a/is);
  // el identity_required sigue exigiéndose para correos YA registrados
  assert.match(migration, /IF v_user_id IS NOT NULL THEN\s*\n\s*SELECT \* INTO v_identity FROM public\.user_identity/);
});

test('issue_courtesy_ticket evita doble emisión al mismo correo pendiente', () => {
  assert.match(migration, /user_id IS NULL\s*\n\s*AND lower\(assigned_email\) = v_email/);
  assert.match(migration, /'pending', v_existing\.user_id IS NULL/);
});

test('validate_ticket bloquea el escaneo de cortesías no activadas con mensaje explícito', () => {
  assert.match(migration, /PENDING_REGISTRATION/);
  assert.match(migration, /debe crear su cuenta en Polyfauna con ese correo/);
});

test('handle_new_user reclama automáticamente las cortesías pendientes al registrarse', () => {
  assert.match(migration, /UPDATE public\.user_tickets\s*\n\s*SET user_id = NEW\.id,\s*\n\s*status = 'valid',\s*\n\s*assigned_email = NULL\s*\n\s*WHERE status = 'pending_registration'/);
});

test('get_event_attendees muestra el correo de invitación mientras el ticket está pendiente', () => {
  assert.match(migration, /COALESCE\(users\.email, ticket\.assigned_email\)/);
});

test('edge function issue-courtesy-ticket envía la plantilla de cortesía pendiente sin push ni getUserById', () => {
  assert.doesNotMatch(courtesyFunction, /El correo no pertenece a una cuenta PolyFauna/);
  assert.match(courtesyFunction, /isPending/);
  assert.match(courtesyFunction, /courtesyPendingActivation/);
  assert.match(courtesyFunction, /signup_url/);
  assert.match(courtesyFunction, /if \(!isPending\) \{\s*\n\s*try \{\s*\n\s*const notificationResult = await dispatchNotification/);
});

test('la plantilla de cortesía pendiente está registrada y disponible para renderEmailTemplate', () => {
  assert.match(emailTemplatesGenerated, /"courtesyPendingActivation":/);
  assert.match(importScript, /courtesyPendingActivation: join\(clientRoot, 'plantillas\/07-cortesia-pendiente\.html'\)/);
  assert.match(emailTemplates, /EmailTemplateName = keyof typeof EMAIL_TEMPLATES/);
});

test('el panel de cortesías explica que los correos sin cuenta también reciben el QR', () => {
  assert.match(adminDashboard, /recibe el QR por correo con invitación a registrarse/);
  assert.match(adminDashboard, /Cortesía enviada · pendiente de activación/);
});

test('la lista de asistentes distingue el estado pendiente con su propia insignia', () => {
  assert.match(eventManager, /'PENDIENTE'/);
  assert.match(eventManager, /pending_registration/);
});

test('el signup prellena el correo cuando llega desde el enlace de invitación', () => {
  assert.match(signupPage, /email: searchParams\.get\('email'\) \|\| ''/);
});

test('evaluateOfflineTicket bloquea cortesías pendientes con mensaje propio, no el genérico', () => {
  const verified = { valid: true, payload: { tid: 't1', eid: 'e1' } };
  const pack = { eventId: 'e1', eventTitle: 'Evento', tickets: [{ id: 't1', status: 'pending_registration' }] };
  const result = evaluateOfflineTicket({ verified, eventId: 'e1', pack });
  assert.equal(result.code, 'PENDING_REGISTRATION');
  assert.match(result.error, /debe crear su cuenta en Polyfauna/);
});
