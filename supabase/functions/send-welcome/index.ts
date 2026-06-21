import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

serve(async (req) => {
  try {
    const { userId, email, name } = await req.json();

    const html = emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#ffffff;">
        Bienvenido a POLYFAUNA, ${name || 'Raver'} 🎧
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
        Tu cuenta ha sido creada. Ya puedes escuchar la radio en vivo, explorar podcasts y conectar con la comunidad.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:linear-gradient(135deg,#20C7E8,#A855F7);border-radius:12px;padding:1px;">
            <a href="https://polyfauna.com"
              style="display:block;padding:14px 32px;background:#0D1117;border-radius:11px;font-size:14px;font-weight:900;color:#ffffff;text-decoration:none;text-align:center;">
              Ir a la plataforma →
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
        Si no creaste esta cuenta, ignora este correo.
      </p>
    `);

    await sendEmail({ to: email, subject: 'Bienvenido a POLYFAUNA 🎶', html });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
