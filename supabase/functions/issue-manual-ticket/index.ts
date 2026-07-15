import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl } from '../_shared/email-templates.ts';
import { findTicketTier, renderTicketPurchasedEmail } from '../_shared/ticket-email-rules.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { eventId, userEmail, ticketType, paymentReference } = await req.json();
    if (
      typeof eventId !== 'string'
      || typeof userEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())
      || typeof ticketType !== 'string'
      || typeof paymentReference !== 'string'
    ) {
      return json({ error: 'Datos de emisión inválidos' }, 400);
    }

    const { data: ticket, error } = await admin.rpc('issue_manual_transfer_ticket', {
      p_actor_id: user.id,
      p_event_id: eventId,
      p_user_email: userEmail.trim().toLowerCase(),
      p_ticket_type: ticketType.trim(),
      p_payment_reference: paymentReference.trim(),
    });

    if (error || !ticket?.success) {
      const knownErrors: Record<string, string> = {
        event_not_found: 'Evento no encontrado',
        not_authorized: 'No tienes permiso para emitir tickets de este evento',
        user_not_found: 'El correo no pertenece a una cuenta PolyFauna',
        invalid_ticket_type: 'El tipo de entrada no está disponible',
        payment_reference_required: 'Ingresa la referencia de la transferencia',
        payment_reference_already_used: 'La referencia bancaria ya fue utilizada',
        event_sold_out: 'El evento está agotado',
        ticket_type_sold_out: 'Este tipo de entrada está agotado',
      };
      const message = error?.message || 'No fue posible emitir el ticket';
      return json({ error: knownErrors[message] || message }, 400);
    }

    let emailSent = false;
    let emailWarning: string | null = null;
    try {
      const { data: { user: ticketUser } } = await admin.auth.admin.getUserById(ticket.user_id);
      const { data: profile } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', ticket.user_id)
        .maybeSingle();

      if (!ticketUser?.email) throw new Error('El usuario no tiene correo disponible');

      const qrPayload = await signTicketToken(ticket.ticket_id, eventId, ticket.event_date);
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;
      const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';
      const { data: eventConfig } = await admin
        .from('events')
        .select('ticket_types')
        .eq('id', eventId)
        .maybeSingle();
      const ticketTier = findTicketTier(eventConfig?.ticket_types, ticket.ticket_type);
      const formattedDate = ticket.event_date
        ? new Date(ticket.event_date).toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        : '';

      const html = renderTicketPurchasedEmail({
        user_name: profile?.display_name || ticketUser.email.split('@')[0],
        event_name: ticket.event_title,
        event_date: formattedDate,
        event_venue: ticket.event_city || 'Por confirmar',
        ticket_type: ticket.ticket_type,
        ticket_id: ticket.ticket_number,
        qr_url: publicEmailUrl(qrDataUrl),
        ticket_url: `${appUrl}/?section=tickets`,
      }, ticketTier);

      await sendEmail({
        to: ticketUser.email,
        subject: `Ticket confirmado · ${String(ticket.event_title).replace(/[\r\n]/g, ' ')}`,
        html,
      });
      emailSent = true;
    } catch (emailError) {
      emailWarning = emailError instanceof Error ? emailError.message : 'No fue posible enviar el correo';
    }

    return json({
      ok: true,
      alreadyProcessed: ticket.already_processed,
      ticketNumber: ticket.ticket_number,
      emailSent,
      emailWarning,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
});
