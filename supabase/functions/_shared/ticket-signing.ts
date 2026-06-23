const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

export type TicketTokenPayload = {
  v: 1;
  iss: 'polyfauna';
  aud: 'entry';
  tid: string;
  eid: string;
  iat: number;
  exp: number;
};

export async function signTicketToken(ticketId: string, eventId: string, eventDate?: string | null) {
  const privateJwk = Deno.env.get('TICKET_QR_PRIVATE_JWK');
  if (!privateJwk) throw new Error('TICKET_QR_PRIVATE_JWK no configurado');
  const key = await crypto.subtle.importKey(
    'jwk', JSON.parse(privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const eventTime = eventDate ? Math.floor(new Date(eventDate).getTime() / 1000) : 0;
  const payload: TicketTokenPayload = {
    v: 1, iss: 'polyfauna', aud: 'entry', tid: ticketId, eid: eventId,
    iat: now, exp: Math.max(now + 86400, eventTime + 172800),
  };
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(body));
  return `polyfauna://ticket/v1/${body}.${base64Url(new Uint8Array(signature))}`;
}

