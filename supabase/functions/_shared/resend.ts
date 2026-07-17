const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'POLYFAUNA <noreply@polyfauna.com>';
export const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'info@polyfauna.com';

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Stable for one logical email. Resend deduplicates matching requests for 24 hours. */
  idempotencyKey?: string;
  /** Non-PII correlation metadata returned in Resend webhook events. */
  tags?: EmailTag[];
}

export interface SendEmailResult {
  id: string;
}

function validateTags(tags: EmailTag[] = []): EmailTag[] {
  return tags.map(({ name, value }) => {
    const safeName = String(name).trim();
    const safeValue = String(value).trim();
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(safeName)) {
      throw new Error(`Invalid Resend tag name: ${safeName}`);
    }
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(safeValue)) {
      throw new Error(`Invalid Resend tag value for ${safeName}`);
    }
    return { name: safeName, value: safeValue };
  });
}

export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY not set');
  const { replyTo, idempotencyKey, tags, ...email } = payload;
  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) {
    if (idempotencyKey.length > 256 || /[\r\n]/.test(idempotencyKey)) {
      throw new Error('Invalid Resend idempotency key');
    }
    requestHeaders['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      from: FROM,
      reply_to: replyTo || SUPPORT_EMAIL,
      ...email,
      ...(tags?.length ? { tags: validateTags(tags) } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  const data = await res.json() as { id?: unknown };
  if (typeof data.id !== 'string' || !data.id) {
    throw new Error('Resend response did not include an email id');
  }
  return { id: data.id };
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
    body{ margin:0 !important; padding:0 !important; background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; color:#ECECEC !important; }
    table{ border-collapse:collapse; }
    .email-bg{ background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; }
    .email-card{ background:#0E0E0E !important; background-color:#0E0E0E !important; background-image:linear-gradient(#0E0E0E,#0E0E0E) !important; }
    .email-panel{ background:#101818 !important; background-color:#101818 !important; background-image:linear-gradient(#101818,#101818) !important; }
    a{ color:#20C7E8; }
    @media (prefers-color-scheme: dark){
      body,.email-bg{ background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; }
      .email-card{ background:#0E0E0E !important; background-color:#0E0E0E !important; background-image:linear-gradient(#0E0E0E,#0E0E0E) !important; }
    }
  </style>
</head>
<body bgcolor="#0A0A0A" style="margin:0 !important;padding:0 !important;background:#0A0A0A !important;background-color:#0A0A0A !important;background-image:linear-gradient(#0A0A0A,#0A0A0A) !important;font-family:'Helvetica Neue',Arial,sans-serif;color:#ECECEC !important;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A0A" class="email-bg" style="width:100%;background:#0A0A0A !important;background-color:#0A0A0A !important;background-image:linear-gradient(#0A0A0A,#0A0A0A) !important;">
    <tr><td align="center" bgcolor="#0A0A0A" style="padding:40px 20px;background:#0A0A0A !important;background-color:#0A0A0A !important;background-image:linear-gradient(#0A0A0A,#0A0A0A) !important;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E0E0E" class="email-card" style="max-width:560px;background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;border-radius:20px;border:1px solid #1E1E1E;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td align="center" bgcolor="#0E0E0E" style="padding:30px 32px 16px;background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;border-bottom:1px solid #1E1E1E;">
            <img src="https://www.polyfauna.com/icons/email-logo-header.png" alt="POLYFAUNA" width="188" style="display:block;width:188px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;">
            <p style="margin:12px 0 0;font-size:10px;font-weight:700;color:#5E5E5E;letter-spacing:3px;text-transform:uppercase;">Radio · Podcasts · Events</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td bgcolor="#0E0E0E" style="padding:32px;background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;color:#ECECEC !important;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td bgcolor="#0E0E0E" style="padding:20px 32px;background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;border-top:1px solid #1A1A1A;text-align:center;">
            <p style="margin:0;font-size:11px;color:#4E4E4E;">
              © ${new Date().getFullYear()} POLYFAUNA · <a href="https://polyfauna.com" style="color:#5E9FAA;text-decoration:none;">polyfauna.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
