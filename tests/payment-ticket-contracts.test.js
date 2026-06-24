import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260622000004_launch_ticket_integrity.sql', 'utf8');
const webhook = readFileSync('supabase/functions/webhook-wompi/index.ts', 'utf8');
const createPayment = readFileSync('supabase/functions/create-payment/index.ts', 'utf8');
const offlineMigration = readFileSync('supabase/migrations/20260622000007_offline_ticket_validation.sql', 'utf8');
const operationalAlerts = readFileSync('supabase/migrations/20260624000001_operational_alerts.sql', 'utf8');
const governance = readFileSync('supabase/migrations/20260624000002_governance_audit_support.sql', 'utf8');
const userManager = readFileSync('src/components/admin/UserManager.jsx', 'utf8');
const roleRequestsPanel = readFileSync('src/components/RoleRequestsPanel.jsx', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

test('emisión pagada conserva idempotencia, locks e inventario atómico', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.fulfill_paid_transaction/);
  assert.match(migration, /WHERE id = p_transaction_id FOR UPDATE/);
  assert.match(migration, /IF v_tx\.status = 'approved' THEN/);
  assert.match(migration, /'already_processed', true/);
  assert.match(migration, /SELECT \* INTO v_event FROM public\.events WHERE id = v_tx\.event_id FOR UPDATE/);
  assert.match(migration, /COALESCE\(v_event\.tickets_sold, 0\) \+ v_tx\.quantity > COALESCE\(v_event\.tickets_total, 0\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.fulfill_paid_transaction\(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ\)\s+TO service_role/);
});

test('validación online de tickets exige autorización y uso único', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.validate_ticket\(p_ticket_id UUID\)/);
  assert.match(migration, /WHERE id = p_ticket_id FOR UPDATE/);
  assert.match(migration, /v_event\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /IF v_ticket\.status = 'used' THEN/);
  assert.match(migration, /UPDATE public\.user_tickets SET status = 'used' WHERE id = p_ticket_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.validate_ticket_for_event/);
  assert.match(migration, /'WRONG_EVENT'/);
});

test('webhook Wompi conserva firma, monto, moneda e idempotencia', () => {
  assert.match(webhook, /WOMPI_EVENTS_KEY/);
  assert.match(webhook, /expectedChecksum !== signature\?\.checksum/);
  assert.match(webhook, /event !== 'transaction\.updated'/);
  assert.match(webhook, /transaction\.status !== 'pending'/);
  assert.match(webhook, /receivedAmount !== expectedAmount \|\| receivedCurrency !== 'COP'/);
  assert.match(webhook, /fulfill_paid_transaction/);
});

test('checkout de pago conserva límites y referencias firmadas', () => {
  assert.match(createPayment, /const MAX_TICKETS = 4/);
  assert.match(createPayment, /quantity debe estar entre 1 y/);
  assert.match(createPayment, /count_user_event_tickets/);
  assert.match(createPayment, /checkout pendiente/);
  assert.match(createPayment, /sha256hex\(`\$\{reference\}\$\{amount_in_cents\}COP\$\{INTEGRITY_KEY\}`\)/);
  assert.doesNotMatch(createPayment, /detail: txErr\.message/);
});

test('sincronización offline conserva autorización, idempotencia y auditoría', () => {
  assert.match(offlineMigration, /CREATE TABLE IF NOT EXISTS public\.ticket_scan_log/);
  assert.match(offlineMigration, /jsonb_array_length\(p_scans\) > 500/);
  assert.match(offlineMigration, /SELECT result INTO v_existing FROM public\.ticket_scan_log WHERE scan_id = v_scan_id/);
  assert.match(offlineMigration, /'idempotent', true/);
  assert.match(offlineMigration, /SELECT \* INTO v_ticket FROM public\.user_tickets WHERE id = v_ticket_id FOR UPDATE/);
  assert.match(offlineMigration, /scanner_user_id, device_id, scanned_at, result/);
});

test('alertas operativas cubren pagos, tickets, soporte, errores y offline', () => {
  assert.match(operationalAlerts, /CREATE OR REPLACE FUNCTION public\.get_operational_alerts\(\)/);
  assert.match(operationalAlerts, /role = 'admin'/);
  assert.match(operationalAlerts, /approved_payment_without_ticket/);
  assert.match(operationalAlerts, /ticket_quantity_mismatch/);
  assert.match(operationalAlerts, /oversold_event/);
  assert.match(operationalAlerts, /stale_pending_payment/);
  assert.match(operationalAlerts, /client_errors_recent/);
  assert.match(operationalAlerts, /refund_requests_waiting/);
  assert.match(operationalAlerts, /payouts_waiting/);
  assert.match(operationalAlerts, /offline_scan_conflicts/);
  assert.match(operationalAlerts, /GRANT EXECUTE ON FUNCTION public\.get_operational_alerts\(\) TO authenticated/);
});

test('gobernanza conserva auditoria admin, soporte y cambios de rol atomicos', () => {
  assert.match(governance, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS public\.support_cases/);
  assert.match(governance, /ALTER TABLE public\.admin_audit_log ENABLE ROW LEVEL SECURITY/);
  assert.match(governance, /ALTER TABLE public\.support_cases ENABLE ROW LEVEL SECURITY/);
  assert.match(governance, /CREATE OR REPLACE FUNCTION public\.log_admin_action/);
  assert.match(governance, /CREATE OR REPLACE FUNCTION public\.set_user_role/);
  assert.match(governance, /self_admin_demotion_blocked/);
  assert.match(governance, /CREATE OR REPLACE FUNCTION public\.delete_profile_admin/);
  assert.match(governance, /self_profile_delete_blocked/);
  assert.match(governance, /CREATE OR REPLACE FUNCTION public\.update_support_case/);
  assert.match(governance, /CREATE OR REPLACE FUNCTION public\.process_role_request_admin/);
  assert.match(governance, /FOR UPDATE/);
  assert.match(governance, /role_request_already_reviewed/);
  assert.match(governance, /PERFORM public\.set_user_role/);
  assert.match(governance, /GRANT EXECUTE ON FUNCTION public\.process_role_request_admin\(UUID, TEXT, TEXT\) TO authenticated/);
});

test('panel admin usa RPCs auditadas para roles, perfiles y soporte', () => {
  assert.match(userManager, /supabase\.rpc\('set_user_role'/);
  assert.match(userManager, /supabase\.rpc\('delete_profile_admin'/);
  assert.doesNotMatch(userManager, /\.from\('profiles'\)[\s\S]{0,160}\.update\(\{\s*role/);
  assert.doesNotMatch(userManager, /\.from\('profiles'\)[\s\S]{0,120}\.delete\(\)/);

  assert.match(roleRequestsPanel, /supabase\.rpc\('process_role_request_admin'/);
  assert.doesNotMatch(roleRequestsPanel, /\.from\('profiles'\)[\s\S]{0,160}\.update\(\{\s*role/);

  assert.match(adminDashboard, /id: 'support'/);
  assert.match(adminDashboard, /function SupportCasesSection/);
  assert.match(adminDashboard, /supabase\.rpc\('update_support_case'/);
});
