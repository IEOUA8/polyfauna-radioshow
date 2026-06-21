import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays, Disc3, FileText, Gauge, Headphones,
  Lock, LogIn, MessageSquare, Music, Radio, Shield,
  SlidersHorizontal, Ticket, UserPlus, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const NAV_ITEMS = [
  { id: 'radio-console', label: 'Radio',           icon: Radio,             public: true,  color: '#FF8A1F' },
  { id: 'podcasts',      label: 'Podcasts',         icon: Headphones,        public: true,  color: '#20C7E8' },
  { id: 'music',         label: 'Música',           icon: Music,             public: false, color: '#B8CFA6' },
  { id: 'events',        label: 'Eventos',          icon: CalendarDays,      public: false, color: '#D946EF' },
  { id: 'artists',       label: 'Artistas',         icon: Disc3,             public: false, color: '#7C5CFF' },
  { id: 'blog',          label: 'Blog',             icon: FileText,          public: false, color: '#5DE0A3' },
  { id: 'inbox',         label: 'Mensajes',         icon: MessageSquare,     public: false, color: '#F59E0B' },
  { id: 'tickets',       label: 'Tickets',          icon: Ticket,            public: false, color: '#FF6B6B' },
  { id: 'settings',      label: 'Ajustes',          icon: SlidersHorizontal, public: false, color: 'rgba(255,255,255,0.7)' },
  { id: 'mi-panel',      label: 'Mi Panel',         icon: Shield,            public: false, color: '#A78BFA', requiresLogin: true },
];

const ROLE_LABELS = {
  citizen:  'Wave Citizen',
  artist:   'Artista',
  promoter: 'Promotor',
  club:     'Club / Venue',
  sello:    'Sello',
  admin:    'Admin',
};

const ROLE_COLORS = {
  citizen:  'rgba(255,255,255,0.35)',
  artist:   '#20C7E8',
  promoter: '#D946EF',
  club:     '#FF8A1F',
  sello:    '#10B981',
  admin:    '#F59E0B',
};

function NavCard({ item, locked, active, onPress, idx }) {
  const color = locked ? 'rgba(255,255,255,0.18)' : item.color;

  return (
    <motion.button
      type="button"
      onClick={locked ? undefined : onPress}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + idx * 0.03, type: 'spring', stiffness: 320, damping: 28 }}
      className="relative flex flex-col items-center justify-center gap-2.5 rounded-2xl py-6 px-2 overflow-hidden"
      style={{
        background: active
          ? `rgba(${hexToRgb(item.color)}, 0.12)`
          : locked
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active
          ? `rgba(${hexToRgb(item.color)}, 0.30)`
          : locked
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.09)'}`,
        opacity: locked ? 0.4 : 1,
        cursor: locked ? 'not-allowed' : 'pointer',
        minHeight: 100,
      }}
      whileTap={locked ? {} : { scale: 0.93 }}
    >
      {/* Active accent line */}
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full"
          style={{ background: item.color }}
        />
      )}

      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: locked
            ? 'rgba(255,255,255,0.04)'
            : active
              ? `rgba(${hexToRgb(item.color)}, 0.18)`
              : `rgba(${hexToRgb(item.color)}, 0.10)`,
        }}
      >
        {locked
          ? <Lock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
          : <item.icon className="w-5 h-5" style={{ color }} />
        }
      </div>

      <span
        className="text-[11px] font-bold text-center leading-tight"
        style={{ color: locked ? 'rgba(255,255,255,0.20)' : active ? 'white' : 'rgba(255,255,255,0.65)' }}
      >
        {item.label}
      </span>
    </motion.button>
  );
}

function hexToRgb(hex) {
  if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb(')) return '255,255,255';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '255,255,255';
  return `${r},${g},${b}`;
}

export default function MobileMenu({ open, onClose, currentSection, setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile }     = useProfile();
  const isLoggedIn      = !!currentUser;
  const role            = profile?.role || 'citizen';
  const displayName     = profile?.display_name || currentUser?.email?.split('@')[0] || 'Invitado';
  const avatar          = profile?.avatar_url;
  const initials        = displayName.slice(0, 2).toUpperCase();

  const PROMOTER_ITEM = { id: 'promoter', label: 'Gestor', icon: Gauge, public: false, color: '#F59E0B', requiresLogin: true };
  const showPromoter  = isLoggedIn && (role === 'promoter' || role === 'club' || role === 'admin');

  const allItems = showPromoter ? [...NAV_ITEMS, PROMOTER_ITEM] : NAV_ITEMS;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex flex-col"
            style={{
              background: 'linear-gradient(180deg, rgba(6,10,9,0.99) 0%, rgba(3,6,5,1) 100%)',
              borderTop: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '92vh',
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-black text-white/60 shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {avatar
                      ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                      : initials
                    }
                  </div>
                  <div>
                    <p className="text-sm font-black text-white leading-none">{displayName}</p>
                    <span
                      className="inline-block text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: ROLE_COLORS[role] || 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {ROLE_LABELS[role] || role}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <Lock className="w-4 h-4 text-white/30" />
                  </div>
                  <p className="text-sm font-bold text-white/50">Modo invitado</p>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Navigation grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-3 gap-2.5">
                {allItems.map((item, idx) => {
                  const locked = !item.public && !isLoggedIn;
                  const active = currentSection === item.id;
                  return (
                    <NavCard
                      key={item.id}
                      item={item}
                      locked={locked}
                      active={active}
                      idx={idx}
                      onPress={() => setCurrentSection(item.id)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Guest CTA */}
            {!isLoggedIn && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mx-4 mb-6 p-4 rounded-2xl shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <p className="text-xs text-white/40 text-center mb-3 font-medium">
                  Únete a la comunidad POLYFAUNA
                </p>
                <div className="flex gap-2.5">
                  <a
                    href="/login"
                    onClick={onClose}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Entrar
                  </a>
                  <a
                    href="/signup"
                    onClick={onClose}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.92)', color: '#080B14' }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Crear cuenta
                  </a>
                </div>
              </motion.div>
            )}

            {/* Safe-area spacer for bottom notch */}
            <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
