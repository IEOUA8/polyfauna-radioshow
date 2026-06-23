import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { signTicketToken } from '../_shared/ticket-signing.ts';

async function sha256hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const STATUS_MAP: Record<string, string> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED:   'voided',
  ERROR:    'error',
};

async function sendPush(body: Record<string, unknown>) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST')
    return new Response('Method not allowed', { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { event, data, timestamp, signature } = body as {
    event: string;
    data: Record<string, unknown>;
    timestamp: number;
    signature: { checksum: string; properties: string[] };
  };

  // ── Validar firma de Wompi ──────────────────────────────────────
  const EVENTS_KEY = Deno.env.get('WOMPI_EVENTS_KEY');
  if (!EVENTS_KEY)
    return new Response(JSON.stringify({ error: 'Webhook no configurado' }), { status: 503 });
  const properties: string[] = signature?.properties ?? [];
  const values = properties.map(p => String(getNestedValue(data, p) ?? ''));
  const concat = values.join('') + String(timestamp) + EVENTS_KEY;
  const expectedChecksum = await sha256hex(concat);

  if (expectedChecksum !== signature?.checksum) {
    console.error('Webhook: firma inválida');
    return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 400 });
  }

  if (event !== 'transaction.updated')
    return new Response(JSON.stringify({ received: true }), { status: 200 });

  const tx = (data as Record<string, unknown>).transaction as Record<string, unknown>;
  const reference   = String(tx?.reference ?? '');
  const wompiStatus = String(tx?.status ?? '');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Buscar transacción ────────────────────────────────────────
  const { data: transaction, error: findErr } = await supabase
    .from('transactions')
    .select('*, events(date, title, city, owner_id)')
    .eq('wompi_reference', reference)
    .single();

  if (findErr || !transaction) {
    console.error('Webhook: transacción no encontrada:', reference, findErr?.message);
    return new Response(JSON.stringify({ error: 'Transacción no encontrada' }), { status: 404 });
  }

  if (transaction.status !== 'pending')
    return new Response(JSON.stringify({ received: true, note: 'ya procesado' }), { status: 200 });

  // La firma prueba el origen del evento; además debemos comprobar que Wompi
  // cobró exactamente el monto y la moneda que registramos al crear el checkout.
  const receivedAmount = Number(tx?.amount_in_cents);
  const receivedCurrency = String(tx?.currency ?? '').toUpperCase();
  const expectedAmount = Number(transaction.amount_total) * 100;
  if (receivedAmount !== expectedAmount || receivedCurrency !== 'COP') {
    console.error('Webhook: monto o moneda no coinciden', { reference, receivedAmount, expectedAmount, receivedCurrency });
    await supabase.from('transactions').update({
      status: 'error',
      wompi_transaction_id: String(tx?.id ?? ''),
      wompi_payload: tx,
    }).eq('id', transaction.id).eq('status', 'pending');
    return new Response(JSON.stringify({ error: 'Monto o moneda inválidos' }), { status: 400 });
  }

  const ourStatus = STATUS_MAP[wompiStatus] ?? 'error';

  let releaseAt: string | null = null;
  if (ourStatus === 'approved' && transaction.events?.date) {
    const eventDate = new Date(transaction.events.date);
    eventDate.setHours(eventDate.getHours() + 48);
    releaseAt = eventDate.toISOString();
  }

  // Los estados no aprobados no emiten entradas.
  if (ourStatus !== 'approved') {
    const { data: closed, error: closeError } = await supabase.from('transactions').update({
      status: ourStatus,
      wompi_transaction_id: String(tx?.id ?? ''),
      payment_method: String((tx?.payment_method as Record<string, unknown>)?.type ?? 'unknown'),
      wompi_payload: tx,
    }).eq('id', transaction.id).eq('status', 'pending').select('id').maybeSingle();

    if (closeError) {
      console.error('Webhook: no se pudo cerrar la transacción', closeError.message);
      return new Response(JSON.stringify({ error: 'No se pudo actualizar la transacción' }), { status: 500 });
    }
    return new Response(JSON.stringify({ received: true, note: closed ? ourStatus : 'ya procesado' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // La emisión completa y el crédito al promotor ocurren atómicamente dentro
  // de PostgreSQL. Un reintento del webhook devuelve los tickets ya creados.
  const { data: fulfillment, error: fulfillmentError } = await supabase.rpc('fulfill_paid_transaction', {
    p_transaction_id: transaction.id,
    p_wompi_transaction_id: String(tx?.id ?? ''),
    p_payment_method: String((tx?.payment_method as Record<string, unknown>)?.type ?? 'unknown'),
    p_wompi_payload: tx,
    p_release_at: releaseAt,
  });

  if (fulfillmentError || !fulfillment?.success) {
    console.error('Webhook: no se pudo completar la compra', fulfillmentError?.message ?? fulfillment?.error);
    return new Response(JSON.stringify({ error: 'No se pudo emitir la compra completa' }), { status: 500 });
  }

  const ticketIds: string[] = Array.isArray(fulfillment.ticket_ids) ? fulfillment.ticket_ids : [];
  const firstTicketId = ticketIds[0];

    // Enviar email de confirmación al comprador
    if (firstTicketId && transaction.buyer_id && !fulfillment.already_processed) {
      try {
        const { data: { user: buyerUser } } = await supabase.auth.admin.getUserById(transaction.buyer_id);
        const { data: buyerProfile } = await supabase
          .from('profiles').select('display_name').eq('id', transaction.buyer_id).single();

        if (buyerUser?.email) {
          const { data: issuedTicket } = await supabase
            .from('user_tickets').select('ticket_number, ticket_type').eq('id', firstTicketId).single();

          const ticketCode = issuedTicket?.ticket_number || firstTicketId;
          const qrPayload  = await signTicketToken(firstTicketId, transaction.event_id, transaction.events?.date);
          const qrDataUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;

          await supabase.functions.invoke('send-ticket-confirmation', {
            body: {
              userEmail:  buyerUser.email,
              userName:   buyerProfile?.display_name || buyerUser.email.split('@')[0],
              eventTitle: transaction.events?.title || 'Evento POLYFAUNA',
              eventDate:  transaction.events?.date,
              eventCity:  transaction.events?.city,
              ticketCode,
              ticketType: issuedTicket?.ticket_type || 'GA',
              qrDataUrl,
            },
          });

          await sendPush({
            userId: transaction.buyer_id,
            title: 'Ticket confirmado',
            body: `Tu acceso para ${transaction.events?.title || 'el evento'} ya está en tu Ticket Vault.`,
            url: `${Deno.env.get('APP_URL') || 'https://www.polyfauna.com'}/?section=tickets`,
          });
        }
      } catch (emailErr) {
        console.error('Webhook: error enviando confirmación de ticket:', emailErr);
      }
    }

  console.log(`Webhook OK: transacción ${transaction.id} aprobada — ${ticketIds.length} ticket(s) emitidos`);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
