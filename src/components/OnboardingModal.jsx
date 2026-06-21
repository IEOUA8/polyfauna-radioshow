import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Headphones, Radio, Ticket, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const SLIDES = [
  {
    icon: Radio,
    color: '#FF8A1F',
    title: 'Bienvenido a POLYFAUNA',
    body: 'La plataforma de música electrónica underground de Colombia. Radio 24/7, podcasts exclusivos y eventos en vivo.',
  },
  {
    icon: Headphones,
    color: '#20C7E8',
    title: 'Explora el contenido',
    body: 'Descubre mixes, podcasts de DJs y productores, álbumes, entrevistas y artículos del ecosistema PolyFauna.',
  },
  {
    icon: Ticket,
    color: '#A78BFA',
    title: 'Eventos y comunidad',
    body: 'Compra entradas con QR, acumula tu historial y conecta con la escena electrónica. Crea tu cuenta para acceder a todo.',
  },
];

const STORAGE_KEY = 'pf_onboarding_v1';

export default function OnboardingModal() {
  const { currentUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (currentUser) return; // Skip onboarding for logged-in users
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [currentUser]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1);
    } else {
      dismiss();
    }
  };

  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={dismiss}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[71] flex items-end sm:items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden pointer-events-auto"
              style={{
                background: 'rgba(7,11,10,0.98)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top shine */}
              <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.14) 50%, transparent 90%)' }} />

              {/* Close */}
              <button
                type="button"
                onClick={dismiss}
                className="absolute top-4 right-4 z-10 p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.70)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.30)'; }}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Slide content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="px-8 pt-10 pb-6"
                >
                  {/* Icon bubble */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 22 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                    style={{
                      background: `${current.color}14`,
                      border: `1px solid ${current.color}28`,
                      boxShadow: `0 0 32px ${current.color}18`,
                    }}
                  >
                    <Icon className="w-8 h-8" style={{ color: current.color }} />
                  </motion.div>

                  <h2 className="text-xl font-black text-white mb-3 leading-tight">{current.title}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)' }}>
                    {current.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Bottom: dots + action */}
              <div className="px-8 pb-8 flex items-center justify-between gap-4">
                {/* Progress dots */}
                <div className="flex items-center gap-1.5">
                  {SLIDES.map((_, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      onClick={() => setSlide(i)}
                      animate={{ width: i === slide ? 20 : 6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="h-1.5 rounded-full"
                      style={{ background: i === slide ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.16)' }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={next}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all"
                  style={{
                    background: isLast ? `linear-gradient(135deg, ${SLIDES[2].color}, #7C5CFF)` : 'rgba(255,255,255,0.94)',
                    color: isLast ? '#fff' : '#06090A',
                    boxShadow: isLast ? `0 0 24px ${SLIDES[2].color}35` : 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {isLast ? 'Explorar' : 'Siguiente'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Sign-up prompt on last slide */}
              {isLast && (
                <div className="px-8 pb-8 -mt-2 text-center">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    ¿Ya tienes cuenta?{' '}
                    <a href="/login" className="font-bold transition-colors" style={{ color: 'rgba(255,255,255,0.60)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; }}>
                      Iniciar sesión
                    </a>
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
