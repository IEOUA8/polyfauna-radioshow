import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, json, requireUser } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl, renderEmailTemplate } from '../_shared/email-templates.ts';
import { signTicketToken } from '../_shared/ticket-signing.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'No autenticado' }, 401);

    const { data: identity } = await admin
      .from('user_identity')
      .select('full_name, document_number')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!identity?.full_name || !identity?.document_number) {
      return json({ error: 'Ingresa tu nombre completo y número de cédula antes de confirmar la entrada' }, 400);
    }

    const { eventId, ticketType } = await req.json();
    if (
      typeof eventId !== 'string'
      || !UUID_RE.test(eventId)
      || typeof ticketType !== 'string'
      || !ticketType.trim()
      || ticketType.length > 60
    ) {
      return json({ error: 'Datos de entrada inválidos' }, 400);
    }

    const normalizedType = ['ga', 'general admission'].includes(ticketType.trim().toLowerCase())
      ? 'General'
      : ticketType.trim();
    if (normalizedType.toLowerCase() === 'cortesía' || normalizedType.toLowerCase() === 'cortesia') {
      return json({ error: 'Las cortesías solo pueden ser emitidas por el organizador' }, 403);
    }

    const { data: event } = await admin
      .from('events')
      .select('id, title, date, city, venue, status, ticket_types')
      .eq('id', eventId)
      .maybeSingle();
    if (!event || !['published', 'upcoming', 'live'].includes(event.status)) {
      return json({ error: 'El evento no está disponible' }, 400);
    }

    const tiers = Array.isArray(event.ticket_types) ? event.ticket_types : [];
    const tier = tiers.find((item: Record<string, unknown>) =>
      typeof item?.name === 'string' && item.name.toLowerCase() === normalizedType.toLowerCase()
    );
    if (!tier) return json({ error: 'Tipo de entrada no disponible' }, 400);
    if (Number(tier.price) !== 0) return json({ error: 'Esta entrada requiere pago' }, 400);

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: issued, error: issueError } = await userClient.rpc('purchase_ticket', {
      p_event_id: eventId,
      p_ticket_type: String(tier.name),
    });

    let ticketId = issued?.ticket_id;
    let alreadyProcessed = false;
    if (issueError || !issued?.success) {
      if (issued?.code !== 'DUPLICATE') {
        return json({ error: issued?.error || issueError?.message || 'No fue posible emitir la entrada' }, 400);
      }
      const { data: existing } = await admin
        .from('user_tickets')
        .select('id, ticket_type')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .maybeSingle();
      if (!existing || existing.ticket_type.toLowerCase() !== String(tier.name).toLowerCase()) {
        return json({ error: 'Ya tienes una entrada para este evento' }, 409);
      }
      ticketId = existing.id;
      alreadyProcessed = true;
    }

    const { data: ticket } = await admin
      .from('user_tickets')
      .select('id, ticket_number, ticket_type, confirmation_email_sent_at')
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!ticket) return json({ error: 'No fue posible recuperar la entrada' }, 500);

    let emailSent = Boolean(ticket.confirmation_email_sent_at);
    let emailWarning: string | null = null;
    if (!emailSent && user.email) {
      const claimedAt = new Date().toISOString();
      const { data: claimed } = await admin
        .from('user_tickets')
        .update({ confirmation_email_sent_at: claimedAt })
        .eq('id', ticket.id)
        .is('confirmation_email_sent_at', null)
        .select('id')
        .maybeSingle();

      if (claimed) {
        try {
          const { data: profile } = await admin
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle();
          const qrPayload = await signTicketToken(ticket.id, eventId, event.date);
          const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&format=png&margin=8`;
          const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
          const formattedDate = event.date
            ? new Date(event.date).toLocaleDateString('es-CO', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })
            : '';

          const html = renderEmailTemplate('ticketPurchased', {
            user_name: profile?.display_name || user.email.split('@')[0],
            event_name: event.title,
            event_date: formattedDate,
            event_venue: event.venue || event.city || 'Por confirmar',
            ticket_type: ticket.ticket_type,
            ticket_id: ticket.ticket_number,
            qr_url: publicEmailUrl(qrDataUrl),
            ticket_url: `${appUrl}/?section=tickets`,
          });
          await sendEmail({
            to: user.email,
            subject: `Ticket confirmado · ${String(event.title).replace(/[\r\n]/g, ' ')}`,
            html,
          });
          emailSent = true;
        } catch (emailError) {
          emailWarning = emailError instanceof Error ? emailError.message : 'No fue posible enviar el correo';
          await admin
            .from('user_tickets')
            .update({ confirmation_email_sent_at: null })
            .eq('id', ticket.id)
            .eq('confirmation_email_sent_at', claimedAt);
        }
      } else {
        emailSent = true;
      }
    }

    return json({
      success: true,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      ticket_type: ticket.ticket_type,
      already_processed: alreadyProcessed,
      email_sent: emailSent,
      email_warning: emailWarning,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
});
