import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Building, Calendar, CheckCircle, ChevronRight, Loader2, MapPin, Star, Ticket, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';

function formatPrice(price) {
  if (!price && price !== 0) return 'Gratis';
  return `$${Number(price).toLocaleString('es-CO')}`;
}

/* ── Modal de compra ── */
function BuyModal({ event, onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('idle'); // idle | buying | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');

  const handleConfirm = async () => {
    if (!currentUser) {
      onClose();
      navigate('/login');
      return;
    }
    setStatus('buying');
    const { data, error } = await supabase.rpc('purchase_ticket', {
      p_event_id: event.id,
      p_ticket_type: 'GA',
    });
    if (error || !data?.success) {
      setStatus('error');
      setErrorMsg(data?.error || error?.message || 'Error al procesar la compra');
    } else {
      setTicketNumber(data.ticket_number);
      setStatus('success');
      toast({ title: '¡Entrada confirmada!', description: `#${data.ticket_number} · ${event.title}` });
    }
  };

  const availableLeft = (event.tickets_total || 0) - (event.tickets_sold || 0);
  const isSoldOut = availableLeft <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,20,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: '#0F1322', border: '1px solid rgba(255,255,255,0.09)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Event image */}
        <div className="relative h-40 overflow-hidden">
          <img src={event.image_url || FALLBACK_IMG} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1322] via-black/40 to-transparent" />
          <button
            type="button" onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {status === 'success' ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle className="w-7 h-7" style={{ color: '#22c55e' }} />
              </div>
              <div>
                <p className="text-base font-black text-white">¡Entrada confirmada!</p>
                <p className="text-xs text-white/40 mt-1">{event.title}</p>
              </div>
              <div className="px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-mono text-white/50">#{ticketNumber}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                <Ticket className="w-4 h-4" />
                Ver en Ticket Vault
              </button>
            </div>
          ) : (
            /* ── Confirm / error state ── */
            <>
              <div>
                <p className="text-base font-black text-white leading-tight">{event.title}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/45">
                  {event.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  {event.venue && (
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {event.venue}
                    </span>
                  )}
                </div>
              </div>

              {/* Price + availability */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-bold text-white mt-0.5">General Admission</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/35 uppercase tracking-wider">Precio</p>
                  <p className="text-lg font-black mt-0.5" style={{ color: '#00CFFF' }}>{formatPrice(event.price)}</p>
                </div>
              </div>

              {availableLeft > 0 && availableLeft <= 20 && (
                <p className="text-xs font-bold text-center" style={{ color: '#F59E0B' }}>
                  ⚡ Solo quedan {availableLeft} entradas
                </p>
              )}

              {status === 'error' && (
                <div className="px-4 py-3 rounded-xl text-xs font-semibold text-center text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {errorMsg}
                </div>
              )}

              {!currentUser ? (
                <button type="button" onClick={handleConfirm}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background: '#00CFFF', color: '#080B14' }}>
                  Iniciar sesión para comprar
                </button>
              ) : isSoldOut ? (
                <button type="button" disabled
                  className="w-full py-3 rounded-xl text-sm font-black opacity-40 cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
                  Entradas agotadas
                </button>
              ) : (
                <button type="button" onClick={handleConfirm} disabled={status === 'buying'}
                  className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#00CFFF', color: '#080B14' }}>
                  {status === 'buying'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                    : <><Ticket className="w-4 h-4" /> Confirmar compra</>}
                </button>
              )}

              <p className="text-[11px] text-white/25 text-center">
                La entrada aparecerá en tu Ticket Vault con QR.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function EventTerminal() {
  const { toast } = useToast();
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [buyingEvent, setBuyingEvent] = useState(null);
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: events, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('events').select('*').order('date', { ascending: true }).limit(8),
    []
  );

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    toggleFav('event', id);
  };

  const handleBuyTicket = (event) => setBuyingEvent(event);

  if (loading) {
    return (
      <div className="p-5 space-y-6">
        <div className="rounded-2xl h-72 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-5">
        <EmptyState label="No hay eventos disponibles" icon={Calendar} />
      </div>
    );
  }

  const safeIndex = Math.min(featuredIndex, events.length - 1);
  const featured = events[safeIndex];

  return (
    <>
    <AnimatePresence>
      {buyingEvent && <BuyModal event={buyingEvent} onClose={() => setBuyingEvent(null)} />}
    </AnimatePresence>
    <div className="p-5 space-y-6">
      {/* Featured Event Banner */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
        <AnimatePresence mode="wait">
          <motion.img
            key={featured.id}
            src={featured.image_url || FALLBACK_IMG}
            alt={featured.title}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="relative z-10 p-8 flex flex-col justify-between" style={{ minHeight: 300 }}>
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#00CFFF' }}>
              Featured Event
            </span>
            <AnimatePresence mode="wait">
              <motion.h1
                key={featured.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-2 text-3xl md:text-4xl font-black text-white leading-tight max-w-lg"
              >
                {featured.title}
              </motion.h1>
            </AnimatePresence>
            {featured.description && (
              <p className="mt-2 text-sm text-white/60 max-w-sm line-clamp-2">{featured.description}</p>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3 mb-5 text-sm text-white/70">
              {featured.date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-white/40" />
                  {new Date(featured.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {featured.venue && (
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-white/40" />
                  {featured.venue}
                </span>
              )}
              {featured.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/40" />
                  {featured.city}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleBuyTicket(featured)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#080B14] transition-opacity hover:opacity-90"
                style={{ background: '#00CFFF' }}
              >
                Comprar Entrada
                <ArrowRight className="w-4 h-4" />
              </button>
              {featured.lineup && featured.lineup.length > 0 && (
                <button
                  type="button"
                  onClick={() => toast({ title: `Lineup: ${Array.isArray(featured.lineup) ? featured.lineup.join(', ') : featured.lineup}` })}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white border transition-colors hover:bg-white/10"
                  style={{ borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  <Users className="w-4 h-4" />
                  Ver Lineup
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-5">
              {events.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFeaturedIndex(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === safeIndex ? 20 : 7,
                    height: 7,
                    background: i === safeIndex ? '#00CFFF' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Próximos Eventos</h2>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold transition-colors hover:text-white"
            style={{ color: '#00CFFF' }}
          >
            Ver Todos
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-xl overflow-hidden border flex flex-col"
              style={{ background: 'rgba(15, 19, 34, 0.9)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={event.image_url || FALLBACK_IMG}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, event.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <Star
                    className="w-4 h-4 transition-colors"
                    style={{
                      fill: isFav('event', event.id) ? '#F59E0B' : 'none',
                      color: isFav('event', event.id) ? '#F59E0B' : 'rgba(255,255,255,0.6)',
                    }}
                  />
                </button>
              </div>

              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="text-sm font-bold text-white leading-tight">{event.title}</p>
                <div className="space-y-1 text-xs text-white/50">
                  {event.date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {(event.venue || event.city) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {[event.venue, event.city].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-sm font-bold" style={{ color: '#00CFFF' }}>
                    {formatPrice(event.price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleBuyTicket(event)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-[#080B14] transition-opacity hover:opacity-90"
                    style={{ background: '#00CFFF' }}
                  >
                    Comprar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
