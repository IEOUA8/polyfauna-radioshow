import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl } from '../_shared/email-templates.ts';
import {
  findTicketTier,
  renderPendingTicketActivationEmail,
  renderTicketPurchasedEmail,
} from '../_shared/ticket-email-rules.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { eventId, userEmail, ticketType, paymentReference, issuanceKey } = await req.json();
    // Compatibilidad con versiones anteriores del formulario que pueden seguir
    // abiertas o servidas desde el service worker. Los clientes actuales envían
    // una llave estable para reintentos; los antiguos reciben una llave segura
    // por solicitud para que ningún tipo de ticket quede bloqueado.
    const normalizedIssuanceKey = issuanceKey === undefined || issuanceKey === null || issuanceKey === ''
      ? crypto.randomUUID()
      : typeof issuanceKey === 'string' && /^[0-9a-f-]{20,80}$/i.test(issuanceKey.trim())
        ? issuanceKey.trim()
        : null;
    if (
      typeof eventId !== 'string'
      || typeof userEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())
      || typeof ticketType !== 'string'
      || typeof paymentReference !== 'string'
      || !paymentReference.trim()
      || !normalizedIssuanceKey
    ) {
      return json({ error: 'Datos de emisión inválidos' }, 400);
    }

    const { data: eventConfig } = await admin
      .from('events')
      .select('ticket_types')
      .eq('id', eventId)
      .maybeSingle();
    const requestedTier = findTicketTier(eventConfig?.ticket_types, ticketType.trim());
    if (!requestedTier || requestedTier.active === false) {
      return json({ error: 'El tipo de entrada no está disponible' }, 400);
    }

    const { data: ticket, error } = await admin.rpc('issue_manual_transfer_ticket', {
      p_actor_id: user.id,
      p_event_id: eventId,
      p_user_email: userEmail.trim().toLowerCase(),
      p_ticket_type: ticketType.trim(),
      p_payment_reference: paymentReference.trim(),
      p_issuance_key: normalizedIssuanceKey,
    });

    if (error || !ticket?.success) {
      const knownErrors: Record<string, string> = {
        event_not_found: 'Evento no encontrado',
        not_authorized: 'No tienes permiso para emitir tickets de este evento',
        invalid_ticket_type: 'El tipo de entrada no está disponible',
        payment_reference_required: 'Ingresa la referencia de venta',
        issuance_key_required: 'No fue posible identificar esta emisión. Cierra el formulario e intenta nuevamente',
        issuance_key_already_used: 'Esta emisión ya fue utilizada para otro ticket',
        event_sold_out: 'El evento está agotado',
        ticket_type_sold_out: 'Este tipo de entrada está agotado',
      };
      const message = error?.message || 'No fue posible emitir el ticket';
      return json({ error: knownErrors[message] || message }, 400);
    }

    const isPending = Boolean(ticket.pending);
    let emailSent = false;
    let emailWarning: string | null = null;
    const claimedAt = new Date().toISOString();
    const { data: notificationClaim } = await admin
      .from('user_tickets')
      .update({ confirmation_email_sent_at: claimedAt })
      .eq('id', ticket.ticket_id)
      .is('confirmation_email_sent_at', null)
      .select('id')
      .maybeSingle();

    if (!notificationClaim) {
      return json({
        ok: true,
        alreadyProcessed: true,
        pending: isPending,
        ticketNumber: ticket.ticket_number,
        emailSent: true,
        emailWarning: null,
      });
    }

    try {
      const recipientEmail = ticket.recipient_email || userEmail.trim().toLowerCase();
      if (!recipientEmail) throw new Error('El destinatario no tiene correo disponible');

      const qrPayload = await signTicketToken(ticket.ticket_id, eventId, ticket.event_date);
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;
      const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';
      const ticketTier = findTicketTier(eventConfig?.ticket_types, ticket.ticket_type);
      const formattedDate = ticket.event_date
        ? new Date(ticket.event_date).toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        : '';

      let html: string;
      if (isPending) {
        html = renderPendingTicketActivationEmail({
          event_name: ticket.event_title,
          event_date: formattedDate,
          event_venue: ticket.event_city || 'Por confirmar',
          ticket_type: ticket.ticket_type,
          ticket_id: ticket.ticket_number,
          qr_url: publicEmailUrl(qrDataUrl),
          recipient_email: recipientEmail,
          signup_url: `${appUrl}/signup?email=${encodeURIComponent(recipientEmail)}`,
        }, ticketTier);
      } else {
        const { data: profile } = await admin
          .from('profiles')
          .select('display_name')
          .eq('id', ticket.user_id)
          .maybeSingle();

        html = renderTicketPurchasedEmail({
          user_name: profile?.display_name || recipientEmail.split('@')[0],
          event_name: ticket.event_title,
          event_date: formattedDate,
          event_venue: ticket.event_city || 'Por confirmar',
          ticket_type: ticket.ticket_type,
          ticket_id: ticket.ticket_number,
          qr_url: publicEmailUrl(qrDataUrl),
          ticket_url: `${appUrl}/?section=tickets`,
        }, ticketTier);
      }

      await sendEmail({
        to: recipientEmail,
        subject: isPending
          ? `Activa tu ticket · ${String(ticket.event_title).replace(/[\r\n]/g, ' ')}`
          : `Ticket confirmado · ${String(ticket.event_title).replace(/[\r\n]/g, ' ')}`,
        html,
        idempotencyKey: `manual-ticket/${ticket.ticket_id}`,
        tags: [
          { name: 'category', value: isPending ? 'ticket_pending' : 'ticket_confirmed' },
          { name: 'entity_id', value: ticket.ticket_id },
        ],
      });
      emailSent = true;
    } catch (emailError) {
      emailWarning = emailError instanceof Error ? emailError.message : 'No fue posible enviar el correo';
      await admin
        .from('user_tickets')
        .update({ confirmation_email_sent_at: null })
        .eq('id', ticket.ticket_id)
        .eq('confirmation_email_sent_at', claimedAt);
    }

    return json({
      ok: true,
      alreadyProcessed: ticket.already_processed,
      pending: isPending,
      ticketNumber: ticket.ticket_number,
      emailSent,
      emailWarning,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
});
