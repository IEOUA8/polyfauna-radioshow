import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

const ROLE_LABELS: Record<string, string> = {
  artist:   'Artista',
  promoter: 'Promotor',
  club:     'Club / Venue',
  sello:    'Sello Discográfico',
};

const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@polyfauna.com';

serve(async (req) => {
  try {
    const { requestId, userName, userEmail, requestedRole } = await req.json();
    const roleLabel = ROLE_LABELS[requestedRole] || requestedRole;
    const appUrl    = Deno.env.get('APP_URL') || 'https://polyfauna.com';

    // 1. Notify user — request received
    const userHtml = emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#ffffff;">
        Solicitud recibida ⏳
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
        Hemos recibido tu solicitud para el rol de <strong style="color:#F59E0B;">${roleLabel}</strong>.
        La revisaremos en los próximos días hábiles y te notificaremos por este medio.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.40);line-height:1.6;">
        Mientras tanto puedes explorar la plataforma como oyente con acceso completo a radio y podcasts.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(255,255,255,0.9);border-radius:10px;font-size:13px;font-weight:900;color:#080B14;text-decoration:none;">
        Ir a la plataforma →
      </a>
    `);

    // 2. Notify admin — new request
    const adminHtml = emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:900;color:#F59E0B;">
        Nueva solicitud de rol
      </h1>
      <table style="width:100%;border-collapse:collapse;margin:16px 0 24px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.40);width:120px;">Usuario</td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:white;">${userName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.40);">Email</td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:white;">${userEmail}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.40);">Rol solicitado</td>
            <td style="padding:8px 0;font-size:13px;font-weight:700;color:#F59E0B;">${roleLabel}</td></tr>
      </table>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(255,255,255,0.9);border-radius:10px;font-size:13px;font-weight:900;color:#080B14;text-decoration:none;">
        Revisar en el panel →
      </a>
    `);

    await Promise.all([
      sendEmail({ to: userEmail,    subject: `Solicitud de ${roleLabel} recibida — POLYFAUNA`, html: userHtml }),
      sendEmail({ to: ADMIN_EMAIL,  subject: `Nueva solicitud: ${roleLabel} de ${userName}`,   html: adminHtml }),
    ]);

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
