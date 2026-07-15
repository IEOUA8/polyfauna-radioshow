import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260715180000_manual_ticket_unregistered_recipients.sql', 'utf8');
const edgeFunction = readFileSync('supabase/functions/issue-manual-ticket/index.ts', 'utf8');
const ticketEmailRules = readFileSync('supabase/functions/_shared/ticket-email-rules.ts', 'utf8');
const templatesGenerated = readFileSync('supabase/functions/_shared/email-templates.generated.ts', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

test('la venta manual permite destinatarios sin cuenta y deja el ticket pendiente', () => {
  assert.match(migration, /CREATE FUNCTION public\.issue_manual_transfer_ticket/);
  assert.doesNotMatch(migration, /RAISE EXCEPTION 'user_not_found'/);
  assert.match(migration, /CASE WHEN v_user_id IS NULL THEN 'pending_registration' ELSE 'valid' END/);
  assert.match(migration, /CASE WHEN v_user_id IS NULL THEN v_email ELSE NULL END/);
  assert.match(migration, /'pending', v_user_id IS NULL/);
});

test('la venta manual separa la referencia libre de la llave tecnica idempotente', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sale_reference TEXT/);
  assert.match(migration, /'manual_sale', v_reference, v_sale_reference/);
  assert.match(migration, /v_reference := 'MANUAL-'/);
  assert.match(migration, /p_issuance_key TEXT/);
  assert.match(edgeFunction, /p_issuance_key: normalizedIssuanceKey/);
  assert.match(adminDashboard, /Referencia de venta/);
  assert.match(adminDashboard, /Efectivo, transferencia, cortesía comercial/);
});

test('el registro con el mismo correo activa el ticket y enlaza la transaccion', () => {
  assert.match(migration, /UPDATE public\.user_tickets[\s\S]*status = 'valid'[\s\S]*lower\(assigned_email\) = lower\(NEW\.email\)/);
  assert.match(migration, /UPDATE public\.transactions AS transaction[\s\S]*SET buyer_id = NEW\.id/);
});

test('el correo pendiente explica el registro y conserva las reglas Early', () => {
  assert.match(templatesGenerated, /"manualTicketPendingActivation":/);
  assert.match(templatesGenerated, /Crear mi cuenta y activar ticket/);
  assert.match(ticketEmailRules, /renderPendingTicketActivationEmail/);
  assert.match(ticketEmailRules, /injectEarlyTicketRules\(html, variables\.ticket_type, tier\)/);
  assert.match(edgeFunction, /Activa tu ticket/);
  assert.match(edgeFunction, /signup\?email=/);
  assert.match(edgeFunction, /pending: isPending/);
});

test('todos los tipos configurados usan el mismo correo pendiente con QR', () => {
  assert.match(edgeFunction, /const requestedTier = findTicketTier\(eventConfig\?\.ticket_types, ticketType\.trim\(\)\)/);
  assert.match(edgeFunction, /if \(isPending\) \{[\s\S]*renderPendingTicketActivationEmail\(\{[\s\S]*qr_url:[\s\S]*signup_url:/);
  assert.match(ticketEmailRules, /if \(!\/\^early\$\/i\.test\(String\(ticketType \?\? ''\)\.trim\(\)\)\) return html/);
  for (const ticketType of ['General', 'VIP', 'Early', 'Anytime', 'Gratis']) {
    assert.doesNotMatch(edgeFunction, new RegExp(`ticketType\\s*[!=]==?\\s*['\"]${ticketType}['\"]`));
  }
});

test('formularios antiguos sin issuanceKey no bloquean Anytime ni otros tipos', () => {
  assert.match(edgeFunction, /issuanceKey === undefined \|\| issuanceKey === null \|\| issuanceKey === ''/);
  assert.match(edgeFunction, /crypto\.randomUUID\(\)/);
  assert.match(edgeFunction, /p_issuance_key: normalizedIssuanceKey/);
  assert.doesNotMatch(edgeFunction, /\|\| typeof issuanceKey !== 'string'/);
});

test('el lector informa que cualquier ticket pendiente debe activarse', () => {
  assert.match(migration, /Ticket pendiente de activación/);
  assert.doesNotMatch(migration, /Cortesía pendiente:/);
});
