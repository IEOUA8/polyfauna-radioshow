import { EMAIL_TEMPLATES } from './email-templates.generated.ts';

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;

const LOGO_URL = 'https://www.polyfauna.com/icons/email-logo-header.png';
const DEFAULT_UNSUBSCRIBE_URL = 'mailto:polyfauna.radio@gmail.com?subject=Salir%20de%20correos%20Polyfauna';

export function escapeEmailValue(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function publicEmailUrl(value: unknown, fallback = 'https://www.polyfauna.com'): string {
  try {
    const url = new URL(String(value ?? ''));
    if (!['https:', 'mailto:'].includes(url.protocol)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

export function renderEmailTemplate(
  name: EmailTemplateName,
  variables: Record<string, unknown>,
): string {
  const values = {
    logo_url: LOGO_URL,
    unsubscribe_url: Deno.env.get('EMAIL_UNSUBSCRIBE_URL') || DEFAULT_UNSUBSCRIBE_URL,
    ...variables,
  };

  const rendered = Object.entries(values).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, escapeEmailValue(value)),
    EMAIL_TEMPLATES[name] as string,
  );

  const unresolved = [...rendered.matchAll(/\{\{([^}]+)\}\}/g)].map(match => match[1]);
  if (unresolved.length) throw new Error(`Email template ${name} is missing: ${unresolved.join(', ')}`);
  return rendered;
}
