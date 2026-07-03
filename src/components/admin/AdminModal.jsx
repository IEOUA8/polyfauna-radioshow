import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Logo from '@/components/Logo';

// Shell + header compartidos por los modales del panel operativo
// (cortesías, tickets manuales, transferir/anular, confirmaciones):
// misma tarjeta oscura, mismo overlay, misma entrada/salida animada.
// El padre debe envolver el render condicional en <AnimatePresence> para
// que la animación de salida se reproduzca.
export function ModalShell({ onClose, accent, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,5,5,0.84)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl p-6 space-y-5"
        style={{ background: '#0B1110', border: `1px solid ${accent}40`, boxShadow: '0 28px 90px rgba(0,0,0,0.65)' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function ModalHeader({ icon: Icon, accent, title, subtitle, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
          {Icon ? <Icon className="w-4 h-4" style={{ color: accent }} /> : <Logo variant="symbol-ui" size="xs" className="h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-base font-black text-white">{title}</p>
          {subtitle && <p className="text-xs text-white/40 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        <X className="w-4 h-4 text-white/55" />
      </button>
    </div>
  );
}
