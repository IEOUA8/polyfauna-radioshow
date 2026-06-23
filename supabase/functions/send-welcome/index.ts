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
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#ffffff;">Bienvenido a POLYFAUNA, ${safeName} 🎧</h1>
      <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">Tu cuenta ha sido creada. Ya puedes escuchar la radio en vivo, explorar podcasts y conectar con la comunidad.</p>
      <a href="https://www.polyfauna.com" style="display:inline-block;padding:14px 32px;background:#0D1117;border-radius:11px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;">Ir a la plataforma →</a>
    `);
    await sendEmail({ to: user.email, subject: 'Bienvenido al bioma', html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
