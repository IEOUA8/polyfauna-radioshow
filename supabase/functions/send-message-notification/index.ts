import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { messageId } = await req.json();
    const { data: message } = await admin.from('messages')
      .select('id, from_user_id, from_name, to_user_id, to_display_name, subject, body')
      .eq('id', messageId).eq('from_user_id', user.id).single();
    if (!message) return json({ error: 'Mensaje no encontrado' }, 404);

    const { data: { user: recipient } } = await admin.auth.admin.getUserById(message.to_user_id);
    if (!recipient?.email) return json({ ok: false, reason: 'no email found' });

    const toName = escapeHtml(message.to_display_name || 'Usuario');
    const fromName = escapeHtml(message.from_name || 'Usuario');
    const subject = escapeHtml(message.subject);
    const preview = escapeHtml(String(message.body || '').slice(0, 120));
    const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';
    const html = emailWrapper(`
      <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#ffffff;">Nuevo mensaje en Signal Inbox 📨</h1>
      <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.45);">Hola ${toName}, tienes un mensaje de <strong style="color:#20C7E8;">${fromName}</strong>.</p>
      <div style="background:rgba(32,199,232,0.06);border:1px solid rgba(32,199,232,0.14);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(32,199,232,0.60);text-transform:uppercase;letter-spacing:1.5px;">Asunto</p>
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:white;">${subject}</p>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.40);line-height:1.5;">${preview}${String(message.body || '').length > 120 ? '…' : ''}</p>
      </div>
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:rgba(32,199,232,0.15);border:1px solid rgba(32,199,232,0.30);border-radius:10px;font-size:13px;font-weight:900;color:#20C7E8;text-decoration:none;">Leer mensaje →</a>
    `);
    await sendEmail({ to: recipient.email, subject: `Nuevo mensaje de ${String(message.from_name || 'Usuario').replace(/[\r\n]/g, ' ')} — POLYFAUNA`, html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
