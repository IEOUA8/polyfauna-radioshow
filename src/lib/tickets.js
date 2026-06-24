import { TICKET_SIGNING_PUBLIC_JWK } from './ticketSigningKey.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SIGNED_PATTERN = /^polyfauna:\/\/ticket\/v1\/([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

function decodeBase64Url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function readSignedTicketPayload(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(SIGNED_PATTERN);
  if (!match) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(match[1])));
    return { payload, body: match[1], signature: match[2] };
  } catch (_) {
    return null;
  }
}

export async function verifySignedTicketQR(raw, options = {}) {
  const parsed = readSignedTicketPayload(raw);
  if (!parsed) return { valid: false, error: 'Este QR no tiene firma offline' };
  const { payload, body, signature } = parsed;
  if (payload?.v !== 1 || payload?.iss !== 'polyfauna' || payload?.aud !== 'entry'
    || !UUID_PATTERN.test(payload?.tid || '') || !UUID_PATTERN.test(payload?.eid || '')) {
    return { valid: false, error: 'Contenido de QR inválido' };
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    return { valid: false, error: 'La firma del ticket expiró' };
  }
  try {
    const key = await crypto.subtle.importKey(
      'jwk', options.publicJwk || TICKET_SIGNING_PUBLIC_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, key, decodeBase64Url(signature), new TextEncoder().encode(body),
    );
    return valid ? { valid: true, payload } : { valid: false, error: 'Firma de ticket inválida' };
  } catch (_) {
    return { valid: false, error: 'Este dispositivo no pudo verificar la firma' };
  }
}

export function buildTicketQRPayload(ticketId) {
  if (!UUID_PATTERN.test(ticketId || '')) throw new Error('ID de ticket inválido');
  return `polyfauna://ticket/${ticketId}`;
}

export function parseTicketQRPayload(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const signed = readSignedTicketPayload(value);
  if (signed && UUID_PATTERN.test(signed.payload?.tid || '')) return signed.payload.tid;
  const uriMatch = value.match(/^polyfauna:\/\/ticket\/([0-9a-f-]{36})$/i);
  if (uriMatch && UUID_PATTERN.test(uriMatch[1])) return uriMatch[1];
  if (UUID_PATTERN.test(value)) return value;

  // Compatibilidad con QRs enviados por versiones anteriores.
  try {
    const legacy = JSON.parse(value);
    return UUID_PATTERN.test(legacy?.id || '') ? legacy.id : null;
  } catch (_) {
    return null;
  }
}
