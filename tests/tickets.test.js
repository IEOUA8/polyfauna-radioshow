import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTicketQRPayload, parseTicketQRPayload } from '../src/lib/tickets.js';

const TICKET_ID = '123e4567-e89b-42d3-a456-426614174000';

test('genera y recupera el payload canónico de un ticket', () => {
  const payload = buildTicketQRPayload(TICKET_ID);
  assert.equal(payload, `polyfauna://ticket/${TICKET_ID}`);
  assert.equal(parseTicketQRPayload(payload), TICKET_ID);
});

test('acepta UUID directo y el formato JSON legado', () => {
  assert.equal(parseTicketQRPayload(TICKET_ID), TICKET_ID);
  assert.equal(parseTicketQRPayload(JSON.stringify({ id: TICKET_ID, code: 'OLD' })), TICKET_ID);
});

test('rechaza payloads manipulados o IDs inválidos', () => {
  assert.equal(parseTicketQRPayload('polyfauna://ticket/not-a-ticket'), null);
  assert.equal(parseTicketQRPayload('{"id":"../../etc/passwd"}'), null);
  assert.throws(() => buildTicketQRPayload('bad-id'), /inválido/);
});
