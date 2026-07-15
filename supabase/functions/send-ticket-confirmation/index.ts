import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail } from '../_shared/resend.ts';
import { publicEmailUrl } from '../_shared/email-templates.ts';
import { renderTicketPurchasedEmail } from '../_shared/ticket-email-rules.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

serve(async (req) => {
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey || req.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });

    const {
      userEmail, userName, eventTitle, eventDate, eventCity, ticketCode, ticketType,
      qrDataUrl, entryCutoffAt, lateEntryFee,
    } = await req.json();
    if (typeof userEmail !== 'string' || !userEmail.includes('@') || typeof eventTitle !== 'string' || !eventTitle.trim())
      return new Response(JSON.stringify({ error: 'Datos de ticket inválidos' }), { status: 400, headers: JSON_HEADERS });

    const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const html = renderTicketPurchasedEmail({
      user_name: userName || 'Raver',
      event_name: eventTitle,
      event_date: formattedDate,
      event_venue: eventCity || 'Por confirmar',
      ticket_type: ticketType || 'GA',
      ticket_id: ticketCode,
      qr_url: publicEmailUrl(qrDataUrl),
      ticket_url: `${appUrl}/?section=tickets`,
    }, {
      entry_cutoff_at: entryCutoffAt,
      late_entry_fee: lateEntryFee,
    });

    await sendEmail({
      to: userEmail,
      subject: `Ticket confirmado · ${eventTitle.replace(/[\r\n]/g, ' ')}`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: JSON_HEADERS });
  }
});
