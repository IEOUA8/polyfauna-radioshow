import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl, renderEmailTemplate } from '../_shared/email-templates.ts';
import { findTicketTier, injectEarlyTicketRules, renderTicketPurchasedEmail } from '../_shared/ticket-email-rules.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { ticketId, newEmail } = await req.json();
    if (
      typeof ticketId !== 'string'
      || typeof newEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())
    ) {
      return json({ error: 'Datos inválidos' }, 400);
    }

    const { data: result, error } = await admin.rpc('transfer_ticket', {
      p_actor_id: user.id,
      p_ticket_id: ticketId,
      p_new_email: newEmail.trim().toLowerCase(),
    });

    if (error || !result?.success) {
      const knownErrors: Record<string, string> = {
        ticket_not_found: 'Ticket no encontrado',
        event_not_found: 'Evento no encontrado',
        not_authorized: 'No tienes permiso para transferir tickets de este evento',
        not_transferable_use_refund: 'Este ticket fue pagado por la pasarela; usa el flujo de devoluciones',
        already_used: 'El ticket ya fue validado en la entrada',
        already_cancelled: 'El ticket ya estaba anulado',
      };
      const message = error?.message || 'No fue posible transferir el ticket';
      return json({ error: knownErrors[message] || message }, 400);
    }

    const isPending = Boolean(result.pending);
    let emailSent = false;
    let notificationSent = false;

    try {
      const qrPayload = await signTicketToken(result.ticket_id, result.event_id, result.event_date);
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;
      const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
      const { data: eventConfig } = await admin
        .from('events')
        .select('ticket_types')
        .eq('id', result.event_id)
        .maybeSingle();
      const ticketTier = findTicketTier(eventConfig?.ticket_types, result.ticket_type);
      const formattedDate = result.event_date
        ? new Date(result.event_date).toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        : '';

      if (isPending) {
        const pendingHtml = renderEmailTemplate('courtesyPendingActivation', {
          event_name: result.event_title,
          event_date: formattedDate,
          event_venue: result.event_city || 'Por confirmar',
          ticket_id: result.ticket_number,
          qr_url: publicEmailUrl(qrDataUrl),
          recipient_email: result.recipient_email,
          signup_url: `${appUrl}/signup?email=${encodeURIComponent(result.recipient_email)}`,
        });
        const html = injectEarlyTicketRules(pendingHtml, result.ticket_type, ticketTier);
        await sendEmail({
          to: result.recipient_email,
          subject: `Tienes una entrada esperando · ${String(result.event_title).replace(/[\r\n]/g, ' ')}`,
          html,
        });
        emailSent = true;
      } else {
        const { data: identity } = await admin
          .from('user_identity')
          .select('full_name')
          .eq('user_id', result.user_id)
          .maybeSingle();

        const html = renderTicketPurchasedEmail({
          user_name: identity?.full_name || result.recipient_email.split('@')[0],
          event_name: result.event_title,
          event_date: formattedDate,
          event_venue: result.event_city || 'Por confirmar',
          ticket_type: result.ticket_type,
          ticket_id: result.ticket_number,
          qr_url: publicEmailUrl(qrDataUrl),
          ticket_url: `${appUrl}/?section=tickets`,
        }, ticketTier);
        await sendEmail({
          to: result.recipient_email,
          subject: `Te transfirieron una entrada · ${String(result.event_title).replace(/[\r\n]/g, ' ')}`,
          html,
        });
        emailSent = true;

        const { error: notifError } = await admin.rpc('create_notification', {
          p_type: 'ticket',
          p_title: 'Te transfirieron una entrada',
          p_body: `Tu entrada para ${result.event_title} ya está en tu Ticket Vault.`,
          p_action_section: 'tickets',
          p_user_id: result.user_id,
        });
        notificationSent = !notifError;
      }
    } catch (notifyError) {
      return json({
        ok: true,
        pending: isPending,
        ticketNumber: result.ticket_number,
        emailSent,
        notificationSent,
        notificationWarning: notifyError instanceof Error ? notifyError.message : 'No fue posible notificar al destinatario',
      });
    }

    return json({
      ok: true,
      pending: isPending,
      ticketNumber: result.ticket_number,
      emailSent,
      notificationSent,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
