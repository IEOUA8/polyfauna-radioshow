import { escapeEmailValue, renderEmailTemplate } from './email-templates.ts';

type TicketTier = Record<string, unknown> | null | undefined;

const EARLY_RULE_INSERTION_POINT = '<tr><td class="px" style="padding:24px 40px 0;" align="center">';

export function findTicketTier(ticketTypes: unknown, ticketType: unknown): TicketTier {
  if (!Array.isArray(ticketTypes) || typeof ticketType !== 'string') return null;
  const normalizedType = ticketType.trim().toLowerCase();
  return ticketTypes.find((tier) => (
    tier
    && typeof tier === 'object'
    && typeof (tier as Record<string, unknown>).name === 'string'
    && String((tier as Record<string, unknown>).name).trim().toLowerCase() === normalizedType
  )) as TicketTier;
}

function formatEarlyCutoff(value: unknown): string {
  const date = new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatLateEntryFee(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `$${Math.round(amount).toLocaleString('es-CO')} COP`;
}

export function injectEarlyTicketRules(
  html: string,
  ticketType: unknown,
  tier: TicketTier,
): string {
  if (!/^early$/i.test(String(ticketType ?? '').trim())) return html;

  const cutoff = formatEarlyCutoff(tier?.entry_cutoff_at);
  const fee = formatLateEntryFee(tier?.late_entry_fee);
  if (!cutoff || !fee) {
    throw new Error('El ticket Early no tiene una hora límite y un recargo válidos para el correo');
  }
  if (!html.includes(EARLY_RULE_INSERTION_POINT)) {
    throw new Error('No fue posible insertar las reglas Early en el correo');
  }

  const ruleBlock = `<tr><td class="px" style="padding:20px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2A1D08;border:1px solid #A66A12;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 8px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;font-weight:500;letter-spacing:2px;color:#FBBF24;text-transform:uppercase;">Regla de ingreso Early</p>
<p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#F4E7C5;"><strong>Debes presentar y validar tu QR a más tardar el ${escapeEmailValue(cutoff)}.</strong></p>
<p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.65;color:#D7C49A;">Si llegas después, el lector indicará que el ticket está fuera del horario Early. Para ingresar deberás pagar un recargo de <strong style="color:#FFFFFF;">${escapeEmailValue(fee)}</strong> en la puerta. El QR no se consumirá hasta que el personal registre el recargo y autorice el ingreso.</p>
</td></tr></table>
</td></tr>`;

  return html.replace(EARLY_RULE_INSERTION_POINT, `${ruleBlock}${EARLY_RULE_INSERTION_POINT}`);
}

export function renderTicketPurchasedEmail(
  variables: Record<string, unknown>,
  tier: TicketTier,
): string {
  const html = renderEmailTemplate('ticketPurchased', variables);
  return injectEarlyTicketRules(html, variables.ticket_type, tier);
}
