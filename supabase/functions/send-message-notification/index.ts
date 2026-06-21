import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

serve(async (req) => {
  try {
    const { toEmail, toName, fromName, subject, preview } = await req.json();
    const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';

    const html = emailWrapper(`
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#ffffff;">
        Nuevo mensaje en Signal Inbox 📨
      </h1>
      <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.45);">
        Hola ${toName}, tienes un mensaje de <strong style="color:#20C7E8;">${fromName}</strong>.
      </p>

      ${subject ? `
      <div style="background:rgba(32,199,232,0.06);border:1px solid rgba(32,199,232,0.14);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(32,199,232,0.60);text-transform:uppercase;letter-spacing:1.5px;">Asunto</p>
        <p style="margin:0 0 ${preview ? '10px' : '0'};font-size:14px;font-weight:700;color:white;">${subject}</p>
        ${preview ? `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.40);line-height:1.5;">${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}</p>` : ''}
      </div>` : ''}

      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(32,199,232,0.15);border:1px solid rgba(32,199,232,0.30);border-radius:10px;font-size:13px;font-weight:900;color:#20C7E8;text-decoration:none;">
        Leer mensaje →
      </a>
    `);

    await sendEmail({
      to: toEmail,
      subject: `Nuevo mensaje de ${fromName} — POLYFAUNA`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
