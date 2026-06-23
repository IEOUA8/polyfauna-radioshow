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
    const roleLabel = ROLE_LABELS[roleRequest.requested_role] || 'Perfil';
    const userName = escapeHtml(roleRequest.form_data?.name || target.user_metadata?.name || 'Usuario');
    const reason = escapeHtml(roleRequest.rejection_reason || '');
    const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
    const html = emailWrapper(approved ? `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#10B981;">¡Solicitud aprobada! ✅</h1>
      <p style="margin:0 0 20px;color:rgba(255,255,255,0.55);">Hola ${userName}, tu solicitud para el rol de <strong>${roleLabel}</strong> fue aprobada.</p>
      <a href="${appUrl}" style="color:#10B981;">Explorar la plataforma →</a>
    ` : `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#EF4444;">Solicitud no aprobada</h1>
      <p style="margin:0 0 20px;color:rgba(255,255,255,0.55);">Hola ${userName}, tu solicitud para el rol de <strong>${roleLabel}</strong> no fue aprobada.</p>
      ${reason ? `<p style="color:rgba(255,255,255,0.50);">Motivo: ${reason}</p>` : ''}
    `);
    await sendEmail({ to: target.email, subject: approved ? `¡Eres ${roleLabel} en POLYFAUNA!` : `Solicitud de ${roleLabel} — POLYFAUNA`, html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
