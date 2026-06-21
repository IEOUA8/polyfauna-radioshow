import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

const ROLE_LABELS: Record<string, string> = {
  artist:   'Artista',
  promoter: 'Promotor',
  club:     'Club / Venue',
  sello:    'Sello Discográfico',
};

serve(async (req) => {
  try {
    const { userEmail, userName, requestedRole, decision, rejectionReason } = await req.json();
    const roleLabel = ROLE_LABELS[requestedRole] || requestedRole;
    const appUrl    = Deno.env.get('APP_URL') || 'https://polyfauna.com';
    const approved  = decision === 'approved';

    const html = emailWrapper(approved ? `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#10B981;">
        ¡Solicitud aprobada! ✅
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
        Hola ${userName}, tu solicitud para el rol de <strong style="color:#10B981;">${roleLabel}</strong>
        ha sido aprobada. Ya tienes acceso completo a las funciones de tu perfil.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:14px 32px;background:#10B981;border-radius:12px;font-size:14px;font-weight:900;color:#fff;text-decoration:none;">
        Explorar la plataforma →
      </a>
    ` : `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#EF4444;">
        Solicitud no aprobada
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
        Hola ${userName}, lamentablemente tu solicitud para el rol de <strong style="color:rgba(255,255,255,0.75);">${roleLabel}</strong>
        no fue aprobada en esta oportunidad.
      </p>
      ${rejectionReason ? `
      <div style="padding:14px 16px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);border-radius:10px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.50);">
          <strong style="color:rgba(255,255,255,0.60);">Motivo:</strong> ${rejectionReason}
        </p>
      </div>` : ''}
      <p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.35);">
        Puedes volver a solicitarlo más adelante desde tu perfil.
      </p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(255,255,255,0.08);border-radius:10px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);text-decoration:none;">
        Ir a la plataforma
      </a>
    `);

    await sendEmail({
      to: userEmail,
      subject: approved ? `¡Eres ${roleLabel} en POLYFAUNA! 🎉` : `Solicitud de ${roleLabel} — POLYFAUNA`,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
