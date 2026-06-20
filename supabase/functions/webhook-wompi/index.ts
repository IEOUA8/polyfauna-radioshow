import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const EVENTS_KEY = Deno.env.get('WOMPI_EVENTS_KEY')!;
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
    .select('*, events(date, title, owner_id)')
    .eq('wompi_reference', reference)
    .single();

  if (findErr || !transaction) {
    console.error('Webhook: transacción no encontrada:', reference, findErr?.message);
    return new Response(JSON.stringify({ error: 'Transacción no encontrada' }), { status: 404 });
  }

  if (transaction.status !== 'pending')
    return new Response(JSON.stringify({ received: true, note: 'ya procesado' }), { status: 200 });

  const ourStatus = STATUS_MAP[wompiStatus] ?? 'error';

  let releaseAt: string | null = null;
  if (ourStatus === 'approved' && transaction.events?.date) {
    const eventDate = new Date(transaction.events.date);
    eventDate.setHours(eventDate.getHours() + 48);
    releaseAt = eventDate.toISOString();
  }

  await supabase.from('transactions').update({
    status:               ourStatus,
    wompi_transaction_id: String(tx?.id ?? ''),
    payment_method:       String((tx?.payment_method as Record<string, unknown>)?.type ?? 'unknown'),
    wompi_payload:        tx,
    paid_at:              ourStatus === 'approved' ? new Date().toISOString() : null,
    release_at:           releaseAt,
  }).eq('id', transaction.id);

  // ── Si aprobado: emitir tickets ───────────────────────────────
  if (ourStatus === 'approved') {
    const quantity: number       = transaction.quantity ?? 1;
    const assignedEmails: (string | null)[] = transaction.assigned_emails ?? [];
    const firstTicketId: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const ticketIndex    = i + 1;
      // Ticket 1 = comprador; tickets 2-4 = email asignado (si hay)
      const assignedEmail  = i === 0 ? null : (assignedEmails[i - 1] ?? null);

      // Determinar a qué usuario pertenece este ticket
      let targetUserId = transaction.buyer_id;
      if (assignedEmail) {
        const { data: foundId } = await supabase.rpc('get_user_id_by_email', {
          p_email: assignedEmail,
        });
        if (foundId) targetUserId = foundId;
      }

      const { data: ticketResult, error: ticketErr } = await supabase
        .rpc('issue_ticket_v2', {
          p_event_id:       transaction.event_id,
          p_user_id:        targetUserId,
          p_ticket_type:    'GA',
          p_ticket_index:   ticketIndex,
          p_assigned_email: assignedEmail,
        });

      if (ticketErr) {
        console.error(`Webhook: error emitiendo ticket ${ticketIndex}:`, ticketErr.message);
      } else if (ticketResult?.success && ticketResult?.ticket_id) {
        console.log(`Webhook: ticket ${ticketIndex}/${quantity} emitido → ${ticketResult.ticket_id}`);
        if (ticketIndex === 1) firstTicketId.push(ticketResult.ticket_id);
      } else {
        console.warn(`Webhook: ticket ${ticketIndex} no emitido:`, ticketResult?.error ?? 'sin detalle');
      }
    }

    // Vincular primer ticket a la transacción (para compatibilidad)
    if (firstTicketId.length > 0) {
      await supabase.from('transactions')
        .update({ ticket_id: firstTicketId[0] })
        .eq('id', transaction.id);
    }

    // Actualizar wallet del promotor
    if (transaction.promoter_id) {
      await supabase.rpc('add_to_pending_wallet', {
        p_user_id: transaction.promoter_id,
        p_amount:  transaction.promoter_amount,
        p_total:   transaction.promoter_amount,
      });
    }

    console.log(`Webhook OK: transacción ${transaction.id} aprobada — ${quantity} ticket(s) emitidos`);
  } else {
    console.log(`Webhook: transacción ${transaction.id} → ${ourStatus}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
