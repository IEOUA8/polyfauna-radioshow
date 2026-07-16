import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getTicketSaleAmount,
  getTicketTierPrice,
  sumTicketRevenue,
} from '../src/lib/ticketPricing.js';

const dashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

const event = {
  price: 100000,
  ticket_types: [
    { name: 'Early', price: 100000 },
    { name: 'Anytime', price: 120000 },
    { name: 'Gratis', price: 0 },
  ],
};

test('el precio corresponde al tipo de ticket y no al precio Early del evento', () => {
  assert.equal(getTicketTierPrice(event, 'Early'), 100000);
  assert.equal(getTicketTierPrice(event, 'Anytime'), 120000);
  assert.equal(getTicketTierPrice(event, 'anytime'), 120000);
  assert.equal(getTicketTierPrice(event, 'Gratis'), 0);
  assert.equal(getTicketTierPrice(event, 'Cortesía'), 0);
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

test('el dashboard consulta precios por tier, muestra el tipo y excluye anulados', () => {
  assert.match(dashboard, /events!inner\(price, ticket_types, owner_id\)/);
  assert.match(dashboard, /getTicketSaleAmount\(t\)/);
  assert.match(dashboard, /sumTicketRevenue\(ticketsAggRes\.data\)/);
  assert.match(dashboard, /\{t\.buyerName \|\| 'Usuario'\} · \{t\.ticket_type \|\| 'General'\}/);
  assert.match(dashboard, /\.in\('status', \['valid', 'used', 'pending_registration'\]\)/);
});
