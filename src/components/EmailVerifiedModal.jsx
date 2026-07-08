import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function EmailVerifiedModal() {
  const { justVerified, clearJustVerified } = useAuth();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {justVerified && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
          onClick={clearJustVerified}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="w-full max-w-sm rounded-3xl p-7 text-center relative"
            style={{ background: '#0B1110', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={clearJustVerified}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
              style={{ background: 'rgba(93,224,163,0.12)' }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: '#5DE0A3' }} />
            </div>
            <h2 className="text-xl font-black text-white mb-2">¡Correo verificado!</h2>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Tu cuenta ya está activa y tu sesión quedó iniciada. Bienvenido al bioma POLYFAUNA.
            </p>
            <button
              type="button"
              onClick={clearJustVerified}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
            >
              Empezar a explorar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
