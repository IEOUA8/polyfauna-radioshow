import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function AppUpdateBanner() {
  const [registration, setRegistration] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onUpdate = (event) => {
      setRegistration(event.detail?.registration || null);
      setVisible(true);
    };
    window.addEventListener('polyfauna-sw-update', onUpdate);
    return () => window.removeEventListener('polyfauna-sw-update', onUpdate);
  }, []);

  const update = () => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed left-3 right-3 bottom-4 z-[250] mx-auto max-w-sm rounded-2xl px-4 py-3"
      style={{ background: 'rgba(8,13,12,0.96)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 22px 70px rgba(0,0,0,0.45)' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: '#22c55e' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Nueva versión lista</p>
          <p className="text-xs text-white/40 mt-0.5">Actualiza para usar la versión más reciente.</p>
        </div>
        <button type="button" onClick={update}
          className="px-3 py-2 rounded-xl text-xs font-black"
          style={{ background: 'rgba(255,255,255,0.92)', color: '#080D0C' }}>
          Actualizar
        </button>
        <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar aviso"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
