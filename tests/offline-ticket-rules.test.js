import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOfflineTicket } from '../src/lib/offlineTicketRules.js';

const EVENT_ID = '223e4567-e89b-42d3-a456-426614174000';
const OTHER_EVENT_ID = '323e4567-e89b-42d3-a456-426614174000';
const TICKET_ID = '123e4567-e89b-42d3-a456-426614174000';

const verified = {
  valid: true,
  payload: { tid: TICKET_ID, eid: EVENT_ID },
};

const pack = {
  eventId: EVENT_ID,
  eventTitle: 'Noche PolyFauna',
  tickets: [
    { id: TICKET_ID, number: 'PF-001', type: 'GA', status: 'valid', full_name: 'Ana Pérez', document_type: 'CC', document_number: '12345678' },
    { id: '423e4567-e89b-42d3-a456-426614174000', number: 'PF-002', type: 'VIP', status: 'used' },
    { id: '523e4567-e89b-42d3-a456-426614174000', number: 'PF-003', type: 'GA', status: 'refunded' },
  ],
};

test('requiere evento seleccionado y QR firmado válido para validar offline', () => {
  assert.equal(evaluateOfflineTicket({ verified, eventId: null, pack }).code, 'OFFLINE_NO_EVENT');
  assert.equal(evaluateOfflineTicket({
    verified: { valid: false, error: 'Firma inválida' },
    eventId: EVENT_ID,
    pack,
  }).code, 'OFFLINE_UNSIGNED');
});

test('rechaza tickets de otro evento o que no estén en el paquete descargado', () => {
  assert.equal(evaluateOfflineTicket({
    verified: { valid: true, payload: { tid: TICKET_ID, eid: OTHER_EVENT_ID } },
    eventId: EVENT_ID,
    pack,
  }).code, 'WRONG_EVENT');

  assert.equal(evaluateOfflineTicket({
    verified: { valid: true, payload: { tid: '623e4567-e89b-42d3-a456-426614174000', eid: EVENT_ID } },
    eventId: EVENT_ID,
    pack,
  }).code, 'NOT_FOUND');
});

test('rechaza paquetes no preparados, tickets usados, reembolsados o ya escaneados localmente', () => {
  assert.equal(evaluateOfflineTicket({ verified, eventId: EVENT_ID, pack: null }).code, 'OFFLINE_NOT_READY');
  assert.equal(evaluateOfflineTicket({
    verified: { valid: true, payload: { tid: '423e4567-e89b-42d3-a456-426614174000', eid: EVENT_ID } },
    eventId: EVENT_ID,
    pack,
  }).code, 'ALREADY_USED');
  assert.equal(evaluateOfflineTicket({
    verified: { valid: true, payload: { tid: '523e4567-e89b-42d3-a456-426614174000', eid: EVENT_ID } },
    eventId: EVENT_ID,
    pack,
  }).code, 'INVALID_STATUS');
  assert.equal(evaluateOfflineTicket({ verified, eventId: EVENT_ID, pack, locallyUsed: true }).code, 'ALREADY_USED');
});

test('autoriza ticket offline válido con datos mínimos de sincronización visual', () => {
  const result = evaluateOfflineTicket({ verified, eventId: EVENT_ID, pack });
  assert.equal(result.code, 'VALID');
  assert.equal(result.success, true);
  assert.equal(result.offline, true);
  assert.equal(result.pendingSync, true);
  assert.equal(result.event_title, 'Noche PolyFauna');
  assert.equal(result.ticket_type, 'GA');
  assert.equal(result.ticket_number, 'PF-001');
  assert.equal(result.full_name, 'Ana Pérez');
  assert.equal(result.document_type, 'CC');
  assert.equal(result.document_number, '12345678');
});
