import React from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Disc3, LayoutGrid, MessageSquare,
  SlidersHorizontal, Ticket, Video, FileText,
} from 'lucide-react';

const SECTION_META = {
  community: { icon: LayoutGrid,        color: '#34D399', label: 'Community Grid',   desc: 'Conecta con la comunidad underground. Foros, drops y conversaciones en vivo.' },
  inbox:     { icon: MessageSquare,      color: '#F472B6', label: 'Signal Inbox',     desc: 'Tu centro de mensajes directos con artistas, promotores y la escena.' },
  artists:   { icon: Disc3,             color: '#818CF8', label: 'Artists & Labels',  desc: 'Descubre artistas, sellos independientes y colectivos de la escena.' },
  tickets:   { icon: Ticket,            color: '#FCD34D', label: 'Ticket Vault',      desc: 'Tus entradas digitales con QR para eventos y experiencias exclusivas.' },
  settings:  { icon: SlidersHorizontal, color: '#94A3B8', label: 'Control Center',    desc: 'Personaliza tu experiencia en la plataforma.' },
  events:    { icon: CalendarDays,      color: '#FBBF24', label: 'Event Terminal',    desc: 'Eventos, fiestas y experiencias de la escena electrónica colombiana.' },
  interviews:{ icon: Video,             color: '#FB7185', label: 'Interviews',         desc: 'Entrevistas en profundidad con artistas, productores y referentes.' },
};

export default function PlaceholderSection({ id, label }) {
  const meta = SECTION_META[id] || { icon: LayoutGrid, color: '#00CFFF', label: label || id, desc: 'Próximamente disponible.' };
  const Icon = meta.icon;
  const color = meta.color;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: color, filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full"
          style={{ background: '#7B5CF0', filter: 'blur(60px)' }}
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative flex flex-col items-center gap-6 text-center max-w-sm"
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}35`,
            boxShadow: `0 0 40px ${color}20`,
          }}
        >
          <Icon className="w-9 h-9" style={{ color }} />
        </motion.div>

        {/* Text */}
        <div>
          <h2 className="text-2xl font-black text-white mb-2">{meta.label}</h2>
          <p className="text-sm text-white/45 leading-relaxed">{meta.desc}</p>
        </div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: `${color}10`,
            border: `1px solid ${color}25`,
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
          />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
            Próximamente
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
