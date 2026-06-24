import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  buildTicketQRPayload,
  parseTicketQRPayload,
  readSignedTicketPayload,
  verifySignedTicketQR,
} from '../src/lib/tickets.js';

const TICKET_ID = '123e4567-e89b-42d3-a456-426614174000';
const EVENT_ID = '223e4567-e89b-42d3-a456-426614174000';

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function signedTicket(payloadPatch = {}) {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const payload = {
    v: 1,
    iss: 'polyfauna',
    aud: 'entry',
    tid: TICKET_ID,
    eid: EVENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadPatch,
  };
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.privateKey,
    new TextEncoder().encode(body),
  );
  return {
    token: `polyfauna://ticket/v1/${body}.${base64Url(new Uint8Array(signature))}`,
    publicJwk,
    payload,
  };
}

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

test('verifica QR firmado válido y expone su payload', async () => {
  const { token, publicJwk, payload } = await signedTicket();
  const parsed = readSignedTicketPayload(token);
  assert.equal(parsed.payload.tid, TICKET_ID);
  assert.equal(parseTicketQRPayload(token), TICKET_ID);

  const result = await verifySignedTicketQR(token, { publicJwk });
  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, payload);
});

test('rechaza QR firmado expirado aunque la firma sea válida', async () => {
  const { token, publicJwk } = await signedTicket({ exp: Math.floor(Date.now() / 1000) - 10 });
  const result = await verifySignedTicketQR(token, { publicJwk });
  assert.equal(result.valid, false);
  assert.match(result.error, /expiró/);
});

test('rechaza QR firmado manipulado', async () => {
  const { token, publicJwk } = await signedTicket();
  const [prefix, signed] = token.split('/v1/');
  const [body, signature] = signed.split('.');
  const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  decoded.tid = '323e4567-e89b-42d3-a456-426614174000';
  const tamperedBody = base64Url(new TextEncoder().encode(JSON.stringify(decoded)));

  const result = await verifySignedTicketQR(`${prefix}/v1/${tamperedBody}.${signature}`, { publicJwk });
  assert.equal(result.valid, false);
  assert.match(result.error, /Firma/);
});
