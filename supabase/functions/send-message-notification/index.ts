import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';

async function sendPush(body: Record<string, unknown>) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

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
      <h1 style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#ECECEC !important;">Nuevo mensaje en Signal Inbox</h1>
      <p style="margin:0 0 22px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#9A9A9A !important;">Hola ${toName}, tienes un mensaje de <strong style="color:#20C7E8 !important;">${fromName}</strong>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101818" class="email-panel" style="width:100%;background:#101818 !important;background-color:#101818 !important;background-image:linear-gradient(#101818,#101818) !important;border:1px solid #24424A;border-radius:12px;margin:0 0 22px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;font-weight:700;color:#66B8C8 !important;text-transform:uppercase;letter-spacing:1.5px;">Asunto</p>
            <p style="margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.45;font-weight:800;color:#ECECEC !important;">${subject}</p>
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.55;color:#8E9A9A !important;">${preview}${String(message.body || '').length > 120 ? '…' : ''}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:10px;">
            <a href="${appUrl}/?section=inbox" target="_blank" style="display:inline-block;padding:13px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:10px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Leer mensaje &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    `);
    await sendEmail({
      to: recipient.email,
      subject: `Nuevo mensaje de ${String(message.from_name || 'Usuario').replace(/[\r\n]/g, ' ')} — POLYFAUNA`,
      html,
      idempotencyKey: `message/${message.id}`,
      tags: [
        { name: 'category', value: 'direct_message' },
        { name: 'entity_id', value: message.id },
      ],
    });
    await sendPush({
      userId: message.to_user_id,
      title: 'Nuevo mensaje directo',
      body: `${message.from_name || 'Alguien del bioma'}: ${String(message.subject || 'Mensaje nuevo').slice(0, 90)}`,
      url: `${appUrl}/?section=inbox`,
    });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
