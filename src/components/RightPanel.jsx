import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle, ChevronRight, Clock, MapPin, Play, QrCode, User } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
          style={{ color: '#00CFFF' }}>
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
      style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
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
          background: isPlaying ? '#00CFFF' : 'rgba(0,207,255,0.1)',
          color: isPlaying ? '#080B14' : '#00CFFF',
          boxShadow: isPlaying ? '0 0 12px rgba(0,207,255,0.4)' : 'none',
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
  const { currentUser } = useAuth();
  const [playing, setPlaying] = useState(null);

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
    <aside className="w-72 shrink-0 h-full flex flex-col border-l overflow-y-auto"
      style={{ background: 'rgba(8,11,22,0.97)', borderColor: 'rgba(255,255,255,0.07)' }}>

      {/* 1 — My QR Tickets */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <SectionHeader title="My QR Tickets" onViewAll={() => setCurrentSection?.('tickets')} />
        {!currentUser ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(0,207,255,0.08)', border: '1px solid rgba(0,207,255,0.12)' }}>
              <User className="w-4 h-4" style={{ color: '#00CFFF' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white/70">Sin sesión activa</p>
              <a href="/login" className="text-[10px] font-bold hover:underline" style={{ color: '#00CFFF' }}>
                Iniciar sesión →
              </a>
            </div>
          </div>
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
  );
}
