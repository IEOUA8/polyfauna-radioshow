// Disparada por pg_cron/pg_net (trigger_operational_alerts_email en la
// migracion 20260703220758) cada 15 minutos, solo cuando hay alertas
// criticas nuevas. No la invoca ningun cliente ni requiere sesion de
// usuario: se autentica con un secreto compartido (x-cron-secret) validado
// contra Supabase Vault via la RPC verify_cron_alert_secret.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, escapeHtml, json } from '../_shared/auth.ts';
import { sendEmail, emailWrapper, SUPPORT_EMAIL } from '../_shared/resend.ts';

interface Alert {
  severity: string;
  code: string;
  title: string;
  detail: string;
  action: string;
  affected_count: number;
  latest_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const providedSecret = req.headers.get('x-cron-secret') || '';
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: isValid } = await admin.rpc('verify_cron_alert_secret', { p_secret: providedSecret });
    if (!isValid) return json({ error: 'Unauthorized' }, 401);

    const { alerts } = (await req.json()) as { alerts: Alert[] };
    if (!Array.isArray(alerts) || alerts.length === 0) return json({ ok: true, skipped: true });

    const rows = alerts.map((a) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #1E1E1E;">
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:900;color:#F87171 !important;">${escapeHtml(a.title)} &middot; ${escapeHtml(String(a.affected_count))}</p>
          <p style="margin:6px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9A9A9A !important;line-height:1.5;">${escapeHtml(a.detail)}</p>
          <p style="margin:6px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#5E9FAA !important;line-height:1.5;">${escapeHtml(a.action)}</p>
        </td>
      </tr>`).join('');

    const html = emailWrapper(`
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#ECECEC !important;">Alertas operativas criticas</h1>
      <p style="margin:0 0 20px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#9A9A9A !important;line-height:1.6;">Se detectaron ${alerts.length} alerta(s) critica(s) en POLYFAUNA. Revisa el panel administrativo cuanto antes.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:11px;">
            <a href="https://www.polyfauna.com/admin" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:11px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Abrir panel admin &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    `);

    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[POLYFAUNA] ${alerts.length} alerta(s) critica(s) requieren atencion`,
      html,
    });

    return json({ ok: true, sent: alerts.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
