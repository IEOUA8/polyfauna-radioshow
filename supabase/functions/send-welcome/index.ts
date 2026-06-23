import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';
import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { userId, name } = await req.json();
    if (userId !== user.id || !user.email) return json({ error: 'Forbidden' }, 403);
    const safeName = escapeHtml(name || user.user_metadata?.name || 'Raver');
    const html = emailWrapper(`
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:900;color:#ECECEC !important;">Bienvenido a POLYFAUNA, ${safeName}</h1>
      <p style="margin:0 0 24px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#9A9A9A !important;line-height:1.6;">Tu cuenta ha sido creada. Ya puedes escuchar la radio en vivo, explorar podcasts y conectar con la comunidad.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:11px;">
            <a href="https://www.polyfauna.com" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:11px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Ir a la plataforma &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    `);
    await sendEmail({ to: user.email, subject: 'Bienvenido al bioma', html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
