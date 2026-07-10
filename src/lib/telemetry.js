import supabase from '@/lib/customSupabaseClient';

const ERROR_SESSION_KEY = 'pf_error_session_v1';
const USAGE_SESSION_KEY = 'pf_usage_session_v1';
const USAGE_RATE_WINDOW_MS = 60_000;
const USAGE_RATE_LIMIT = 18;
const usageTimestamps = [];
const recentUsageEvents = new Map();
let reporting = false;

const ALLOWED_USAGE_EVENTS = new Set([
  'session_heartbeat',
  'route_view',
  'stream_start',
  'stream_connecting',
  'stream_playing',
  'stream_stalled',
  'stream_reconnect_attempt',
  'stream_recovered',
  'stream_failed',
  'media_start',
  'event_view',
  'checkout_start',
  'checkout_ready',
  'ticket_claimed',
  'checkout_error',
]);

const ALLOWED_USAGE_PROPERTIES = new Set([
  'content_id',
  'event_id',
  'media_type',
  'mode',
  'status',
  'price_tier',
  'quantity',
  'section',
  'error_code',
  'quality',
  'reason',
  'attempt',
  'delay_ms',
  'duration_ms',
  'network_type',
]);

function getSessionId(key) {
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

function sanitizeUsageProperties(properties = {}) {
  return Object.entries(properties).reduce((safe, [key, value]) => {
    if (!ALLOWED_USAGE_PROPERTIES.has(key)) return safe;
    if (typeof value === 'string') safe[key] = value.slice(0, 80);
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'boolean' || value === null) safe[key] = value;
    return safe;
  }, {});
}

function canSendUsageEvent(eventName, properties) {
  if (import.meta.env.DEV || navigator.doNotTrack === '1') return false;
  if (!ALLOWED_USAGE_EVENTS.has(eventName)) return false;

  const now = Date.now();
  while (usageTimestamps.length && now - usageTimestamps[0] > USAGE_RATE_WINDOW_MS) {
    usageTimestamps.shift();
  }
  if (usageTimestamps.length >= USAGE_RATE_LIMIT) return false;

  const fingerprint = `${eventName}:${properties.event_id || properties.content_id || properties.section || ''}:${properties.mode || ''}:${properties.reason || ''}:${properties.attempt || ''}`;
  const lastSentAt = recentUsageEvents.get(fingerprint) || 0;
  if (now - lastSentAt < 5000 && eventName !== 'session_heartbeat') return false;

  usageTimestamps.push(now);
  recentUsageEvents.set(fingerprint, now);
  return true;
}

export async function reportClientError(error, context = {}) {
  if (reporting || import.meta.env.DEV) return;
  reporting = true;
  try {
    const normalized = error instanceof Error ? error : new Error(String(error || 'Error desconocido'));
    await supabase.functions.invoke('collect-client-error', {
      body: {
        sessionId: getSessionId(ERROR_SESSION_KEY),
        severity: context.severity || 'error',
        message: normalized.message,
        stack: normalized.stack,
        source: context.source || 'client',
        route: window.location.pathname,
        context: {
          component: context.component || null,
          action: context.action || null,
          release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || null,
        },
      },
    });
  } catch (_) {
    // El monitoreo nunca debe romper la experiencia del usuario.
  } finally {
    reporting = false;
  }
}

export function installGlobalErrorMonitoring() {
  window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message, { source: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, { source: 'unhandledrejection' });
  });
}

export function trackUsageEvent(eventName, properties = {}) {
  const safeProperties = sanitizeUsageProperties(properties);
  if (!canSendUsageEvent(eventName, safeProperties)) return;

  const metrics = window.__polyfaunaUsageTelemetry || {
    sent: 0,
    dropped: 0,
    lastEventName: null,
    lastEventAt: null,
  };

  metrics.sent += 1;
  metrics.lastEventName = eventName;
  metrics.lastEventAt = new Date().toISOString();
  window.__polyfaunaUsageTelemetry = metrics;

  supabase.functions.invoke('collect-usage-event', {
    body: {
      sessionId: getSessionId(USAGE_SESSION_KEY),
      eventName,
      route: window.location.pathname,
      referrer: document.referrer || null,
      release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || null,
      properties: safeProperties,
    },
  }).catch(() => {
    metrics.dropped += 1;
  });
}
