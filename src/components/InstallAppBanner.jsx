import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Plus, Share, Smartphone, X } from 'lucide-react';

const DISMISS_KEY = 'pf_install_banner_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

function isSafari() {
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(window.navigator.userAgent || '');
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const iosInstall = useMemo(() => isIOS() && isSafari(), []);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return undefined;

    const timer = window.setTimeout(() => {
      if (iosInstall) setVisible(true);
    }, 18000);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      window.setTimeout(() => setVisible(true), 8000);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [iosInstall]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setVisible(false);
      return;
    }
    if (iosInstall) setShowIOSSteps(true);
  };

  if (!deferredPrompt && !iosInstall) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed left-3 right-3 sm:left-auto sm:right-5 z-[75]"
          style={{ bottom: 'calc(116px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div
            className="sm:w-[380px] rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(8,13,12,0.96)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 18px 70px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div className="p-4 flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(32,199,232,0.10)', border: '1px solid rgba(32,199,232,0.20)' }}>
                <Smartphone className="w-5 h-5" style={{ color: '#20C7E8' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">Instala Polyfauna</p>
                <p className="text-xs text-white/42 mt-1 leading-relaxed">
                  Abre la radio, tickets y Organismo desde tu pantalla de inicio.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white/35 hover:text-white/65 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                aria-label="Ocultar instalación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showIOSSteps && (
              <div className="px-4 pb-3 -mt-1 space-y-2">
                {[
                  { icon: Share, text: 'Toca Compartir en Safari.' },
                  { icon: Plus, text: 'Elige Agregar a pantalla de inicio.' },
                  { icon: Smartphone, text: 'Abre Polyfauna como app.' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-white/55">
                    <Icon className="w-3.5 h-3.5 text-white/35" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 pb-4 flex gap-2">
              <button
                type="button"
                onClick={install}
                className="flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#080B14' }}
              >
                <Download className="w-3.5 h-3.5" />
                {iosInstall ? 'Ver pasos' : 'Agregar al inicio'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/45"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Luego
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
