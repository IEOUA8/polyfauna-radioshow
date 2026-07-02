import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl, renderEmailTemplate } from '../_shared/email-templates.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

async function sendPush(userId: string, eventTitle: string) {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      title: 'Cortesía confirmada',
      body: `Tu cortesía para ${eventTitle} ya está en tu Ticket Vault.`,
      url: `${Deno.env.get('APP_URL') || 'https://www.polyfauna.com'}/?section=tickets`,
    }),
  });
  if (!response.ok) throw new Error(`Push error ${response.status}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { eventId, userEmail } = await req.json();
    if (
      typeof eventId !== 'string'
      || typeof userEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())
    ) {
      return json({ error: 'Datos de cortesía inválidos' }, 400);
    }

    const { data: ticket, error } = await admin.rpc('issue_courtesy_ticket', {
      p_actor_id: user.id,
      p_event_id: eventId,
      p_user_email: userEmail.trim().toLowerCase(),
    });

    if (error || !ticket?.success) {
      const knownErrors: Record<string, string> = {
        event_not_found: 'Evento no encontrado',
        not_authorized: 'No tienes permiso para emitir cortesías de este evento',
        user_not_found: 'El correo no pertenece a una cuenta PolyFauna',
        identity_required: 'El usuario debe completar nombre y documento en su perfil antes de recibir la cortesía',
        courtesy_not_configured: 'Este evento no tiene cupos de cortesía configurados',
        courtesy_sold_out: 'Se agotaron las cortesías disponibles',
        event_sold_out: 'El evento está agotado',
      };
      const message = error?.message || 'No fue posible emitir la cortesía';
      return json({ error: knownErrors[message] || message }, 400);
    }

    let emailSent = false;
    let pushSent = false;
    let notificationWarning: string | null = null;
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
        ticketNumber: ticket.ticket_number,
        emailSent: true,
        pushSent: true,
        notificationWarning: null,
      });
    }

    try {
      const { data: { user: ticketUser } } = await admin.auth.admin.getUserById(ticket.user_id);
      const { data: identity } = await admin
        .from('user_identity')
        .select('full_name')
        .eq('user_id', ticket.user_id)
        .maybeSingle();
      if (!ticketUser?.email) throw new Error('El usuario no tiene correo disponible');

      const qrPayload = await signTicketToken(ticket.ticket_id, eventId, ticket.event_date);
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;
      const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
      const formattedDate = ticket.event_date
        ? new Date(ticket.event_date).toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        : '';

      const html = renderEmailTemplate('ticketPurchased', {
        user_name: identity?.full_name || ticketUser.email.split('@')[0],
        event_name: ticket.event_title,
        event_date: formattedDate,
        event_venue: ticket.event_city || 'Por confirmar',
        ticket_type: 'Cortesía',
        ticket_id: ticket.ticket_number,
        qr_url: publicEmailUrl(qrDataUrl),
        ticket_url: `${appUrl}/?section=tickets`,
      });

      await sendEmail({
        to: ticketUser.email,
        subject: `Cortesía confirmada · ${String(ticket.event_title).replace(/[\r\n]/g, ' ')}`,
        html,
      });
      emailSent = true;

      try {
        await sendPush(ticket.user_id, ticket.event_title);
        pushSent = true;
      } catch (pushError) {
        notificationWarning = pushError instanceof Error ? pushError.message : 'Push no disponible';
      }
    } catch (notificationError) {
      notificationWarning = notificationError instanceof Error
        ? notificationError.message
        : 'No fue posible enviar la notificación';
      await admin
        .from('user_tickets')
        .update({ confirmation_email_sent_at: null })
        .eq('id', ticket.ticket_id)
        .eq('confirmation_email_sent_at', claimedAt);
    }

    return json({
      ok: true,
      alreadyProcessed: ticket.already_processed,
      ticketNumber: ticket.ticket_number,
      emailSent,
      pushSent,
      notificationWarning,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
});
