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
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>POLYFAUNA</title>
  <style>
    :root{ color-scheme:dark; supported-color-schemes:dark; }
    body{ margin:0 !important; padding:0 !important; background:#0A0A0A !important; background-color:#0A0A0A !important; color:#ECECEC !important; }
    .email-bg{ background:#0A0A0A !important; background-color:#0A0A0A !important; }
    .email-card{ background:#0E0E0E !important; background-color:#0E0E0E !important; }
  </style>
</head>
<body bgcolor="#0A0A0A" style="margin:0 !important;padding:0 !important;background:#0A0A0A !important;background-color:#0A0A0A !important;font-family:'Helvetica Neue',Arial,sans-serif;color:#ECECEC !important;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A0A0A" class="email-bg" style="background:#0A0A0A !important;background-color:#0A0A0A !important;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" bgcolor="#0E0E0E" class="email-card" style="max-width:560px;background:#0E0E0E !important;background-color:#0E0E0E !important;border-radius:20px;border:1px solid #1E1E1E;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td align="center" style="padding:30px 32px 16px;background:#0E0E0E !important;background-color:#0E0E0E !important;border-bottom:1px solid #1E1E1E;">
            <img src="https://www.polyfauna.com/icons/email-logo-header.png" alt="POLYFAUNA" width="188" style="display:block;width:188px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;">
            <p style="margin:12px 0 0;font-size:10px;font-weight:700;color:#5E5E5E;letter-spacing:3px;text-transform:uppercase;">Radio · Podcasts · Events</p>
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
