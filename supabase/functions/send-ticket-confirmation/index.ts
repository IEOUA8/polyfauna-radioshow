import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

serve(async (req) => {
  try {
    const { userEmail, userName, eventTitle, eventDate, eventCity, ticketCode, qrDataUrl } = await req.json();
    const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';

    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const html = emailWrapper(`
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:900;color:#ffffff;">
        Tu ticket está listo 🎟️
      </h1>
      <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.45);">
        Hola ${userName}, aquí está tu entrada para el evento.
      </p>

      <!-- Ticket card -->
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:16px;overflow:hidden;margin-bottom:24px;">
        <div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.30);text-transform:uppercase;letter-spacing:2px;">Evento</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#ffffff;">${eventTitle}</p>
          ${formattedDate ? `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);">📅 ${formattedDate}</p>` : ''}
          ${eventCity   ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.45);">📍 ${eventCity}</p>` : ''}
        </div>

        <!-- QR -->
        ${qrDataUrl ? `
        <div style="padding:24px;text-align:center;background:white;border-radius:0 0 16px 16px;">
          <img src="${qrDataUrl}" alt="QR Code" style="width:200px;height:200px;display:block;margin:0 auto;" />
          <p style="margin:12px 0 0;font-size:11px;color:#666;font-family:monospace;">${ticketCode}</p>
        </div>` : `
        <div style="padding:20px 24px;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.40);">Código: <strong style="color:white;font-family:monospace;">${ticketCode}</strong></p>
        </div>`}
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.6;">
        También puedes ver y descargar tu ticket desde la plataforma en cualquier momento.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(255,255,255,0.9);border-radius:10px;font-size:13px;font-weight:900;color:#080B14;text-decoration:none;">
        Ver en Ticket Vault →
      </a>
    `);

    await sendEmail({
      to: userEmail,
      subject: `Tu ticket para ${eventTitle} — POLYFAUNA 🎟️`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
