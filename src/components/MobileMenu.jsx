import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays, Disc3, Dna, FileText, Headphones,
  Lock, LogIn, MessageSquare, Music, Network, Radio,
  Shield, SlidersHorizontal, Ticket, UserPlus, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const NAV_ITEMS = [
  { id: 'radio-console', label: 'Radio',    icon: Radio,             public: true  },
  { id: 'podcasts',      label: 'Podcasts', icon: Headphones,        public: true  },
  { id: 'music',         label: 'Música',   icon: Music,             public: false },
  { id: 'organism',      label: 'Organismo', icon: Dna,              public: false },
  { id: 'events',        label: 'Eventos',  icon: CalendarDays,      public: false },
  { id: 'artists',       label: 'Artistas', icon: Disc3,             public: false },
  { id: 'organizers',    label: 'Colonia',  icon: Network,           public: false },
  { id: 'blog',          label: 'Blog',     icon: FileText,          public: false },
  { id: 'inbox',         label: 'Mensajes', icon: MessageSquare,     public: false },
  { id: 'tickets',       label: 'Tickets',  icon: Ticket,            public: false },
  { id: 'settings',      label: 'Ajustes',  icon: SlidersHorizontal, public: false },
];

const ROLE_LABELS = {
  citizen:  'Wave Citizen',
  artist:   'Artista',
  promoter: 'Promotor',
  club:     'Club / Venue',
  sello:    'Sello',
  admin:    'Admin',
};

function NavCard({ item, locked, active, onPress, idx }) {
  return (
    <motion.button
      type="button"
      onClick={locked ? undefined : onPress}
      disabled={locked}
      aria-current={active ? 'page' : undefined}
      aria-label={locked ? `${item.label}. Inicia sesión para acceder` : item.label}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + idx * 0.025, type: 'spring', stiffness: 340, damping: 30 }}
      className="relative flex flex-col items-center justify-center gap-2.5 py-5 px-2 overflow-hidden"
      style={{
        background: active ? '#1B1B1B' : locked ? 'rgba(255,255,255,0.01)' : '#141414',
        border: `1px solid ${active ? '#3A3A3A' : locked ? '#181818' : '#1F1F1F'}`,
        borderRadius: 16,
        boxShadow: active ? 'inset 0 0 0 1px #2C2C2C' : 'none',
        opacity: locked ? 0.35 : 1,
        cursor: locked ? 'not-allowed' : 'pointer',
        minHeight: 96,
      }}
      whileTap={locked ? {} : { scale: 0.94 }}
    >
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full"
          style={{ background: '#ECECEC' }}
        />
      )}

      {locked
        ? <Lock className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.20)' }} />
        : <item.icon
            className={item.id === 'organism' ? 'w-5 h-5 icon-organism-alive' : 'w-5 h-5'}
            style={{ color: active ? '#ECECEC' : '#CFCFCF' }}
          />
      }

      <span
        className="text-[11px] font-semibold text-center leading-tight"
        style={{ color: locked ? 'rgba(255,255,255,0.18)' : active ? '#ECECEC' : '#8A8A8A' }}
      >
        {item.label}
      </span>
    </motion.button>
  );
}

export default function MobileMenu({ open, onClose, currentSection, setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile }     = useProfile();
  const isLoggedIn      = !!currentUser;
  const role            = profile?.role || 'citizen';
  const displayName     = profile?.display_name || currentUser?.email?.split('@')[0] || 'Invitado';

  const OPERATIONS_ITEM = { id: 'operations', label: 'Panel operativo', icon: Shield, public: false, requiresLogin: true, href: '/admin' };
  const showOperations = isLoggedIn && ['promoter', 'club', 'artist', 'sello', 'admin'].includes(role);
  const allItems = showOperations ? [...NAV_ITEMS, OPERATIONS_ITEM] : NAV_ITEMS;

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
            className="fixed inset-0 z-[60] lg:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Panel — z-[70]: por encima del GlobalPlayer (z-50), que vive
              fuera de esta ruta y si no quedaría flotando sobre el menú. */}
          <motion.div
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 z-[70] lg:hidden flex flex-col"
            style={{
              background: '#0A0A0A',
              borderTop: '1px solid #1F1F1F',
              borderRadius: '20px 20px 0 0',
              maxHeight: '92vh',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
            </div>

            {/* Brand header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/symbol-ui.svg"
                  alt="POLYFAUNA"
                  className="w-[30px] h-[30px] object-contain shrink-0"
                  draggable={false}
                />
                <div className="flex flex-col gap-0.5">
                  <span
                    className="leading-none"
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontWeight: 300,
                      letterSpacing: '0.22em',
                      fontSize: 13,
                      color: '#ECECEC',
                    }}
                  >
                    POLYFAUNA
                  </span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      color: '#6E6E6E',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isLoggedIn
                      ? `${ROLE_LABELS[role] || role} · ${displayName}`
                      : 'Modo invitado'
                    }
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#161616', border: '1px solid #232323' }}
              >
                <X className="w-4 h-4" style={{ color: '#8A8A8A' }} />
              </button>
            </div>

            {/* Navigation grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-3 gap-2">
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
                      onPress={() => {
                        if (item.href) {
                          window.location.assign(item.href);
                          return;
                        }
                        setCurrentSection(item.id);
                        onClose();
                      }}
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
                transition={{ delay: 0.22 }}
                className="mx-4 mb-5 p-4 rounded-2xl shrink-0"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1F1F1F' }}
              >
                <p
                  className="text-xs text-center mb-3"
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: '0.04em',
                  }}
                >
                  Únete a POLYFAUNA
                </p>
                <div className="flex gap-2.5">
                  <a
                    href="/login"
                    onClick={onClose}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#CFCFCF', border: '1px solid #232323' }}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Entrar
                  </a>
                  <a
                    href="/signup"
                    onClick={onClose}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-3 rounded-xl"
                    style={{ background: '#ECECEC', color: '#0A0A0A' }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Crear cuenta
                  </a>
                </div>
              </motion.div>
            )}

            <div className="shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
