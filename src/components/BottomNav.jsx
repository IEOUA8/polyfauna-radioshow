import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Headphones, Music, Radio, User } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'radio-console', icon: Radio,      label: 'Radio'    },
  { id: 'podcasts',      icon: Headphones,  label: 'Podcasts' },
  { id: 'events',        icon: Calendar,    label: 'Eventos'  },
  { id: 'music',         icon: Music,       label: 'Música'   },
  { id: 'mi-panel',      icon: User,        label: 'Perfil'   },
];

export default function BottomNav({ currentSection, setCurrentSection }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        height: 56,
        background: 'rgba(4,8,8,0.97)',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-stretch justify-around h-full px-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = currentSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCurrentSection(id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative transition-none"
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-bar"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.85)', width: 24 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
              </AnimatePresence>

              <motion.div
                animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 22 }}
              >
                <Icon
                  className="w-[18px] h-[18px]"
                  style={{ color: isActive ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.28)' }}
                />
              </motion.div>
              <span
                className="text-[9px] font-semibold tracking-wide leading-none"
                style={{ color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
