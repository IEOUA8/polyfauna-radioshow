import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackUsageEvent } from '@/lib/telemetry';

const HEARTBEAT_INTERVAL_MS = 60_000;

function currentSection(location) {
  if (location.pathname === '/') {
    return new URLSearchParams(location.search).get('section') || 'home';
  }
  return location.pathname.split('/').filter(Boolean)[0] || 'home';
}

export default function UsageTelemetry() {
  const location = useLocation();

  useEffect(() => {
    trackUsageEvent('route_view', { section: currentSection(location) });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      trackUsageEvent('session_heartbeat', { section: currentSection(window.location) });
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', sendHeartbeat);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, []);

  return null;
}
