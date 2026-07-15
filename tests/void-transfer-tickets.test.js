import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260703003045_void_and_transfer_manual_tickets.sql', 'utf8');
const voidFunction = readFileSync('supabase/functions/void-ticket/index.ts', 'utf8');
const transferFunction = readFileSync('supabase/functions/transfer-ticket/index.ts', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

test('events.tickets_voided existe y no puede ser negativo', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS tickets_voided INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /CHECK \(tickets_voided >= 0\)/);
});

test('void_ticket libera cupo, baja courtesias_issued si aplica, y suma tickets_voided', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.void_ticket/);
  assert.match(migration, /GREATEST\(COALESCE\(tickets_sold, 0\) - 1, 0\)/);
  assert.match(migration, /WHEN v_ticket\.ticket_type = 'Cortesía' THEN GREATEST\(COALESCE\(courtesies_issued, 0\) - 1, 0\)/);
  assert.match(migration, /tickets_voided = COALESCE\(tickets_voided, 0\) \+ 1/);
  assert.match(migration, /'ticket\.voided'/);
});

test('void_ticket y transfer_ticket rechazan tickets pagados por pasarela, usados o ya anulados', () => {
  assert.match(migration, /not_voidable_use_refund/);
  assert.match(migration, /not_transferable_use_refund/);
  assert.match(migration, /IF v_ticket\.status = 'used' THEN RAISE EXCEPTION 'already_used'; END IF;/);
  assert.match(migration, /IF v_ticket\.status IN \('cancelled', 'refunded'\) THEN RAISE EXCEPTION 'already_cancelled'; END IF;/);
});

test('transfer_ticket reasigna a cuenta existente o deja pendiente de registro', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transfer_ticket/);
  assert.match(migration, /SELECT id INTO v_new_user_id FROM auth\.users WHERE lower\(email\) = v_email LIMIT 1;/);
  assert.match(migration, /'ticket\.transferred'/);
});

test('is_authorized_for_event exige dueño del evento, co-promotor activo o admin', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.is_authorized_for_event/);
  assert.match(migration, /v_actor_role = 'admin'/);
  assert.match(migration, /event_co_promoters[\s\S]*status = 'active'/);
});

test('el edge function void-ticket traduce errores conocidos y expone el total anulado', () => {
  assert.match(voidFunction, /void_ticket/);
  assert.match(voidFunction, /not_voidable_use_refund/);
  assert.match(voidFunction, /ticketsVoidedTotal/);
});

test('el edge function transfer-ticket envía la plantilla correcta según pending y notifica in-app', () => {
  assert.match(transferFunction, /transfer_ticket/);
  assert.match(transferFunction, /renderPendingTicketActivationEmail/);
  assert.match(transferFunction, /renderTicketPurchasedEmail/);
  assert.match(transferFunction, /create_notification/);
  assert.match(transferFunction, /action_section: 'tickets'|p_action_section: 'tickets'/);
});

test('EventManager solo ofrece anular/transferir para tickets manuales o de cortesía, no de pasarela', () => {
  assert.match(eventManager, /const isVoidable = \(a\) => !a\.wompi_reference[\s\S]*startsWith\('BANK-'\)[\s\S]*startsWith\('MANUAL-'\)/);
  assert.match(eventManager, /functions\.invoke\('void-ticket'/);
  assert.match(eventManager, /functions\.invoke\('transfer-ticket'/);
  assert.match(eventManager, /'ANULADO'/);
});

test('el dashboard de tickets tambien permite anular\\/transferir y muestra el contador de anulados', () => {
  assert.match(adminDashboard, /tickets_voided/);
  assert.match(adminDashboard, /functions\.invoke\('void-ticket'/);
  assert.match(adminDashboard, /functions\.invoke\('transfer-ticket'/);
  assert.match(adminDashboard, /tickets anulados/);
  assert.match(adminDashboard, /en este evento/);
});
