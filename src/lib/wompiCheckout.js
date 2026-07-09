const WOMPI_CHECKOUT_ORIGIN = 'https://checkout.wompi.co';
const WOMPI_CHECKOUT_PATH = '/p/';
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function requireString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Respuesta inválida del servidor de pagos: falta ${label}`);
  return normalized;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Respuesta inválida del servidor de pagos: monto inválido');
  }
  return String(amount);
}

function redirectUrlForOrigin(origin) {
  if (!origin) return null;

  let url;
  try {
    url = new URL(origin);
  } catch (_) {
    return null;
  }

  if (LOCAL_ORIGIN_PATTERN.test(url.origin)) return null;
  if (url.protocol !== 'https:') return null;
  return `${url.origin}/`;
}

export function buildWompiCheckoutUrl(paymentData, origin = globalThis.location?.origin) {
  const params = [
    ['public-key', requireString(paymentData?.public_key, 'public_key')],
    ['currency', 'COP'],
    ['amount-in-cents', normalizeAmount(paymentData?.amount_in_cents)],
    ['reference', requireString(paymentData?.reference, 'reference')],
    ['signature:integrity', requireString(paymentData?.signature, 'signature')],
  ];

  const redirectUrl = redirectUrlForOrigin(origin);
  if (redirectUrl) params.push(['redirect-url', redirectUrl]);

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  return `${WOMPI_CHECKOUT_ORIGIN}${WOMPI_CHECKOUT_PATH}?${query}`;
}

export function isWompiCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === WOMPI_CHECKOUT_ORIGIN && url.pathname === WOMPI_CHECKOUT_PATH;
  } catch (_) {
    return false;
  }
}
