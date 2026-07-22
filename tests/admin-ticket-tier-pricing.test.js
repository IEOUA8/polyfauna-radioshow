import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatTicketPrice,
  getEventPriceLabel,
  getPublicTicketTiers,
  sumAttendeeRevenue,
  getTicketSaleAmount,
  getTicketTierPrice,
  sumTicketRevenue,
} from '../src/lib/ticketPricing.js';

const dashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');

const event = {
  price: 100000,
  ticket_types: [
    { name: 'Early', price: 100000, capacity: 100 },
    { name: 'Anytime', price: 120000, capacity: 100 },
    { name: 'Gratis', price: 0, capacity: 10 },
  ],
};

test('el precio corresponde al tipo de ticket y no al precio Early del evento', () => {
  assert.equal(getTicketTierPrice(event, 'Early'), 100000);
  assert.equal(getTicketTierPrice(event, 'Anytime'), 120000);
  assert.equal(getTicketTierPrice(event, 'anytime'), 120000);
  assert.equal(getTicketTierPrice(event, 'Gratis'), 0);
  assert.equal(getTicketTierPrice(event, 'Cortesía'), 0);
});

test('la información pública conserva y formatea todos los precios configurados', () => {
  assert.deepEqual(
    getPublicTicketTiers(event).map(ticket => [ticket.name, ticket.price]),
    [['Early', 100000], ['Anytime', 120000], ['Gratis', 0]],
  );
  assert.equal(formatTicketPrice(120000), '$120.000');
  assert.equal(getEventPriceLabel({ ...event, ticket_types: event.ticket_types.slice(0, 2) }), 'Desde $100.000');
  assert.match(eventTerminal, /ticketTypes\.map\(ticket =>/);
  assert.match(eventTerminal, /\{ticket\.name\}[\s\S]*formatTicketPrice\(ticket\.price\)/);
});

test('el importe histórico de la transacción tiene prioridad y se divide por cantidad', () => {
  assert.equal(getTicketSaleAmount({
    ticket_type: 'Anytime',
    events: event,
    sale: { amount_total: 240000, quantity: 2, status: 'approved' },
  }), 120000);
  assert.equal(getTicketSaleAmount({ ticket_type: 'Anytime', events: event }), 120000);
});

test('el ingreso total suma Early y Anytime con sus valores reales', () => {
  assert.equal(sumTicketRevenue([
    { ticket_type: 'Early', events: event },
    { ticket_type: 'Anytime', events: event },
    { ticket_type: 'Cortesía', events: event },
  ]), 220000);
});

test('Panel Tickets suma el tier real y no multiplica todo por el precio Early', () => {
  assert.equal(sumAttendeeRevenue([
    { ticket_type: 'Early', ticket_status: 'valid' },
    { ticket_type: 'Early', ticket_status: 'used' },
    { ticket_type: 'Anytime', ticket_status: 'valid' },
    { ticket_type: 'Anytime', ticket_status: 'valid' },
    { ticket_type: 'Cortesía', ticket_status: 'pending_registration' },
    { ticket_type: 'Anytime', ticket_status: 'cancelled' },
  ], event), 440000);
});

test('Panel Tickets cuenta una transacción multiboleta una sola vez', () => {
  assert.equal(sumAttendeeRevenue([
    { ticket_type: 'Anytime', ticket_status: 'valid', wompi_reference: 'MOVAIVA-2', amount_total: 240000 },
    { ticket_type: 'Anytime', ticket_status: 'valid', wompi_reference: 'MOVAIVA-2', amount_total: 240000 },
  ], event), 240000);
});

test('cualquier organizador puede usar tiers futuros sin caer en el precio base', () => {
  const futureEvent = {
    price: 85000,
    ticket_types: [
      { name: 'Preventa Comunidad', price: 85000, capacity: 60 },
      { name: 'Entrada Puerta', price: 135000, capacity: 40 },
    ],
  };

  assert.equal(sumAttendeeRevenue([
    { ticket_type: 'Preventa Comunidad', ticket_status: 'valid' },
    { ticket_type: 'Entrada Puerta', ticket_status: 'used' },
  ], futureEvent), 220000);
});

test('el dashboard consulta precios por tier, muestra el tipo y excluye anulados', () => {
  assert.match(dashboard, /events!inner\(price, ticket_types, owner_id\)/);
  assert.match(dashboard, /getTicketSaleAmount\(t\)/);
  assert.match(dashboard, /sumTicketRevenue\(ticketsAggRes\.data\)/);
  assert.match(dashboard, /totals\[ticket\.event_id\] \+= getTicketSaleAmount\(ticket\)/);
  assert.match(dashboard, /Total real por tipo emitido/);
  assert.doesNotMatch(dashboard, /sold\s*-\s*\(ev\.courtesies_issued[\s\S]*\*\s*\(ev\.price/);
  assert.match(dashboard, /\{t\.buyerName \|\| 'Usuario'\} · \{t\.ticket_type \|\| 'General'\}/);
  assert.match(dashboard, /\.in\('status', \['valid', 'used', 'pending_registration'\]\)/);
});
