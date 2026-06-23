import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';
import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';

const ROLE_LABELS: Record<string, string> = { artist: 'Artista', promoter: 'Promotor', club: 'Club / Venue', sello: 'Sello Discográfico' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { requestId } = await req.json();
    const { data: roleRequest } = await admin.from('role_requests')
      .select('id, user_id, requested_role, form_data, status')
      .eq('id', requestId).eq('user_id', user.id).single();
    if (!roleRequest || roleRequest.status !== 'pending') return json({ error: 'Solicitud no encontrada' }, 404);

    const roleLabel = ROLE_LABELS[roleRequest.requested_role];
    if (!roleLabel || !user.email) return json({ error: 'Solicitud inválida' }, 400);
    const applicantName = roleRequest.form_data?.name || user.user_metadata?.name || 'Usuario';
    const userName = escapeHtml(applicantName);
    const userEmail = escapeHtml(user.email);
    const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
    const userHtml = renderEmailTemplate('roleRequest', {
      applicant_name: applicantName,
      applicant_type: roleLabel,
    });
    const adminHtml = emailWrapper(`
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:21px;line-height:1.25;font-weight:900;color:#F5B84B !important;">Nueva solicitud de rol</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141414" class="email-panel" style="width:100%;background:#141414 !important;background-color:#141414 !important;background-image:linear-gradient(#141414,#141414) !important;border:1px solid #262626;border-radius:12px;margin:0 0 22px;">
        <tr>
          <td style="padding:16px 18px;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.6;color:#ECECEC !important;">${userName} · ${userEmail} · <strong>${roleLabel}</strong></p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:10px;">
            <a href="${appUrl}/admin" target="_blank" style="display:inline-block;padding:12px 28px;font-family:'Helvetica Neue',Arial,sans-serif;color:#081010 !important;text-decoration:none;font-weight:900;border-radius:10px;">Revisar en el panel &rarr;</a>
          </td>
        </tr>
      </table>
    `);
    await Promise.all([
      sendEmail({ to: user.email, subject: 'Tu solicitud está en revisión', html: userHtml }),
      sendEmail({ to: Deno.env.get('ADMIN_EMAIL') || 'admin@polyfauna.com', subject: `Nueva solicitud: ${roleLabel}`, html: adminHtml }),
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
