import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, Headphones, Lock, Music, Radio, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { id: 'radio-console', icon: Radio,     label: 'Radio',    public: true  },
  { id: 'podcasts',      icon: Headphones, label: 'Podcasts', public: true  },
  { id: 'music',         icon: Music,     label: 'Música',   public: false },
  { id: 'organism',      icon: Dna,       label: 'Organismo', public: false },
  { id: 'settings',      icon: SlidersHorizontal, label: 'Control', public: false },
];

export default function BottomNav({ currentSection, setCurrentSection }) {
  const { currentUser } = useAuth();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(4,8,8,0.97)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-stretch justify-around h-[56px] px-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label, public: isPublic }) => {
          const isActive = currentSection === id;
          const locked   = !isPublic && !currentUser;

          return (
            <motion.button
              key={id}
              type="button"
              whileTap={locked ? undefined : { scale: 0.94 }}
              onClick={() => !locked && setCurrentSection(id)}
              disabled={locked}
              aria-current={isActive && !locked ? 'page' : undefined}
              aria-label={locked ? `${label}. Inicia sesión para acceder` : label}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative transition-none overflow-hidden rounded-2xl"
              title={locked ? 'Inicia sesión para acceder' : undefined}
            >
              <AnimatePresence>
                {isActive && !locked && (
                  <>
                    <motion.div
                      layoutId="bottom-nav-glow"
                      className="absolute inset-x-2 top-1 bottom-1 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.045)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                    <motion.div
                      layoutId="bottom-nav-bar"
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                      style={{ background: '#ECECEC', width: 24 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.div
                animate={{ scale: isActive && !locked ? 1.12 : 1, y: isActive && !locked ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                className="relative z-10"
              >
                <Icon
                  className={id === 'organism' && !locked ? 'w-[18px] h-[18px] icon-organism-alive' : 'w-[18px] h-[18px]'}
                  style={{ color: locked ? 'rgba(255,255,255,0.15)' : isActive ? '#ECECEC' : '#5E5E5E' }}
                />
                {locked && (
                  <Lock
                    className="absolute -bottom-0.5 -right-1 w-2.5 h-2.5"
                    style={{ color: 'rgba(255,255,255,0.20)' }}
                  />
                )}
              </motion.div>

              <span
                className="relative z-10 text-[9px] font-semibold tracking-wide leading-none"
                style={{ color: locked ? 'rgba(255,255,255,0.15)' : isActive ? '#ECECEC' : '#5E5E5E' }}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
