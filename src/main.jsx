import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { installGlobalErrorMonitoring, reportClientError } from '@/lib/telemetry';
import AppUpdateBanner from '@/components/AppUpdateBanner';

// La portada siempre necesita estos dos módulos; iniciar ambas descargas evita
// una cascada main → shell → radio en conexiones móviles.
if (window.location.pathname === '/') {
  void Promise.all([
    import('@/components/PolyfaunaOS'),
    import('@/components/RadioConsolePage'),
  ]);
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    reportClientError(error, { severity: 'fatal', source: 'react-boundary', component: 'App' });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0A0D1A', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'monospace' }}>
          <div style={{ maxWidth: 600 }}>
            <p style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>La señal se interrumpió</p>
            <p style={{ color: '#8A8A8A', lineHeight: 1.6 }}>El incidente fue registrado. Recarga la plataforma para intentarlo de nuevo.</p>
            {import.meta.env.DEV && (
              <pre style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.stack}</pre>
            )}
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 700 }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Reuse the root during Vite hot reloads so development monitoring does not
// report false React mounting failures.
const reactRoot = window.__polyfaunaReactRoot
  || ReactDOM.createRoot(document.getElementById('root'));
window.__polyfaunaReactRoot = reactRoot;

reactRoot.render(
  <ErrorBoundary>
    <App />
    <AppUpdateBanner />
  </ErrorBoundary>
);

installGlobalErrorMonitoring();

// Registrar la PWA para todos los visitantes, no solo cuando activan push.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      let refreshing = false;
      const notifyUpdate = () => {
        window.dispatchEvent(new CustomEvent('polyfauna-sw-update', { detail: { registration } }));
      };

      if (registration.waiting && navigator.serviceWorker.controller) notifyUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      registration.update();
      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    }).catch((error) => {
      console.warn('No se pudo registrar la experiencia instalable:', error);
    });
  });
}
