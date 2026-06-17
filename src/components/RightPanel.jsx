import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ChevronRight, Clock, MapPin, Play, QrCode } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK_PODCAST = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop';
const FALLBACK_EVENT = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=400&auto=format&fit=crop';

function QRPlaceholder() {
  return (
    <div
      className="w-14 h-14 shrink-0 rounded-lg flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <QrCode className="w-7 h-7 text-white/30" />
    </div>
  );
}

function PodcastRow({ pod, isPlaying, onPlay }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
        <img src={pod.cover_url || FALLBACK_PODCAST} alt={pod.title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white leading-tight truncate">{pod.title}</p>
        <p className="text-[11px] text-white/40 truncate">{pod.artists?.name || 'PolyFauna'}</p>
        {pod.duration && (
          <p className="text-[11px] text-white/30 mt-0.5">
            {Math.floor(pod.duration / 60)}:{String(pod.duration % 60).padStart(2, '0')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{
          background: isPlaying ? '#00CFFF' : 'rgba(0,207,255,0.12)',
          color: isPlaying ? '#080B14' : '#00CFFF',
        }}
      >
        <Play className="w-3 h-3 ml-0.5" />
      </button>
    </div>
  );
}

function TicketCard({ ticket }) {
  const event = ticket.events;
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'rgba(15, 19, 34, 0.9)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="relative h-12 overflow-hidden">
        <img
          src={event?.image_url || FALLBACK_EVENT}
          alt={event?.title}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
        <p className="absolute bottom-1.5 left-3 text-[11px] font-bold text-white leading-tight max-w-[60%] truncate">
          {event?.title || 'Evento'}
        </p>
      </div>
      <div className="p-3 flex gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          {event?.date && (
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{new Date(event.date).toLocaleDateString('es-CO')}</span>
            </div>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1 text-[10px] text-white/50">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,207,255,0.12)', color: '#00CFFF' }}>
              {ticket.ticket_type}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <QRPlaceholder />
          <span className="text-[9px] font-mono text-white/40">{ticket.ticket_number?.slice(0, 8)}</span>
          <div className="flex items-center gap-0.5">
            <CheckCircle className="w-2.5 h-2.5" style={{ color: ticket.status === 'valid' ? '#22c55e' : '#00CFFF' }} />
            <span className="text-[9px] font-semibold" style={{ color: ticket.status === 'valid' ? '#22c55e' : '#00CFFF' }}>
              {ticket.status === 'valid' ? 'Válido' : 'Listo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RightPanel() {
  const { currentUser } = useAuth();
  const [playing, setPlaying] = useState(null);

  const { data: podcasts } = useSupabaseQuery(
    () => supabase.from('podcasts').select('*, artists(name)').order('created_at', { ascending: false }).limit(3),
    []
  );

  const { data: tickets } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('user_tickets').select('*, events(title, date, venue, image_url)').eq('user_id', currentUser.id).limit(3)
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  return (
    <aside
      className="w-72 shrink-0 h-full flex flex-col border-l overflow-y-auto"
      style={{ background: 'rgba(8, 11, 22, 0.97)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* My QR Tickets */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">My QR Tickets</h2>
          <button type="button" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: '#00CFFF' }}>
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {!currentUser ? (
          <p className="text-xs text-white/30 text-center py-4">Inicia sesión para ver tus entradas.</p>
        ) : !tickets || tickets.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">No tienes entradas aún.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket, i) => (
              <motion.div key={ticket.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                <TicketCard ticket={ticket} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Podcasts */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white">Featured Podcasts</h2>
          <button type="button" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: '#00CFFF' }}>
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {!podcasts || podcasts.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">No hay podcasts disponibles.</p>
        ) : (
          <div className="space-y-3">
            {podcasts.map((pod, i) => (
              <motion.div key={pod.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
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
