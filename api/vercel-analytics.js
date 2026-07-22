/* global process */

const ALLOWED_HOURS = new Set([1, 6, 24, 168, 720]);
const HOUR_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const analyticsCache = new Map();

function firstHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(request) {
  const authorization = firstHeaderValue(request.headers?.authorization);
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function normalizeAnalyticsHours(value) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  return ALLOWED_HOURS.has(parsed) ? parsed : 24;
}

export function buildAnalyticsWindow(value, now = Date.now()) {
  const requestedHours = normalizeAnalyticsHours(value);
  const effectiveHours = Math.max(24, requestedHours);
  const current = new Date(now);
  const untilMs = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1
  );

  return {
    requestedHours,
    effectiveHours,
    since: new Date(untilMs - (effectiveHours * HOUR_MS)).toISOString(),
    until: new Date(untilMs).toISOString(),
  };
}

export function normalizeAggregateRows(payload, dimension, fallbackLabel) {
  if (!Array.isArray(payload?.data)) return [];

  return payload.data.slice(0, 8).map((row) => ({
    key: typeof row?.[dimension] === 'string' && row[dimension].trim()
      ? row[dimension].trim().slice(0, 240)
      : fallbackLabel,
    visitors: safeNumber(row?.visitors),
    pageviews: safeNumber(row?.pageviews),
  }));
}

async function fetchJson(url, options, errorCode) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const error = new Error(errorCode);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`${errorCode}_TIMEOUT`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requireAdmin(request) {
  const accessToken = bearerToken(request);
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!accessToken) {
    const error = new Error('AUTH_REQUIRED');
    error.status = 401;
    throw error;
  }
  if (!supabaseUrl || !anonKey) {
    const error = new Error('AUTH_NOT_CONFIGURED');
    error.status = 503;
    throw error;
  }

  const authHeaders = {
    Accept: 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };
  const user = await fetchJson(
    `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
    { headers: authHeaders },
    'INVALID_SESSION'
  );

  if (!user?.id) {
    const error = new Error('INVALID_SESSION');
    error.status = 401;
    throw error;
  }

  const profilesUrl = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles`);
  profilesUrl.searchParams.set('id', `eq.${user.id}`);
  profilesUrl.searchParams.set('select', 'role');
  profilesUrl.searchParams.set('limit', '1');
  const profiles = await fetchJson(
    profilesUrl,
    { headers: authHeaders },
    'PROFILE_LOOKUP_FAILED'
  );

  if (profiles?.[0]?.role !== 'admin') {
    const error = new Error('ADMIN_REQUIRED');
    error.status = 403;
    throw error;
  }
}

async function queryVercelAnalytics(path, window, groupBy) {
  const accessToken = process.env.VERCEL_ANALYTICS_ACCESS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID;
  const url = new URL(`https://api.vercel.com${path}`);

  url.searchParams.set('projectId', projectId);
  url.searchParams.set('teamId', teamId);
  url.searchParams.set('since', window.since);
  url.searchParams.set('until', window.until);
  if (groupBy) {
    url.searchParams.set('by', groupBy);
    url.searchParams.set('limit', '8');
  }

  return fetchJson(
    url,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
    'VERCEL_ANALYTICS_UPSTREAM_ERROR'
  );
}

async function loadAnalytics(window) {
  const cacheKey = `${window.since}:${window.until}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [count, pages, referrers, countries] = await Promise.all([
    queryVercelAnalytics('/v1/query/web-analytics/visits/count', window),
    queryVercelAnalytics('/v1/query/web-analytics/visits/aggregate', window, 'requestPath'),
    queryVercelAnalytics('/v1/query/web-analytics/visits/aggregate', window, 'referrerHostname'),
    queryVercelAnalytics('/v1/query/web-analytics/visits/aggregate', window, 'country'),
  ]);

  const data = {
    source: 'vercel_web_analytics',
    generated_at: new Date().toISOString(),
    requested_hours: window.requestedHours,
    effective_hours: window.effectiveHours,
    window: { since: window.since, until: window.until },
    summary: {
      visitors: safeNumber(count?.data?.visitors),
      pageviews: safeNumber(count?.data?.pageviews),
    },
    top_pages: normalizeAggregateRows(pages, 'requestPath', '/'),
    referrers: normalizeAggregateRows(referrers, 'referrerHostname', 'Directo / sin referencia'),
    countries: normalizeAggregateRows(countries, 'country', 'Sin identificar'),
  };

  analyticsCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    await requireAdmin(request);
    if (
      !process.env.VERCEL_ANALYTICS_ACCESS_TOKEN
      || !process.env.VERCEL_ANALYTICS_PROJECT_ID
      || !process.env.VERCEL_ANALYTICS_TEAM_ID
    ) {
      return sendJson(response, 503, { error: 'VERCEL_ANALYTICS_NOT_CONFIGURED' });
    }
    const window = buildAnalyticsWindow(request.query?.hours);
    const data = await loadAnalytics(window);
    return sendJson(response, 200, data);
  } catch (error) {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 500;
    const publicError = [401, 403, 503, 504].includes(status)
      ? error.message
      : 'VERCEL_ANALYTICS_UNAVAILABLE';
    return sendJson(response, status, { error: publicError });
  }
}
