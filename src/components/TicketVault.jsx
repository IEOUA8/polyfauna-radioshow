import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Clock, MapPin, QrCode, Ticket, XCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState, LoginRequired } from '@/components/SectionStates';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=600&auto=format&fit=crop';

const STATUS_CONFIG = {
  valid: { label: 'Válido', color: '#22c55e', Icon: CheckCircle },
  used: { label: 'Usado', color: 'rgba(255,255,255,0.25)', Icon: XCircle },
  ready: { label: 'Listo', color: '#00CFFF', Icon: CheckCircle },
};

function TicketCard({ ticket, index }) {
  const event = ticket.events;
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.valid;
  const StatusIcon = status.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Event image header */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={event?.image_url || FALLBACK}
          alt={event?.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00CFFF' }}>
              {ticket.ticket_type || 'GA'}
            </p>
            <p className="text-base font-black text-white leading-tight mt-0.5 truncate">
              {event?.title || 'Evento'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusIcon className="w-3.5 h-3.5" style={{ color: status.color }} />
            <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Dashed divider + ticket body */}
      <div className="px-4 py-3 flex items-stretch gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {event?.date && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          {event?.venue && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
          <div className="pt-1">
            <p className="text-[10px] text-white/25 font-mono"># {ticket.ticket_number}</p>
          </div>
        </div>

        {/* QR */}
        <div
          className="w-16 h-16 shrink-0 rounded-lg flex items-center justify-center self-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <QrCode className="w-8 h-8" style={{ color: status.color, opacity: ticket.status === 'used' ? 0.2 : 0.7 }} />
        </div>
      </div>

      {/* Perforation line */}
      <div className="mx-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/25">polyfauna.io/ticket</span>
        <span className="text-[10px] font-mono" style={{ color: status.color }}>{ticket.status?.toUpperCase()}</span>
      </div>
    </motion.div>
  );
}

export default function TicketVault() {
  const { currentUser } = useAuth();

  const { data: tickets, loading, error, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('user_tickets').select('*, events(title, date, venue, image_url)').eq('user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para ver tus entradas." /></div>;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Ticket Vault</h1>
        <p className="text-sm text-white/40 mt-1">Tus entradas para los próximos eventos.</p>
      </div>

      {loading && <CardSkeleton count={3} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && (!tickets || tickets.length === 0) && (
        <EmptyState label="No tienes entradas aún" icon={Ticket} />
      )}
      {!loading && !error && tickets && tickets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((ticket, i) => (
            <TicketCard key={ticket.id} ticket={ticket} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
