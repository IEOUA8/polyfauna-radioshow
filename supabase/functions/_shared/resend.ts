const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'POLYFAUNA <noreply@polyfauna.com>';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY not set');

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, ...payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>POLYFAUNA</title>
</head>
<body style="margin:0;padding:0;background:#080B14;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080B14;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#0D1117;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(135deg,rgba(32,199,232,0.08),rgba(167,139,250,0.06));border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:18px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">POLY<span style="color:#20C7E8;">FAUNA</span></p>
            <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:rgba(255,255,255,0.25);letter-spacing:3px;text-transform:uppercase;">Radio · Podcasts · Events</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.20);">
              © ${new Date().getFullYear()} POLYFAUNA · <a href="https://polyfauna.com" style="color:rgba(32,199,232,0.6);text-decoration:none;">polyfauna.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
