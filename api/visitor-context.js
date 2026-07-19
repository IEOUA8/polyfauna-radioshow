const MAX_HEADER_LENGTH = 80;

function headerValue(headers, name) {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function cleanHeader(value, maxLength = MAX_HEADER_LENGTH) {
  if (!value) return null;
  try {
    return decodeURIComponent(String(value)).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength) || null;
  } catch (_) {
    return String(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength) || null;
  }
}

function detectDevice(userAgent) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function detectOs(userAgent) {
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Otro';
}

function detectBrowser(userAgent) {
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//i.test(userAgent)) return 'Samsung Internet';
  if (/CriOS\//i.test(userAgent)) return 'Chrome';
  if (/FxiOS\//i.test(userAgent)) return 'Firefox';
  if (/Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) return 'Safari';
  return 'Otro';
}

export function buildVisitorContext(headers = {}) {
  const userAgent = cleanHeader(headerValue(headers, 'user-agent'), 500) || '';
  return {
    country_code: cleanHeader(headerValue(headers, 'x-vercel-ip-country'), 2)?.toUpperCase() || null,
    region: cleanHeader(headerValue(headers, 'x-vercel-ip-country-region')),
    city: cleanHeader(headerValue(headers, 'x-vercel-ip-city')),
    device_type: detectDevice(userAgent),
    os_name: detectOs(userAgent),
    browser_name: detectBrowser(userAgent),
  };
}

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(200).json(buildVisitorContext(request.headers));
}
