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
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:900;color:#F59E0B;">Nueva solicitud de rol</h1>
      <p style="color:white;">${userName} · ${userEmail} · <strong>${roleLabel}</strong></p>
      <a href="${appUrl}/admin" style="display:inline-block;padding:12px 28px;background:#fff;border-radius:10px;color:#080B14;text-decoration:none;font-weight:900;">Revisar en el panel →</a>
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
