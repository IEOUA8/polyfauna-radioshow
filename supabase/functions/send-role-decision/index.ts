import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { CORS_HEADERS, escapeHtml, json, requireAdmin } from '../_shared/auth.ts';

const ROLE_LABELS: Record<string, string> = { artist: 'Artista', promoter: 'Promotor', club: 'Club / Venue', sello: 'Sello Discográfico' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { admin, user, isAdmin } = await requireAdmin(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);
    const { requestId } = await req.json();
    const { data: roleRequest } = await admin.from('role_requests')
      .select('id, user_id, requested_role, status, rejection_reason, form_data')
      .eq('id', requestId).single();
    if (!roleRequest || !['approved', 'rejected'].includes(roleRequest.status)) return json({ error: 'Solicitud no resuelta' }, 400);
    const { data: { user: target } } = await admin.auth.admin.getUserById(roleRequest.user_id);
    if (!target?.email) return json({ error: 'Usuario sin correo' }, 404);

    const approved = roleRequest.status === 'approved';
    const roleLabel = roleRequest.form_data?.organizer_type === 'collective'
      ? 'Colectivo'
      : ROLE_LABELS[roleRequest.requested_role] || 'Perfil';
    const userName = escapeHtml(roleRequest.form_data?.name || target.user_metadata?.name || 'Usuario');
    const reason = escapeHtml(roleRequest.rejection_reason || '');
    const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
    const html = emailWrapper(approved ? `
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#38D99C !important;">Solicitud aprobada</h1>
      <p style="margin:0 0 22px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#9A9A9A !important;">Hola ${userName}, tu solicitud para el rol de <strong style="color:#ECECEC !important;">${roleLabel}</strong> fue aprobada.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:10px;">
            <a href="${appUrl}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:10px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Explorar la plataforma &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    ` : `
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#FF6B6B !important;">Solicitud no aprobada</h1>
      <p style="margin:0 0 20px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#9A9A9A !important;">Hola ${userName}, tu solicitud para el rol de <strong style="color:#ECECEC !important;">${roleLabel}</strong> no fue aprobada.</p>
      ${reason ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141414" class="email-panel" style="width:100%;background:#141414 !important;background-color:#141414 !important;background-image:linear-gradient(#141414,#141414) !important;border:1px solid #262626;border-radius:12px;"><tr><td style="padding:16px 18px;"><p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.6;color:#9A9A9A !important;">Motivo: ${reason}</p></td></tr></table>` : ''}
    `);
    await sendEmail({ to: target.email, subject: approved ? `¡Eres ${roleLabel} en POLYFAUNA!` : `Solicitud de ${roleLabel} — POLYFAUNA`, html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
