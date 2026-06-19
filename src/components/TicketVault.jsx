import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, Clock, MapPin, Ticket, X, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState, LoginRequired } from '@/components/SectionStates';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=600&auto=format&fit=crop';

const STATUS_CONFIG = {
  valid: { label: 'Válido',  color: '#22c55e', Icon: CheckCircle },
  ready: { label: 'Listo',   color: '#00CFFF', Icon: CheckCircle },
  used:  { label: 'Usado',   color: 'rgba(255,255,255,0.25)', Icon: XCircle },
};

function qrPayload(ticket) {
  return `polyfauna://ticket/${ticket.id}`;
}

/* ── QR Modal ── */
function QRModal({ ticket, onClose }) {
  const event  = ticket.events;
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.valid;
  const StatusIcon = status.Icon;
  const isUsed = ticket.status === 'used';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(5, 8, 20, 0.92)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative max-w-sm w-full rounded-3xl overflow-hidden"
          style={{ background: 'rgba(15, 19, 34, 0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header image */}
          <div className="relative h-32 overflow-hidden">
            <img src={event?.image_url || FALLBACK} alt={event?.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1322] via-black/40 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-4 flex flex-col items-center gap-5">
            {/* Event info */}
            <div className="w-full text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#00CFFF' }}>
                {ticket.ticket_type || 'GA'}
              </p>
              <h2 className="text-lg font-black text-white leading-tight">
                {event?.title || 'Evento'}
              </h2>
              {event?.date && (
                <p className="text-xs text-white/40 mt-1">
                  {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {event.venue && ` · ${event.venue}`}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div
              className="p-4 rounded-2xl flex items-center justify-center"
              style={{
                background: isUsed ? 'rgba(255,255,255,0.04)' : '#ffffff',
                filter:     isUsed ? 'grayscale(1) opacity(0.25)' : 'none',
                transition: 'all 0.3s',
              }}
            >
              <QRCodeSVG
                value={qrPayload(ticket)}
                size={200}
                bgColor="#ffffff"
                fgColor="#080B14"
                level="H"
                includeMargin={false}
              />
            </div>

            {isUsed && (
              <p className="text-xs font-bold text-white/30 -mt-2">Esta entrada ya fue usada</p>
            )}

            {/* Status + ticket number */}
            <div className="w-full flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <StatusIcon className="w-3.5 h-3.5" style={{ color: status.color }} />
                <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
              </div>
              <span className="text-[10px] font-mono text-white/30">#{ticket.ticket_number?.slice(0, 16)}</span>
            </div>

            {/* Dashed divider */}
            <div className="w-full border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <p className="text-[11px] text-white/25 text-center">
              Muestra este QR en la entrada del evento.
              <br />Válido solo para el portador del ticket.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Ticket Card ── */
function TicketCard({ ticket, index, onShowQR }) {
  const event  = ticket.events;
  const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.valid;
  const StatusIcon = status.Icon;
  const isUsed = ticket.status === 'used';

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
        <img src={event?.image_url || FALLBACK} alt={event?.title} className="w-full h-full object-cover" />
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

      {/* Ticket body */}
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
          <p className="text-[10px] text-white/25 font-mono pt-1"># {ticket.ticket_number?.slice(0, 16)}</p>
        </div>

        {/* QR thumbnail — click to expand */}
        <button
          type="button"
          onClick={() => onShowQR(ticket)}
          className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center self-center transition-all hover:scale-105 active:scale-95"
          style={{
            background: isUsed ? 'rgba(255,255,255,0.04)' : '#ffffff',
            border:     isUsed ? '1px solid rgba(255,255,255,0.06)' : 'none',
            filter:     isUsed ? 'grayscale(1) opacity(0.25)' : 'none',
            padding: '6px',
          }}
          title="Ver QR"
        >
          <QRCodeSVG
            value={qrPayload(ticket)}
            size={44}
            bgColor="#ffffff"
            fgColor="#080B14"
            level="H"
            includeMargin={false}
          />
        </button>
      </div>

      {/* Perforation line */}
      <div className="mx-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-white/25">Toca el QR para expandir</span>
        <span className="text-[10px] font-mono" style={{ color: status.color }}>{ticket.status?.toUpperCase()}</span>
      </div>
    </motion.div>
  );
}

/* ── Main Component ── */
export default function TicketVault() {
  const { currentUser } = useAuth();
  const [activeTicket, setActiveTicket] = useState(null);

  const { data: tickets, loading, error, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('user_tickets').select('*, events(title, date, venue, image_url)').eq('user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para ver tus entradas." /></div>;

  return (
    <>
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
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={i}
                onShowQR={setActiveTicket}
              />
            ))}
          </div>
        )}
      </div>

      {activeTicket && (
        <QRModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}
    </>
  );
}
