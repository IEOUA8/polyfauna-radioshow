import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFunctionErrorMessage } from '../src/lib/functionErrors.js';
import { buildWompiCheckoutUrl, isWompiCheckoutUrl } from '../src/lib/wompiCheckout.js';

const migration = readFileSync('supabase/migrations/20260622000004_launch_ticket_integrity.sql', 'utf8');
const webhook = readFileSync('supabase/functions/webhook-wompi/index.ts', 'utf8');
const createPayment = readFileSync('supabase/functions/create-payment/index.ts', 'utf8');
const offlineMigration = readFileSync('supabase/migrations/20260622000007_offline_ticket_validation.sql', 'utf8');
const operationalAlerts = readFileSync('supabase/migrations/20260624000001_operational_alerts.sql', 'utf8');
const governance = readFileSync('supabase/migrations/20260624000002_governance_audit_support.sql', 'utf8');
const userManager = readFileSync('src/components/admin/UserManager.jsx', 'utf8');
const roleRequestsPanel = readFileSync('src/components/RoleRequestsPanel.jsx', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const roleAndTicketTiers = readFileSync('supabase/migrations/20260701000001_role_requests_and_ticket_tiers.sql', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');
const controlCenter = readFileSync('src/components/ControlCenter.jsx', 'utf8');
const organizerOperations = readFileSync('supabase/migrations/20260701000002_organizer_operations_and_manual_tickets.sql', 'utf8');
const manualTicketFunction = readFileSync('supabase/functions/issue-manual-ticket/index.ts', 'utf8');
const ticketVault = readFileSync('src/components/TicketVault.jsx', 'utf8');
const legacyTicketCompatibility = readFileSync('supabase/migrations/20260701000003_legacy_ticket_type_compatibility.sql', 'utf8');
const roleRequestDelivery = readFileSync('supabase/migrations/20260701000004_role_request_delivery.sql', 'utf8');
const sendRoleRequest = readFileSync('supabase/functions/send-role-request/index.ts', 'utf8');
const authContext = readFileSync('src/contexts/AuthContext.jsx', 'utf8');
const formModal = readFileSync('src/components/ui/FormModal.jsx', 'utf8');
const freeTicketConfirmation = readFileSync('supabase/migrations/20260701000005_free_ticket_confirmation.sql', 'utf8');
const claimFreeTicketFunction = readFileSync('supabase/functions/claim-free-ticket/index.ts', 'utf8');
const freeTicketsClient = readFileSync('src/lib/freeTickets.js', 'utf8');
const organizerCommunity = readFileSync('supabase/migrations/20260701000006_organizer_community_flow.sql', 'utf8');
const courtesyFunction = readFileSync('supabase/functions/issue-courtesy-ticket/index.ts', 'utf8');
const artistMentionInput = readFileSync('src/components/ArtistMentionInput.jsx', 'utf8');
const editProfile = readFileSync('src/components/EditProfile.jsx', 'utf8');
const validatePage = readFileSync('src/pages/ValidatePage.jsx', 'utf8');
const signupPage = readFileSync('src/pages/SignupPage.jsx', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const uploadField = readFileSync('src/components/admin/UploadField.jsx', 'utf8');
const sidebar = readFileSync('src/components/Sidebar.jsx', 'utf8');
const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const ticketIdentity = readFileSync('src/lib/ticketIdentity.js', 'utf8');
const eventsDuplicateGuard = readFileSync('supabase/migrations/20260702180107_events_duplicate_guard.sql', 'utf8');
const eventCoPromoters = readFileSync('supabase/migrations/20260702180108_event_co_promoters.sql', 'utf8');
const notifyCoPromoterMigration = readFileSync('supabase/migrations/20260702183724_notify_co_promoter_linked.sql', 'utf8');
const notifyCoPromoterFunction = readFileSync('supabase/functions/notify-co-promoter-linked/index.ts', 'utf8');
const useNotifications = readFileSync('src/hooks/useNotifications.js', 'utf8');
const rlsRecursionFix = readFileSync('supabase/migrations/20260702184953_fix_events_co_promoters_rls_recursion.sql', 'utf8');
const rightPanel = readFileSync('src/components/RightPanel.jsx', 'utf8');

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

test('checkout conserva compatibilidad GA y muestra el error real del servidor', async () => {
  assert.match(createPayment, /\['ga', 'general admission'\]/);
  assert.match(legacyTicketCompatibility, /lower\(v_type_name\) IN \('ga', 'general admission'\)/);
  const message = await getFunctionErrorMessage({
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify({ error: 'Tipo de entrada no disponible' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  assert.equal(message, 'Tipo de entrada no disponible');
});

test('checkout Wompi se construye solo contra el dominio oficial', () => {
  const checkoutUrl = buildWompiCheckoutUrl({
    public_key: 'pub_test_polyfauna',
    amount_in_cents: 12000000,
    reference: 'evt/abc 123',
    signature: 'abc123signature',
  }, 'https://www.polyfauna.com');

  const url = new URL(checkoutUrl);
  assert.equal(isWompiCheckoutUrl(checkoutUrl), true);
  assert.equal(url.origin, 'https://checkout.wompi.co');
  assert.equal(url.pathname, '/p/');
  assert.equal(url.searchParams.get('currency'), 'COP');
  assert.equal(url.searchParams.get('amount-in-cents'), '12000000');
  assert.equal(url.searchParams.get('reference'), 'evt/abc 123');
  assert.equal(url.searchParams.get('redirect-url'), 'https://www.polyfauna.com/');
});

test('checkout Wompi no envía redirect local y rechaza montos inválidos', () => {
  const localCheckoutUrl = buildWompiCheckoutUrl({
    public_key: 'pub_test_polyfauna',
    amount_in_cents: 1000,
    reference: 'local-ref',
    signature: 'local-signature',
  }, 'http://127.0.0.1:3000');

  assert.equal(new URL(localCheckoutUrl).searchParams.has('redirect-url'), false);
  assert.equal(isWompiCheckoutUrl('https://evil.example/p/?reference=x'), false);
  assert.throws(() => buildWompiCheckoutUrl({
    public_key: 'pub_test_polyfauna',
    amount_in_cents: 0,
    reference: 'bad-ref',
    signature: 'bad-signature',
  }, 'https://www.polyfauna.com'), /monto inválido/);
});

test('tipos de entrada conservan precio, cupo e inventario independientes', () => {
  assert.match(roleAndTicketTiers, /ADD COLUMN IF NOT EXISTS ticket_types JSONB/);
  assert.match(roleAndTicketTiers, /ADD COLUMN IF NOT EXISTS ticket_type TEXT NOT NULL DEFAULT 'General'/);
  assert.match(roleAndTicketTiers, /v_tier_sold \+ v_tx\.quantity > v_tier_capacity/);
  assert.match(roleAndTicketTiers, /v_tx\.ticket_type, 'valid'/);
  assert.match(createPayment, /ticket_types, owner_id/);
  assert.match(createPayment, /Math\.round\(tierPrice \* qty\)/);
  assert.match(createPayment, /ticket_type:\s+tierName/);
  assert.match(eventManager, /TICKET_TYPES = \['General', 'VIP', 'Early', 'Anytime', 'Gratis'\]/);
  assert.match(eventManager, /ticket_types: normalizedTicketTypes/);
  assert.match(eventTerminal, /ticket_type: selectedTicket\.name/);
});

test('entradas gratis se emiten sin Wompi y limitan la compra pública a una', () => {
  assert.match(eventManager, /FREE_TICKET_TYPES = new Set\(\['Gratis'\]\)/);
  assert.match(eventManager, /ticketTypes\[index\]\.price !== ''/);
  assert.match(freeTicketsClient, /functions\.invoke\('claim-free-ticket'/);
  assert.match(freeTicketConfirmation, /confirmation_email_sent_at TIMESTAMPTZ/);
  assert.match(claimFreeTicketFunction, /Number\(tier\.price\) !== 0/);
  assert.match(claimFreeTicketFunction, /rpc\('purchase_ticket'/);
  assert.match(claimFreeTicketFunction, /confirmation_email_sent_at: claimedAt/);
  assert.match(claimFreeTicketFunction, /renderEmailTemplate\('ticketPurchased'/);
  assert.match(eventTerminal, /claimFreeTicket\(\{/);
  assert.match(eventTerminal, /!isFree/);
  assert.match(claimFreeTicketFunction, /Las cortesías solo pueden ser emitidas por el organizador/);
  assert.match(freeTicketsClient, /saveTicketIdentity/);
  assert.match(ticketIdentity, /from\('user_identity'\)/);
  assert.match(ticketIdentity, /document_type: 'CC'/);
  assert.match(eventTerminal, /Identificación del asistente/);
  assert.match(eventTerminal, /Número de cédula/);
  assert.match(claimFreeTicketFunction, /Ingresa tu nombre completo y número de cédula/);
});

test('colectivos, cortesías e identidad usan permisos y superficies restringidas', () => {
  assert.match(signupPage, /id: 'collective'/);
  assert.match(authContext, /role === 'collective' \? 'promoter' : role/);
  assert.match(organizerCommunity, /CREATE TABLE IF NOT EXISTS public\.user_identity/);
  assert.match(organizerCommunity, /CREATE OR REPLACE FUNCTION public\.protect_profile_access_fields/);
  assert.match(organizerCommunity, /CREATE OR REPLACE FUNCTION public\.issue_courtesy_ticket/);
  assert.match(organizerCommunity, /'ticket\.courtesy'/);
  assert.match(organizerCommunity, /courtesy_limit INTEGER/);
  assert.match(courtesyFunction, /Cortesía confirmada/);
  assert.match(courtesyFunction, /sendPush/);
  assert.match(adminDashboard, /function CourtesyTicketModal/);
  assert.match(adminDashboard, /functions\.invoke\('issue-courtesy-ticket'/);
  assert.match(adminDashboard, /courtesy_limit, courtesies_issued/);
  assert.match(adminDashboard, /Configurar cupos en Eventos/);
  assert.match(editProfile, /from\('user_identity'\)/);
});

test('eventos guardan final, lineup enlazado y validación visual de identidad', () => {
  assert.match(organizerCommunity, /ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ/);
  assert.match(eventManager, /<Label>Final \*<\/Label>/);
  assert.match(eventManager, /<ArtistMentionInput/);
  assert.match(artistMentionInput, /from\('artists'\)/);
  assert.match(artistMentionInput, /artist_id: artist\.id/);
  assert.match(organizerCommunity, /'full_name', identity\.full_name/);
  assert.match(validatePage, /Verificar identidad/);
  assert.match(validatePage, /result\.document_number/);
});

test('solicitudes profesionales llegan al Control Center del admin', () => {
  assert.match(roleAndTicketTiers, /requested_role IN \('artist', 'promoter', 'club', 'sello'\)/);
  assert.match(roleAndTicketTiers, /INSERT INTO public\.role_requests/);
  assert.match(roleAndTicketTiers, /source', 'migration_recovery'/);
  assert.match(roleRequestDelivery, /role_requests_user_profile_fkey/);
  assert.match(roleRequestDelivery, /REFERENCES public\.profiles\(id\)/);
  assert.match(roleRequestDelivery, /NOTIFY pgrst, 'reload schema'/);
  assert.match(authContext, /body: \{ userId: data\.user\.id, email \}/);
  assert.match(sendRoleRequest, /requestAge > 30 \* 60 \* 1000/);
  assert.match(sendRoleRequest, /applicant\.email\.trim\(\)\.toLowerCase\(\) !== email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(sendRoleRequest, /SUPPORT_EMAIL/);
  assert.match(sendRoleRequest, /notification_sent_at: claimedAt/);
  assert.match(roleRequestsPanel, /admin-role-requests/);
  assert.match(roleRequestsPanel, /postgres_changes/);
  assert.match(controlCenter, /<RoleRequestsPanel \/>/);
});

test('organizadores administran asistentes y emiten transferencias manuales auditadas', () => {
  assert.match(organizerOperations, /CREATE OR REPLACE FUNCTION public\.get_event_attendees/);
  assert.match(organizerOperations, /v_role IN \('promoter', 'club'\)/);
  assert.match(organizerOperations, /CREATE OR REPLACE FUNCTION public\.issue_manual_transfer_ticket/);
  assert.match(organizerOperations, /payment_method,[\s\S]*'bank_transfer'/);
  assert.match(organizerOperations, /ticket\.manual_bank_transfer/);
  assert.match(organizerOperations, /TO service_role/);
  assert.match(manualTicketFunction, /issue_manual_transfer_ticket/);
  assert.match(manualTicketFunction, /signTicketToken/);
  assert.match(manualTicketFunction, /renderEmailTemplate\('ticketPurchased'/);
  assert.match(adminDashboard, /Generar ticket manual/);
});

test('panel operativo unifica edición completa de eventos y tickets', () => {
  assert.doesNotMatch(sidebar, /Gestor de Eventos/);
  assert.doesNotMatch(mobileMenu, /PROMOTER_ITEM/);
  assert.match(adminDashboard, /<EventManager ownerId=\{isAdmin \? null : currentUser\?\.id\} isAdmin=\{isAdmin\}/);
  assert.match(eventManager, /function EventManager|const EventManager = \(\{ ownerId = null/);
  assert.match(eventManager, /\{isAdmin && \(/);
  assert.match(eventManager, /eq\('owner_id', ownerId\)\.order\('date', \{ ascending: false \}\)/);
  assert.match(eventManager, /ticket_types: normalizedTicketTypes/);
  assert.match(eventManager, /setTicketTypes\(existingTicketTypes/);
  assert.match(eventManager, /Editar evento/);
  assert.match(eventManager, /Guardar todos los cambios/);
  assert.match(eventManager, /ticket\.capacity >= Math\.max\(1, ticketSales\[ticket\.name\]/);
});

test('portadas de eventos y pagos pendientes tienen estados recuperables', () => {
  assert.match(organizerOperations, /event_covers_organizer_insert/);
  assert.match(organizerOperations, /storage\.foldername\(name\)/);
  assert.match(eventManager, /pathPrefix=\{`events\/\$\{currentUser\.id\}\/`\}/);
  assert.match(uploadField, /const path = `\$\{pathPrefix\}\$\{crypto\.randomUUID\(\)\}/);
  assert.match(uploadField, /Error al subir archivo/);
  assert.match(ticketVault, /Wompi aún no confirma el pago/);
});

test('modal de eventos mantiene la acción visible sobre el reproductor', () => {
  assert.match(formModal, /createPortal\(/);
  assert.match(formModal, /z-\[200\]/);
  assert.match(formModal, /pb-\[calc\(160px\+env\(safe-area-inset-bottom,0px\)\)\]/);
  assert.match(formModal, /footer &&/);
  assert.match(eventManager, /max-h-\[90dvh\] overflow-y-auto overflow-x-hidden pb-28/);
});

test('modal de eventos no se desplaza lateralmente en móvil', () => {
  assert.match(eventManager, /w-\[calc\(100vw-2rem\)\] sm:w-full/);
  assert.match(eventManager, /overflow-x-hidden/);
  assert.match(eventManager, /flex flex-wrap items-start justify-between gap-4/);
});

test('la fila de usuario en el panel admin se apila en móvil en vez de comprimir el nombre', () => {
  assert.match(userManager, /flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between/);
  assert.doesNotMatch(userManager, /flex items-center justify-between p-4 bg-background rounded-xl border border-border/);
});

test('modales de compra y perfil usan portal global con un solo scroll interno', () => {
  assert.match(eventTerminal, /createPortal\(/);
  assert.match(eventTerminal, /fixed inset-0 z-\[220\] flex items-center justify-center/);
  assert.doesNotMatch(eventTerminal, /playerBottom/);
  assert.match(eventTerminal, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(editProfile, /createPortal\(/);
  assert.match(editProfile, /fixed inset-0 z-\[220\] flex items-center justify-center/);
  assert.match(editProfile, /flex-1 min-h-0 overflow-y-auto overscroll-contain/);
  assert.match(editProfile, /Save footer/);
});

test('modales de compra y perfil usan portal global con un solo scroll interno', () => {
  assert.match(eventTerminal, /createPortal\(/);
  assert.match(eventTerminal, /fixed inset-0 z-\[220\] flex items-center justify-center/);
  assert.doesNotMatch(eventTerminal, /playerBottom/);
  assert.match(eventTerminal, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(editProfile, /createPortal\(/);
  assert.match(editProfile, /fixed inset-0 z-\[220\] flex items-center justify-center/);
  assert.match(editProfile, /flex-1 min-h-0 overflow-y-auto overscroll-contain/);
  assert.match(editProfile, /Save footer/);
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

test('eventos duplicados quedan bloqueados por título y día para el mismo dueño', () => {
  assert.match(eventsDuplicateGuard, /CREATE UNIQUE INDEX IF NOT EXISTS events_owner_title_day_unique/);
  assert.match(eventsDuplicateGuard, /CREATE OR REPLACE FUNCTION public\.events_dup_day\(ts TIMESTAMPTZ\)/);
  assert.match(eventsDuplicateGuard, /IMMUTABLE/);
  assert.match(eventsDuplicateGuard, /owner_id, lower\(trim\(title\)\), public\.events_dup_day\(date\)/);
  assert.match(eventsDuplicateGuard, /WHERE status <> 'cancelled'/);
  assert.match(eventManager, /err\.code === '23505'/);
  assert.match(eventManager, /events_owner_title_day_unique/);
});

test('co-promotores venden sin poder editar el evento y se acreditan en su propio wallet', () => {
  // Esquema y autorización de escritura solo vía funciones SECURITY DEFINER
  assert.match(eventCoPromoters, /CREATE TABLE IF NOT EXISTS public\.event_co_promoters/);
  assert.match(eventCoPromoters, /ref_code\s+TEXT NOT NULL UNIQUE DEFAULT substr\(md5\(gen_random_uuid\(\)::text\), 1, 12\)/);
  assert.match(eventCoPromoters, /REVOKE ALL ON public\.event_co_promoters FROM PUBLIC, anon, authenticated/);
  assert.match(eventCoPromoters, /CREATE OR REPLACE FUNCTION public\.add_event_co_promoter/);
  assert.match(eventCoPromoters, /v_target_role NOT IN \('promoter', 'club'\)/);
  assert.match(eventCoPromoters, /CREATE OR REPLACE FUNCTION public\.revoke_event_co_promoter/);

  // El co-promotor puede leer el evento aunque no esté publicado
  assert.match(eventCoPromoters, /DROP POLICY IF EXISTS "events_visible_read" ON public\.events/);
  assert.match(eventCoPromoters, /FROM public\.event_co_promoters\s+WHERE event_id = events\.id/);

  // Asistentes y ticket manual: dueño O co-promotor activo
  assert.match(eventCoPromoters, /DROP FUNCTION IF EXISTS public\.get_event_attendees\(UUID\)/);
  assert.match(eventCoPromoters, /CREATE FUNCTION public\.get_event_attendees/);
  assert.match(eventCoPromoters, /FROM public\.event_co_promoters\s+WHERE event_id = event\.id AND promoter_id = auth\.uid\(\) AND status = 'active'/);
  assert.match(eventCoPromoters, /CREATE OR REPLACE FUNCTION public\.issue_manual_transfer_ticket/);
  assert.match(eventCoPromoters, /v_event\.owner_id <> p_actor_id/);
  // La venta manual se acredita a quien la emite, no siempre al dueño
  assert.match(eventCoPromoters, /p_actor_id,\s*\n\s*v_tier_price,/);

  // create-payment resuelve el promoter_id por ref_code, sin romper el flujo normal
  assert.match(createPayment, /seller_ref = null/);
  assert.match(createPayment, /from\('event_co_promoters'\)/);
  assert.match(createPayment, /eq\('ref_code', seller_ref\.trim\(\)\)/);
  assert.match(createPayment, /let sellerPromoterId = event\.owner_id/);

  // El link se captura en Event Terminal (antes vivía en la extinta
  // EventPublicPage / :id) y se reenvía al checkout.
  assert.match(eventTerminal, /pf_seller_ref_\$\{eventParam\}/);
  assert.match(eventTerminal, /seller_ref: sessionStorage\.getItem/);

  // UI: invitar/gestionar co-promotores, y ocultar edición para no-dueños
  assert.match(eventManager, /function CoPromotersManager/);
  assert.match(eventManager, /supabase\.rpc\('add_event_co_promoter'/);
  assert.match(eventManager, /supabase\.rpc\('revoke_event_co_promoter'/);
  assert.match(eventManager, /const canEdit = isAdmin \|\| event\.owner_id === currentUser\?\.id/);

  // Tickets: el listado/emisión manual también incluye eventos co-promovidos
  assert.match(adminDashboard, /from\('event_co_promoters'\)/);

  // Sin filtros .or() armados a mano — dos consultas simples + merge en cliente
  assert.doesNotMatch(eventManager, /query\.or\(filters\.join/);
  assert.doesNotMatch(adminDashboard, /query\.or\(filters\.join/);
});

test('vincular un co-promotor notifica dentro de la plataforma y por correo', () => {
  assert.match(notifyCoPromoterMigration, /PERFORM public\.create_notification\(/);
  assert.match(notifyCoPromoterMigration, /'Te vincularon como co-promotor'/);
  assert.match(notifyCoPromoterMigration, /v_target_id\s*\n\s*\);/);

  assert.match(useNotifications, /from\('notifications'\)/);
  assert.match(useNotifications, /action_section/);

  assert.match(notifyCoPromoterFunction, /requireUser/);
  assert.match(notifyCoPromoterFunction, /if \(!isOwner && !isAdmin\)/);
  assert.match(notifyCoPromoterFunction, /admin\.auth\.admin\.getUserById\(promoterId\)/);
  assert.match(notifyCoPromoterFunction, /sendEmail\(\{ to: target\.email/);

  assert.match(eventManager, /supabase\.functions\.invoke\('notify-co-promoter-linked'/);
  assert.match(eventManager, /body: \{ eventId, promoterId: data\.promoter_id \}/);
});

test('la política de events y event_co_promoters no vuelve a recursionar entre sí', () => {
  assert.match(rlsRecursionFix, /CREATE OR REPLACE FUNCTION public\.is_event_owner\(p_event_id UUID\)/);
  assert.match(rlsRecursionFix, /SECURITY DEFINER/);
  assert.match(rlsRecursionFix, /DROP POLICY IF EXISTS "event_co_promoters_select" ON public\.event_co_promoters/);
  assert.match(rlsRecursionFix, /public\.is_event_owner\(event_id\)/);
  // La política reescrita ya no consulta events directamente (rompe el ciclo)
  assert.doesNotMatch(rlsRecursionFix, /FROM public\.events\s+WHERE id = event_id/);
});

test('notificaciones cubren música, podcasts, eventos, blog y avisos in-app', () => {
  assert.match(useNotifications, /from\('albums'\)/);
  assert.match(useNotifications, /type: 'music'/);
  assert.match(useNotifications, /section: 'music'/);
  assert.match(rightPanel, /music:\s*\{ icon: Music/);
});
