import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarDays, CheckCircle, ChevronDown, ChevronRight, Clock, FileText, Headphones, LogOut, MapPin, Play, QrCode, Radio, Settings, Shield, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ROLE_LABEL = { citizen: 'Wave Citizen', artist: 'Artista', promoter: 'Promotor', club: 'Club', admin: 'Admin' };

const DEMO_NOTIFS = [
  { id: 1, icon: Radio,     color: '#FF8A1F', title: 'Polyfauna Radio en vivo',       body: 'Underground Frequencies con Nox Vega.',      time: 'Hace 5 min' },
  { id: 2, icon: Headphones, color: 'rgba(255,255,255,0.85)', title: 'Nuevo podcast disponible',       body: 'Frecuencias Oscuras #12 — HVBER.',            time: 'Hace 1h'    },
  { id: 3, icon: Bell,       color: '#FBBF24', title: 'Evento próximo: Subterranea',    body: 'Este lunes — Teatro Metropol.',               time: 'Hace 3h'    },
  { id: 4, icon: FileText,   color: '#A78BFA', title: 'Nuevo artículo en el blog',      body: 'El sonido del techno industrial colombiano.', time: 'Ayer'       },
];

function NotificationsModal({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            ref={ref}
            className="fixed top-20 right-4 z-50 w-80 rounded-2xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{ background: 'rgba(8,12,11,0.97)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Notificaciones</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,112,67,0.2)', color: '#FF8A1F' }}>
                  {DEMO_NOTIFS.length}
                </span>
              </div>
              <button type="button" onClick={onClose}
                className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {DEMO_NOTIFS.map((n, i) => {
                const Icon = n.icon;
                return (
                  <motion.button key={n.id} type="button"
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/4"
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    onClick={onClose}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${n.color}18`, border: `1px solid ${n.color}30` }}>
                      <Icon className="w-4 h-4" style={{ color: n.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight">{n.title}</p>
                      <p className="text-[11px] text-white/45 leading-snug mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{n.time}</span>
                  </motion.button>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <button type="button" className="text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: '#FF8A1F' }} onClick={onClose}>
                Marcar todo como leído
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const FALLBACK_PODCAST = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop';
const FALLBACK_EVENT   = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=400&auto=format&fit=crop';
const FALLBACK_ARTIST  = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=80&auto=format&fit=crop';

function SectionHeader({ title, onViewAll }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">{title}</h2>
      {onViewAll && (
        <button type="button" onClick={onViewAll}
          className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.85)' }}>
          Ver todo <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function QRPlaceholder() {
  return (
    <div className="w-12 h-12 shrink-0 rounded-lg flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <QrCode className="w-6 h-6 text-white/25" />
    </div>
  );
}

function TicketCard({ ticket }) {
  const event = ticket.events;
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(8,14,9,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="relative h-10 overflow-hidden">
        <img src={event?.image_url || FALLBACK_EVENT} alt={event?.title}
          className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/20" />
        <p className="absolute bottom-1.5 left-3 text-[10px] font-bold text-white truncate max-w-[65%]">
          {event?.title || 'Evento'}
        </p>
      </div>
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          {event?.date && (
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span>{new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
            </div>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <QRPlaceholder />
          <div className="flex items-center gap-0.5">
            <CheckCircle className="w-2.5 h-2.5" style={{ color: '#22c55e' }} />
            <span className="text-[9px] font-bold" style={{ color: '#22c55e' }}>Válido</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({ event, index }) {
  const date = event.date ? new Date(event.date) : null;
  const day  = date?.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex items-center gap-3 group cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <img src={event.image_url || FALLBACK_EVENT} alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
      </div>
      <div className="flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs font-bold text-white leading-tight truncate group-hover:text-[#FBBF24] transition-colors cursor-default">
              {event.title}
            </p>
          </TooltipTrigger>
          <TooltipContent side="left"><p>{event.title}</p></TooltipContent>
        </Tooltip>
        <p className="text-[10px] text-white/35 truncate mt-0.5">{event.venue || 'Por confirmar'}</p>
      </div>
      {day && (
        <span className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.2)' }}>
          {day}
        </span>
      )}
    </motion.div>
  );
}

function PodcastRow({ pod, isPlaying, onPlay }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
        <img src={pod.cover_url || FALLBACK_PODCAST} alt={pod.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
      </div>
      <div className="flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs font-bold text-white leading-tight truncate cursor-default">{pod.title}</p>
          </TooltipTrigger>
          <TooltipContent side="left"><p>{pod.title}</p></TooltipContent>
        </Tooltip>
        <p className="text-[10px] text-white/35 truncate">{pod.artists?.name || 'PolyFauna'}</p>
      </div>
      <button type="button" onClick={onPlay}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
        style={{
          background: isPlaying ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
          color: isPlaying ? '#06090A' : 'rgba(255,255,255,0.8)',
          boxShadow: isPlaying ? '0 0 12px rgba(32,199,232,0.4)' : 'none',
        }}>
        <Play className="w-3 h-3 ml-0.5" />
      </button>
    </div>
  );
}

function ArtistAvatar({ artist, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06 }}
      className="flex flex-col items-center gap-1.5 cursor-pointer group"
    >
      <div className="w-11 h-11 rounded-full overflow-hidden transition-transform duration-200 group-hover:scale-110"
        style={{ border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 0 0 0 rgba(129,140,248,0)' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(129,140,248,0.5)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 0 rgba(129,140,248,0)'}>
        <img src={artist.image_url || FALLBACK_ARTIST} alt={artist.name}
          className="w-full h-full object-cover" />
      </div>
      <p className="text-[9px] font-semibold text-white/45 truncate max-w-[52px] text-center group-hover:text-white/70 transition-colors">
        {artist.name}
      </p>
    </motion.div>
  );
}

export default function RightPanel({ setCurrentSection }) {
  const { currentUser, userRole, logout } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = profile?.display_name || currentUser?.email?.split('@')[0] || 'Wave Citizen';
  const displayRole = profile ? (ROLE_LABEL[profile.role] || 'Wave Citizen') : (currentUser ? 'Wave Citizen' : 'Invitado');

  const handleLogout = async () => { await logout(); navigate('/'); };

  const { data: tickets } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('user_tickets').select('*, events(title, date, venue, image_url)').eq('user_id', currentUser.id).limit(2)
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  const { data: events } = useSupabaseQuery(
    () => supabase.from('events').select('id, title, date, venue, image_url')
      .gte('date', new Date().toISOString()).order('date', { ascending: true }).limit(3),
    []
  );

  const { data: podcasts } = useSupabaseQuery(
    () => supabase.from('podcasts').select('*, artists(name)').order('created_at', { ascending: false }).limit(3),
    []
  );

  const { data: artists } = useSupabaseQuery(
    () => supabase.from('artists').select('id, name, image_url').limit(5),
    []
  );

  return (
    <>
      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />

    <aside className="w-72 shrink-0 h-full flex flex-col border-l overflow-y-auto"
      style={{ background: 'rgba(8,12,11,0.97)', borderColor: 'rgba(255,255,255,0.07)' }}>

      {/* 0 — User Identity */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {currentUser ? (
          <div className="flex items-center gap-3">
            {/* ── User menu trigger + glass panel ── */}
            <div className="relative flex-1 min-w-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2.5 w-full rounded-xl py-1 px-1 transition-colors text-left"
                style={{ background: menuOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="w-9 h-9 rounded-full overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 100%)', border: '2px solid rgba(255,255,255,0.1)' }}
                >
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-white m-auto mt-1.5" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight truncate">{displayName}</p>
                  <p className="text-[11px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{displayRole}</p>
                </div>
                <motion.div animate={{ rotate: menuOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
                </motion.div>
              </button>

              {/* Glass panel */}
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: 'rgba(8,13,12,0.78)',
                      backdropFilter: 'blur(64px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(64px) saturate(200%)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      boxShadow: '0 32px 72px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    {/* Brillo superior glass */}
                    <div className="absolute top-0 left-0 right-0 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.18) 50%, transparent 90%)' }} />
                    {/* Reflejo lateral izquierdo */}
                    <div className="absolute top-2 left-0 bottom-2 w-px"
                      style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.07) 60%, transparent)' }} />

                    {/* Opciones de navegación */}
                    <div className="py-2 px-1.5">
                      {[
                        { label: 'Mi Panel',     icon: User,    onClick: () => { setCurrentSection?.('mi-panel'); setMenuOpen(false); } },
                        ...(profile?.role === 'promoter' || profile?.role === 'club' || userRole === 'admin'
                          ? [{ label: 'Promoter Hub', icon: Settings, onClick: () => { setCurrentSection?.('promoter'); setMenuOpen(false); } }]
                          : []),
                        ...(userRole === 'admin'
                          ? [{ label: 'Admin Panel', icon: Shield, onClick: () => { navigate('/admin'); setMenuOpen(false); } }]
                          : []),
                      ].map(({ label, icon: Icon, onClick }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={onClick}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group"
                          style={{ color: 'rgba(255,255,255,0.60)' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.92)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.60)';
                          }}
                        >
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                            <Icon className="w-3.5 h-3.5 text-white/60 group-hover:text-white/90 transition-colors" />
                          </span>
                          {label}
                          <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-20 group-hover:opacity-60 transition-opacity" />
                        </button>
                      ))}
                    </div>

                    {/* Divider + logout */}
                    <div className="px-3 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        type="button"
                        onClick={() => { handleLogout(); setMenuOpen(false); }}
                        className="mt-1.5 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                        style={{ color: 'rgba(239,68,68,0.7)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; }}
                      >
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <LogOut className="w-3.5 h-3.5 text-red-400" />
                        </span>
                        Cerrar sesión
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bell */}
            <button type="button" onClick={() => setNotifOpen(v => !v)}
              className="relative p-2 rounded-lg shrink-0 transition-colors"
              style={{ color: notifOpen ? '#FF8A1F' : 'rgba(255,255,255,0.45)', background: notifOpen ? 'rgba(255,112,67,0.08)' : 'transparent' }}
              onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = notifOpen ? 'rgba(255,112,67,0.08)' : 'transparent'; }}>
              <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: '#FF8A1F' }}>
                {DEMO_NOTIFS.length}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <User className="w-4 h-4 text-white/30" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white/50">Sin sesión activa</p>
              <div className="flex gap-2 mt-0.5">
                <a href="/login" className="text-[10px] font-bold hover:underline" style={{ color: 'rgba(255,255,255,0.85)' }}>Ingresar</a>
                <span className="text-[10px] text-white/20">·</span>
                <a href="/signup" className="text-[10px] font-bold hover:underline" style={{ color: '#FF8A1F' }}>Crear cuenta</a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 1 — My QR Tickets */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <SectionHeader title="My QR Tickets" onViewAll={currentUser ? () => setCurrentSection?.('tickets') : undefined} />
        {!currentUser ? (
          <p className="text-[11px] text-white/30 py-2 text-center">Inicia sesión para ver tus entradas.</p>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-[11px] text-white/30 py-3 text-center">No tienes entradas aún.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <TicketCard ticket={t} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 2 — Próximos Eventos */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <SectionHeader title="Próximos Eventos" onViewAll={() => setCurrentSection?.('events')} />
        {!events || events.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CalendarDays className="w-4 h-4 text-white/20 shrink-0" />
            <p className="text-[11px] text-white/30">Sin eventos próximos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev, i) => <EventRow key={ev.id} event={ev} index={i} />)}
          </div>
        )}
      </div>

      {/* 3 — Artistas Destacados */}
      {artists && artists.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <SectionHeader title="Artistas" onViewAll={() => setCurrentSection?.('artists')} />
          <div className="flex items-start gap-2 flex-wrap">
            {artists.map((a, i) => <ArtistAvatar key={a.id} artist={a} index={i} />)}
          </div>
        </div>
      )}

      {/* 4 — Featured Podcasts */}
      <div className="p-4">
        <SectionHeader title="Featured Podcasts" onViewAll={() => setCurrentSection?.('podcasts')} />
        {!podcasts || podcasts.length === 0 ? (
          <p className="text-[11px] text-white/30 py-3 text-center">No hay podcasts disponibles.</p>
        ) : (
          <div className="space-y-3">
            {podcasts.map((pod, i) => (
              <motion.div key={pod.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <PodcastRow
                  pod={pod}
                  isPlaying={playing === pod.id}
                  onPlay={() => setPlaying(playing === pod.id ? null : pod.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
