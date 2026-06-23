import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, CalendarDays, Disc3, Dna, FileText, Gauge,
  Headphones, Lock, MessageSquare, Music, Radio,
  SlidersHorizontal, Ticket, User as UserIcon,
} from 'lucide-react';
import Logo from '@/components/Logo';
import HoloSpectrum from '@/components/HoloSpectrum';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { supabase } from '@/lib/customSupabaseClient';

const ALL_NAV = [
  { id: 'radio-console', label: 'Radio Console',     icon: Radio,             public: true  },
  { id: 'podcasts',      label: 'Podcasts',           icon: Headphones,        public: true  },
  { id: 'music',         label: 'Música',             icon: Music,             public: false },
  { id: 'organism',      label: 'Organismo',          icon: Dna,               public: false },
  { id: 'events',        label: 'Event Terminal',     icon: CalendarDays,      public: false },
  { id: 'artists',       label: 'Artists & Labels',   icon: Disc3,             public: false },
  { id: 'blog',          label: 'Blog & Entrevistas', icon: FileText,          public: false },
  { id: 'inbox',         label: 'Signal Inbox',       icon: MessageSquare,     public: false },
  { id: 'tickets',       label: 'Ticket Vault',       icon: Ticket,            public: false },
  { id: 'mi-panel',      label: 'Panel de Usuario',   icon: UserIcon,          public: false },
  { id: 'settings',      label: 'Control Center',     icon: SlidersHorizontal, public: false },
];

function PendingRoleBanner({ userId }) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('role_requests')
      .select('requested_role, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setPending(data); });
  }, [userId]);

  if (!pending || pending.status !== 'pending') return null;

  const labels = { artist: 'Artista', promoter: 'Promotor', club: 'Club/Venue', sello: 'Sello' };

  return (
    <div className="mt-3 p-2.5 rounded-lg"
      style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.18)' }}>
      <p className="text-[10px] font-bold" style={{ color: 'rgba(255,165,0,0.85)' }}>
        ⏳ Solicitud de {labels[pending.requested_role] || pending.requested_role} en revisión
      </p>
    </div>
  );
}

function NavContent({ currentSection, setCurrentSection, profile, currentUser }) {
  const { song, isOnline, listeners } = useNowPlaying();
  const isLoggedIn = !!currentUser;
  const role = profile?.role || 'citizen';

  const navigate = (id, locked) => {
    if (locked) return;
    setCurrentSection(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo — aire arriba 22px, sin padding inferior (nav tiene su propio margen) */}
      <div className="px-5 pt-[22px] pb-0 shrink-0">
        <Logo variant="header" />
      </div>

      {/* Navigation — 30px de separación respecto al logo + divisor sutil */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto mt-[30px]">
        <div className="mx-1 mb-[18px]" style={{ height: 1, background: '#1F1F1F' }} />
        {ALL_NAV.map((item) => {
          const active = currentSection === item.id;
          const locked = !item.public && !isLoggedIn;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id, locked)}
              title={locked ? 'Inicia sesión para acceder' : undefined}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                locked
                  ? 'opacity-35 cursor-not-allowed'
                  : active
                    ? 'text-white bg-white/8'
                    : 'text-white/40 hover:text-white/75 hover:bg-white/4'
              }`}
            >
              {active && !locked && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-white/80" />
              )}
              <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                locked ? 'text-white/25' : active ? 'text-white' : 'text-white/35 group-hover:text-white/60'
              }`} />
              <span className="flex-1 text-left">{item.label}</span>
              {locked && <Lock className="w-3 h-3 text-white/20 shrink-0" />}
            </button>
          );
        })}

        {/* Pending role banner */}
        {isLoggedIn && role === 'citizen' && (
          <PendingRoleBanner userId={currentUser?.id} />
        )}

        {/* Gestor de Eventos — promotor / club / admin */}
        {isLoggedIn && (role === 'promoter' || role === 'club' || role === 'admin') && (
          <>
            <div className="my-2 mx-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
            <button type="button" onClick={() => navigate('promoter', false)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                currentSection === 'promoter' ? 'text-white bg-white/8' : 'text-white/40 hover:text-white/75 hover:bg-white/4'
              }`}
            >
              {currentSection === 'promoter' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-white/80" />
              )}
              <Gauge className={`w-4 h-4 shrink-0 ${currentSection === 'promoter' ? 'text-white' : 'text-white/35 group-hover:text-white/60'}`} />
              Gestor de Eventos
            </button>
          </>
        )}

      </nav>

      {/* Guest CTA */}
      {!isLoggedIn && (
        <div className="mx-3 mb-3 p-3 rounded-xl space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <Lock className="w-3.5 h-3.5 text-white/40" />
            </div>
            <p className="text-[11px] text-white/40 leading-tight">
              Inicia sesión para acceder a toda la plataforma
            </p>
          </div>
          <div className="flex gap-1.5">
            <a href="/login"
              className="flex-1 text-center text-[11px] font-bold py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
              Entrar
            </a>
            <a href="/signup"
              className="flex-1 text-center text-[11px] font-bold py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
              Registrarse
            </a>
          </div>
        </div>
      )}

      {/* Live Radio Widget */}
      <div className="mx-3 mb-4 rounded-xl p-4 shrink-0 glass-card holo-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Polyfauna Radio</span>
          {isOnline ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <motion.span animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inline-flex h-full w-full rounded-full" style={{ background: '#FF8A1F' }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#FF8A1F' }} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#FF8A1F' }}>Live</span>
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/20">Offline</span>
          )}
        </div>
        <p className="text-white text-sm font-semibold leading-tight truncate">
          {song?.title || 'PolyFauna Radio'}
        </p>
        <div className="flex items-center justify-between mt-0.5 mb-3">
          <p className="text-white/30 text-xs truncate">{song?.artist || (isOnline ? 'Transmisión 24/7' : 'Sin señal')}</p>
          {listeners > 0 && <span className="text-[10px] text-white/25 shrink-0 ml-1">{listeners} 🎧</span>}
        </div>
        <HoloSpectrum isPlaying height={28} />
        <button type="button" onClick={() => setCurrentSection('radio-console')}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all text-white/60 hover:text-white/90"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          Go to Radio Console <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ currentSection, setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile }     = useProfile();

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r"
      style={{ background: 'rgba(8,12,11,0.98)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <NavContent
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        profile={profile}
        currentUser={currentUser}
      />
    </aside>
  );
}
