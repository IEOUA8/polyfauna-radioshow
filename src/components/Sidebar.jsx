import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, CalendarDays, Disc3, FileText, Headphones,
  LayoutGrid, MessageSquare, Music, Radio, SlidersHorizontal,
  Ticket, User, Video,
} from 'lucide-react';
import Logo from '@/components/Logo';
import HoloSpectrum from '@/components/HoloSpectrum';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const NAV_ITEMS = [
  { id: 'radio-console', label: 'Radio Console',   icon: Radio             },
  { id: 'podcasts',      label: 'Podcasts',         icon: Headphones        },
  { id: 'music',         label: 'Música',           icon: Music             },
  { id: 'community',     label: 'Community Grid',   icon: LayoutGrid        },
  { id: 'inbox',         label: 'Signal Inbox',     icon: MessageSquare     },
  { id: 'events',        label: 'Event Terminal',   icon: CalendarDays      },
  { id: 'artists',       label: 'Artists & Labels', icon: Disc3             },
  { id: 'blog',          label: 'Blog',             icon: FileText          },
  { id: 'interviews',    label: 'Interviews',        icon: Video             },
  { id: 'tickets',       label: 'Ticket Vault',     icon: Ticket            },
  { id: 'settings',      label: 'Control Center',   icon: SlidersHorizontal },
];

function NavContent({ currentSection, setCurrentSection, profile, currentUser, onNavigate }) {
  const { song, isOnline, listeners } = useNowPlaying();
  const navigate = (id) => {
    setCurrentSection(id);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-3 pt-6 pb-8 shrink-0">
        <Logo size="md" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = currentSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                active
                  ? 'text-white bg-white/8'
                  : 'text-white/40 hover:text-white/75 hover:bg-white/4'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-white/80" />
              )}
              <item.icon
                className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-white' : 'text-white/35 group-hover:text-white/60'}`}
              />
              {item.label}
            </button>
          );
        })}

        {/* Promoter Hub */}
        {(profile?.role === 'promoter' || profile?.role === 'club' || profile?.role === 'admin') && (
          <>
            <div className="my-2 mx-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
            <button
              type="button"
              onClick={() => navigate('promoter')}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                currentSection === 'promoter'
                  ? 'text-white bg-white/8'
                  : 'text-white/40 hover:text-white/75 hover:bg-white/4'
              }`}
            >
              {currentSection === 'promoter' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-white/80" />
              )}
              <Ticket className={`w-4 h-4 shrink-0 ${currentSection === 'promoter' ? 'text-white' : 'text-white/35 group-hover:text-white/60'}`} />
              Promoter Hub
            </button>
          </>
        )}
      </nav>

      {/* Unauthenticated CTA */}
      {!currentUser && (
        <div className="mx-3 mb-3 p-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <User className="w-4 h-4 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white/40">¿Nuevo aquí?</p>
            <a href="/signup" className="text-[11px] font-bold text-white/80 hover:text-white hover:underline transition-colors">
              Crear cuenta →
            </a>
          </div>
        </div>
      )}

      {/* Live Radio Widget */}
      <div className="mx-3 mb-4 rounded-xl p-4 shrink-0 glass-card holo-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Polyfauna Radio</span>
          <span className="flex items-center gap-1.5">
            {isOnline ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <motion.span
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inline-flex h-full w-full rounded-full"
                    style={{ background: '#FF8A1F' }}
                  />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#FF8A1F' }} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#FF8A1F' }}>Live</span>
              </>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/20">Offline</span>
            )}
          </span>
        </div>

        <p className="text-white text-sm font-semibold leading-tight truncate">
          {song?.title || 'PolyFauna Radio'}
        </p>
        <div className="flex items-center justify-between mt-0.5 mb-3">
          <p className="text-white/30 text-xs truncate">{song?.artist || (isOnline ? 'Transmisión 24/7' : 'Sin señal')}</p>
          {listeners > 0 && (
            <span className="text-[10px] text-white/25 shrink-0 ml-1">{listeners} 🎧</span>
          )}
        </div>

        <HoloSpectrum isPlaying={true} height={28} />

        <button
          type="button"
          onClick={() => navigate('radio-console')}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all duration-200 text-white/60 hover:text-white/90"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          Go to Radio Console
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ currentSection, setCurrentSection, mobileOpen, setMobileOpen }) {
  const { currentUser } = useAuth();
  const { profile } = useProfile();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r"
        style={{ background: 'rgba(8, 12, 11, 0.98)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <NavContent
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          profile={profile}
          currentUser={currentUser}
        />
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-60 border-r"
          style={{ background: 'rgba(8, 12, 11, 0.99)', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <NavContent
            currentSection={currentSection}
            setCurrentSection={setCurrentSection}
            profile={profile}
            currentUser={currentUser}
            onNavigate={() => setMobileOpen?.(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
