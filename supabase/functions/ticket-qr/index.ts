import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { admin, user } = await requireUser(req);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const { ticketId } = await req.json().catch(() => ({}));
  if (!ticketId) return json({ error: 'ticketId requerido' }, 400);

  const { data: ticket, error } = await admin
    .from('user_tickets')
    .select('id, user_id, event_id, events(owner_id, date)')
    .eq('id', ticketId).single();
  if (error || !ticket) return json({ error: 'Ticket no encontrado' }, 404);

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
  const allowed = ticket.user_id === user.id || event?.owner_id === user.id || profile?.role === 'admin';
  if (!allowed) return json({ error: 'Sin autorización' }, 403);

  const token = await signTicketToken(ticket.id, ticket.event_id, event?.date);
  return json({ token });
});

