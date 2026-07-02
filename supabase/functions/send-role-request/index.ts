import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SUPPORT_EMAIL, sendEmail, emailWrapper } from '../_shared/resend.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';
import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';

const ROLE_LABELS: Record<string, string> = { artist: 'Artista', promoter: 'Promotor', club: 'Club / Venue', sello: 'Sello Discográfico' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { admin, user } = await requireUser(req);
    const { requestId, userId, email } = await req.json();
    let requestQuery = admin.from('role_requests')
      .select('id, user_id, requested_role, form_data, status, notification_sent_at, created_at')
      .eq('status', 'pending');

    if (user) {
      requestQuery = requestQuery.eq('user_id', user.id);
      if (requestId) requestQuery = requestQuery.eq('id', requestId);
    } else {
      if (
        typeof userId !== 'string'
        || typeof email !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      ) {
        return json({ error: 'Unauthorized' }, 401);
      }
      requestQuery = requestQuery.eq('user_id', userId);
    }

    const { data: roleRequest } = await requestQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!roleRequest || roleRequest.status !== 'pending') return json({ error: 'Solicitud no encontrada' }, 404);
    if (roleRequest.notification_sent_at) return json({ ok: true, alreadySent: true });

    const { data: authUserData } = await admin.auth.admin.getUserById(roleRequest.user_id);
    const applicant = authUserData?.user;
    if (!applicant?.email) return json({ error: 'Solicitud inválida' }, 400);

    if (!user) {
      const requestAge = Date.now() - new Date(roleRequest.created_at).getTime();
      if (
        requestAge < 0
        || requestAge > 30 * 60 * 1000
        || applicant.email.trim().toLowerCase() !== email.trim().toLowerCase()
      ) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const roleLabel = roleRequest.form_data?.organizer_type === 'collective'
      ? 'Colectivo'
      : ROLE_LABELS[roleRequest.requested_role];
    if (!roleLabel) return json({ error: 'Solicitud inválida' }, 400);
    const applicantName = roleRequest.form_data?.name || applicant.user_metadata?.name || 'Usuario';
    const userName = escapeHtml(applicantName);
    const userEmail = escapeHtml(applicant.email);
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
            <a href="${appUrl}/admin" target="_blank" style="display:inline-block;padding:12px 28px;font-family:'Helvetica Neue',Arial,sans-serif;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;font-weight:900;border-radius:10px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Revisar en el panel &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    `);

    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from('role_requests')
      .update({ notification_sent_at: claimedAt })
      .eq('id', roleRequest.id)
      .is('notification_sent_at', null)
      .select('id')
      .maybeSingle();
    if (!claimed) return json({ ok: true, alreadySent: true });

    try {
      await Promise.all([
        sendEmail({ to: applicant.email, subject: 'Tu solicitud está en revisión', html: userHtml }),
        sendEmail({ to: SUPPORT_EMAIL, subject: `Nueva solicitud: ${roleLabel}`, html: adminHtml }),
      ]);
    } catch (emailError) {
      await admin
        .from('role_requests')
        .update({ notification_sent_at: null })
        .eq('id', roleRequest.id)
        .eq('notification_sent_at', claimedAt);
      throw emailError;
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
