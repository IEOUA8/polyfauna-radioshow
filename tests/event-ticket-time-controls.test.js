import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EVENT_TERMINAL_RETENTION_MS,
  getEarlyEntryRule,
  hasOpenTicketSales,
  isEventVisibleInTerminal,
  isTicketSaleOpen,
} from '../src/lib/eventTicketRules.js';

const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');
const validatePage = readFileSync('src/pages/ValidatePage.jsx', 'utf8');
const createPayment = readFileSync('supabase/functions/create-payment/index.ts', 'utf8');
const wompiCheckout = readFileSync('src/lib/wompiCheckout.js', 'utf8');
const migration = readFileSync('supabase/migrations/20260715113000_event_ticket_time_controls.sql', 'utf8');
const ticketEmailRules = readFileSync('supabase/functions/_shared/ticket-email-rules.ts', 'utf8');
const ticketConfirmation = readFileSync('supabase/functions/send-ticket-confirmation/index.ts', 'utf8');
const wompiWebhook = readFileSync('supabase/functions/webhook-wompi/index.ts', 'utf8');
const freeTicket = readFileSync('supabase/functions/claim-free-ticket/index.ts', 'utf8');
const manualTicket = readFileSync('supabase/functions/issue-manual-ticket/index.ts', 'utf8');
const transferredTicket = readFileSync('supabase/functions/transfer-ticket/index.ts', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

test('Event Terminal conserva un evento hasta cinco horas después de finalizar', () => {
  assert.equal(EVENT_TERMINAL_RETENTION_MS, 18_000_000);
  const event = { status: 'upcoming', ends_at: '2026-07-16T05:00:00.000Z' };
  assert.equal(isEventVisibleInTerminal(event, '2026-07-16T09:59:59.000Z'), true);
  assert.equal(isEventVisibleInTerminal(event, '2026-07-16T10:00:00.000Z'), false);
  assert.match(eventTerminal, /isEventVisibleInTerminal/);
});

test('cada tier puede cerrar su venta digital de forma independiente', () => {
  const event = { date: '2026-07-16T03:00:00.000Z' };
  const ticket = { sales_end_at: '2026-07-16T01:00:00.000Z' };
  assert.equal(isTicketSaleOpen(ticket, event, '2026-07-16T00:59:59.000Z'), true);
  assert.equal(isTicketSaleOpen(ticket, event, '2026-07-16T01:00:01.000Z'), false);
  assert.match(eventManager, /Venta digital hasta \*/);
  assert.match(createPayment, /TICKET_SALES_CLOSED/);
  assert.match(createPayment, /COP\$\{expiration_time\}\$\{INTEGRITY_KEY\}/);
  assert.match(wompiCheckout, /\['expiration-time', requireString\(paymentData\?\.expiration_time/);
  assert.match(migration, /'code', 'TICKET_SALES_CLOSED'/);
});

test('Early vencido devuelve recargo sin consumir el ticket', () => {
  const rule = getEarlyEntryRule({
    name: 'Early',
    entry_cutoff_at: '2026-07-16T02:00:00.000Z',
    late_entry_fee: 20000,
  }, '2026-07-16T02:00:01.000Z');
  assert.equal(rule.expired, true);
  assert.equal(rule.lateEntryFee, 20000);
  assert.match(eventManager, /Recargo fuera de horario COP \*/);
  assert.match(migration, /EARLY_ENTRY_WINDOW_EXPIRED[\s\S]*late_entry_fee/);
  assert.match(validatePage, /No se consumió el ticket/);
  assert.match(validatePage, /admit_early_ticket_with_surcharge/);
  assert.match(validatePage, /Recargo cobrado · Autorizar ingreso/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.early_entry_surcharge_log/);
  assert.match(migration, /UPDATE public\.user_tickets SET status = 'used'/);
});

test('el paquete offline incluye la regla Early para aplicar el mismo control en puerta', () => {
  assert.match(migration, /'entry_cutoff_at', tier\.value->>'entry_cutoff_at'/);
  assert.match(migration, /'late_entry_fee', CASE/);
});

test('guardar el evento informa los campos Early pendientes en vez de bloquear el botón', () => {
  assert.doesNotMatch(eventManager, /disabled=\{saving \|\| loadingTicketSales \|\| !ticketTypesValid\}/);
  assert.match(eventManager, /min=\{addMinutesToLocal\(formData\.date, 1\)/);
  assert.match(eventManager, /Al guardar verás el detalle del campo pendiente/);
});

test('el recargo Early acepta valores redondos en miles de pesos', () => {
  assert.match(eventManager, /placeholder="10000" min="1000" step="1000"/);
  assert.doesNotMatch(eventManager, /min="1" step="1000"/);
});

test('un tipo retirado deja de venderse sin invalidar sus tickets emitidos', () => {
  const event = {
    date: '2026-07-16T03:00:00.000Z',
    ticket_types: [
      { name: 'General', capacity: 100, active: false, sales_end_at: '2026-07-16T01:00:00.000Z' },
      { name: 'Early', capacity: 50, active: true, sales_end_at: '2026-07-16T01:00:00.000Z' },
    ],
  };
  assert.equal(hasOpenTicketSales({ ...event, ticket_types: [event.ticket_types[0]] }, '2026-07-15T20:00:00.000Z'), false);
  assert.match(eventManager, /active: false, sales_end_at: toDateTimeLocal\(new Date\(\)\)/);
  assert.doesNotMatch(eventManager, /disabled=\{ticketTypes\.length === 1 \|\| sold > 0\}/);
  assert.match(eventTerminal, /ticket\?\.active !== false/);
  assert.match(createPayment, /item\.active !== false/);
  assert.match(freeTicket, /item\.active !== false/);
  assert.match(manualTicket, /requestedTier\.active === false/);
  assert.match(adminDashboard, /type\?\.active !== false/);
});

test('mover el inicio y final reconcilia los horarios dependientes y guarda ISO', () => {
  assert.match(eventManager, /function shiftLocalDateTime/);
  assert.match(eventManager, /function reconcileTicketWindows/);
  assert.match(eventManager, /onChange=\{\(e\) => updateEventStart\(e\.target\.value\)\}/);
  assert.match(eventManager, /onChange=\{\(e\) => updateEventEnd\(e\.target\.value\)\}/);
  assert.match(eventManager, /date: eventStart\.toISOString\(\)/);
  assert.match(eventManager, /ends_at: eventEnd\.toISOString\(\)/);
});

test('el correo Early explica hora límite, recargo y estado del QR', () => {
  assert.match(ticketEmailRules, /timeZone: 'America\/Bogota'/);
  assert.match(ticketEmailRules, /Regla de ingreso Early/);
  assert.match(ticketEmailRules, /presentar y validar tu QR a más tardar/);
  assert.match(ticketEmailRules, /pagar un recargo/);
  assert.match(ticketEmailRules, /El QR no se consumirá/);
  assert.match(ticketEmailRules, /escapeEmailValue\(cutoff\)/);
  assert.match(ticketEmailRules, /escapeEmailValue\(fee\)/);
});

test('todos los flujos de emisión con tipo configurable aplican las reglas Early', () => {
  assert.match(ticketConfirmation, /entryCutoffAt, lateEntryFee/);
  assert.match(ticketConfirmation, /renderTicketPurchasedEmail/);
  assert.match(wompiWebhook, /events\(date, title, city, owner_id, ticket_types\)/);
  assert.match(wompiWebhook, /entryCutoffAt: ticketTier\?\.entry_cutoff_at/);
  assert.match(wompiWebhook, /lateEntryFee: ticketTier\?\.late_entry_fee/);
  assert.match(freeTicket, /renderTicketPurchasedEmail\([\s\S]*?\}, tier\)/);
  assert.match(manualTicket, /findTicketTier\(eventConfig\?\.ticket_types, ticket\.ticket_type\)/);
  assert.match(manualTicket, /renderTicketPurchasedEmail/);
  assert.match(transferredTicket, /findTicketTier\(eventConfig\?\.ticket_types, result\.ticket_type\)/);
  assert.match(transferredTicket, /injectEarlyTicketRules/);
  assert.match(transferredTicket, /renderTicketPurchasedEmail/);
});
