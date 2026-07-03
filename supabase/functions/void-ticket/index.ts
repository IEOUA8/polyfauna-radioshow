import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { ticketId, reason } = await req.json();
    if (typeof ticketId !== 'string') {
      return json({ error: 'Datos inválidos' }, 400);
    }

    const { data, error } = await admin.rpc('void_ticket', {
      p_actor_id: user.id,
      p_ticket_id: ticketId,
      p_reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    });

    if (error || !data?.success) {
      const knownErrors: Record<string, string> = {
        ticket_not_found: 'Ticket no encontrado',
        event_not_found: 'Evento no encontrado',
        not_authorized: 'No tienes permiso para anular tickets de este evento',
        not_voidable_use_refund: 'Este ticket fue pagado por la pasarela; usa el flujo de devoluciones',
        already_used: 'El ticket ya fue validado en la entrada',
        already_cancelled: 'El ticket ya estaba anulado',
      };
      const message = error?.message || 'No fue posible anular el ticket';
      return json({ error: knownErrors[message] || message }, 400);
    }

    return json({
      ok: true,
      ticketNumber: data.ticket_number,
      ticketsVoidedTotal: data.tickets_voided_total,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
