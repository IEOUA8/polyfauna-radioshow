import { supabase } from '@/lib/customSupabaseClient';

const SESSION_KEY = 'pf_error_session_v1';
let reporting = false;

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function reportClientError(error, context = {}) {
  if (reporting || import.meta.env.DEV) return;
  reporting = true;
  try {
    const normalized = error instanceof Error ? error : new Error(String(error || 'Error desconocido'));
    await supabase.functions.invoke('collect-client-error', {
      body: {
        sessionId: getSessionId(),
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
