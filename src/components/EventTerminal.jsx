import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building, Calendar, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, MapPin, Search, Share2, Star, Ticket, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

// Offset del player según pantalla: móvil (< lg) tiene BottomNav (56px) + player a bottom-14 (56px) + h-[82px] = 138px
// Escritorio: player a bottom-4 (16px) + h-[82px] = 98px
function usePlayerOffset() {
  const [offset, setOffset] = useState(() => window.innerWidth < 1024 ? 138 : 98);
  useEffect(() => {
    const update = () => setOffset(window.innerWidth < 1024 ? 138 : 98);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return offset;
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';

function formatPrice(price) {
  if (!price && price !== 0) return 'Gratis';
  return `$${Number(price).toLocaleString('es-CO')}`;
}

function formatDateLong(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Modal de compra ── */
function BuyModal({ event, onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const playerBottom = usePlayerOffset();
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [wompiRef, setWompiRef] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [assignedEmails, setAssignedEmails] = useState({ 2: '', 3: '', 4: '' });

  const isFree = !event.price || event.price === 0;
  const availableLeft = (event.tickets_total || 0) - (event.tickets_sold || 0);
  const isSoldOut = availableLeft <= 0;
  const isBusy = status === 'buying' || status === 'processing';
  const totalPrice = (event.price || 0) * quantity;

  const handleConfirm = async () => {
    if (!currentUser) {
      onClose();
      navigate('/login');
      return;
    }

    if (isFree) {
      // Evento gratuito: compra directa vía RPC
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
    } else {
      // Evento de pago: flujo Wompi
      setStatus('processing');
      try {
        const emails = Array.from({ length: quantity - 1 }, (_, i) => assignedEmails[i + 2] || null);
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: { event_id: event.id, ticket_type: 'GA', quantity, assigned_emails: emails },
        });
        if (error) throw new Error(error.message || 'Error al crear el pago');
        if (!data?.reference) throw new Error('Respuesta inválida del servidor de pagos');

        const origin = window.location.origin;
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        const redirectParam = isLocal ? '' : `&redirect-url=${encodeURIComponent(origin + '/')}`;

        const checkoutUrl =
          `https://checkout.wompi.co/p/?` +
          `public-key=${data.public_key}` +
          `&currency=COP` +
          `&amount-in-cents=${data.amount_in_cents}` +
          `&reference=${data.reference}` +
          `&signature:integrity=${data.signature}` +
          redirectParam;

        setWompiRef(checkoutUrl);
        setStatus('pending');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Error al iniciar el pago');
      }
    }
  };

  return (
    /* Overlay — se detiene en el borde superior del player (responsive) */
    <div
      className="fixed inset-x-0 top-0 z-[60] flex items-end justify-center px-4 pb-3"
      style={{ bottom: playerBottom, background: 'rgba(4,7,7,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl flex flex-col"
        style={{
          background: 'rgba(8,14,9,0.98)',
          border: '1px solid rgba(255,255,255,0.09)',
          maxHeight: `calc(100vh - ${playerBottom}px - 16px)`,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-36 shrink-0 overflow-hidden">
          <img src={event.image_url || FALLBACK_IMG} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080E09] via-black/40 to-transparent" />
          <button
            type="button" onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'none' }}>
          {/* ── Éxito gratuito ── */}
          {status === 'success' && (
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
              <button type="button" onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: '#22c55e', color: '#fff' }}>
                <Ticket className="w-4 h-4" />
                Ver en Ticket Vault
              </button>
            </div>
          )}

          {/* ── Pago Wompi: URL lista para navegar ── */}
          {status === 'pending' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,138,31,0.12)' }}>
                  <ExternalLink className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.85)' }} />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Checkout listo</p>
                  <p className="text-xs text-white/40">Haz clic para ir a Wompi a completar el pago</p>
                </div>
              </div>

              <button type="button"
                onClick={() => { window.location.href = wompiRef; }}
                className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.95)', color: '#06090A' }}>
                <ExternalLink className="w-4 h-4" />
                Ir a Wompi
              </button>

              <button type="button" onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                Cancelar
              </button>
            </div>
          )}

          {/* ── Formulario de compra ── */}
          {(status === 'idle' || status === 'buying' || status === 'processing' || status === 'error') && (
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

              <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-bold text-white mt-0.5">General Admission</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/35 uppercase tracking-wider">Precio</p>
                  <p className="text-lg font-black mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{formatPrice(event.price)}</p>
                </div>
              </div>

              {availableLeft > 0 && availableLeft <= 20 && (
                <p className="text-xs font-bold text-center" style={{ color: '#F59E0B' }}>
                  ⚡ Solo quedan {availableLeft} entradas
                </p>
              )}

              {/* ── Selector de cantidad ── */}
              {!isSoldOut && currentUser && !isFree && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <Users className="w-3 h-3" /> Cantidad <span style={{ color: 'rgba(255,255,255,0.20)' }}>· máx. 4</span>
                  </p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(n => {
                      const unavailable = n > Math.min(4, availableLeft);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => !unavailable && setQuantity(n)}
                          disabled={unavailable || isBusy}
                          className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
                          style={quantity === n
                            ? { background: 'linear-gradient(135deg, #FF8A1F 0%, #F59E0B 100%)', color: '#06090A' }
                            : unavailable
                              ? { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.15)', cursor: 'not-allowed' }
                              : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.50)' }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Asignación de tickets por correo ── */}
              {quantity > 1 && currentUser && !isFree && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Asignar tickets
                  </p>
                  {/* Ticket 1 — comprador */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[10px] font-black text-white/25 shrink-0 w-12">Ticket 1</span>
                    <span className="text-xs text-white/35 truncate flex-1">{currentUser.email}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.30)' }}>TÚ</span>
                  </div>
                  {/* Tickets extra */}
                  {Array.from({ length: quantity - 1 }, (_, i) => i + 2).map(idx => (
                    <div key={idx} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="text-[10px] font-black text-white/25 shrink-0 w-12">Ticket {idx}</span>
                      <input
                        type="email"
                        placeholder="correo@email.com  (opcional)"
                        value={assignedEmails[idx]}
                        onChange={e => setAssignedEmails(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="flex-1 bg-transparent text-xs outline-none"
                        style={{ color: 'rgba(255,255,255,0.70)' }}
                      />
                    </div>
                  ))}
                  <p className="text-[10px] leading-relaxed px-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Si el correo ya tiene cuenta en PolyFauna el ticket aparece directo en su Vault. De lo contrario, queda en el tuyo para que lo compartas.
                  </p>
                </div>
              )}

              {/* ── Total cuando hay más de 1 ticket ── */}
              {quantity > 1 && !isFree && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,138,31,0.06)', border: '1px solid rgba(255,138,31,0.14)' }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>{quantity} tickets × {formatPrice(event.price)}</span>
                  <span className="text-base font-black" style={{ color: 'rgba(255,255,255,0.90)' }}>{formatPrice(totalPrice)}</span>
                </div>
              )}

              {status === 'error' && (
                <div className="px-4 py-3 rounded-xl text-xs font-semibold text-center text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {errorMsg}
                </div>
              )}

              {!currentUser ? (
                <button type="button" onClick={handleConfirm}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#06090A' }}>
                  Iniciar sesión para comprar
                </button>
              ) : isSoldOut ? (
                <button type="button" disabled
                  className="w-full py-3 rounded-xl text-sm font-black opacity-40 cursor-not-allowed"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
                  Entradas agotadas
                </button>
              ) : (
                <button type="button" onClick={handleConfirm} disabled={isBusy}
                  className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#06090A' }}>
                  {isBusy
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {status === 'processing' ? 'Preparando pago…' : 'Procesando…'}</>
                    : isFree
                      ? <><Ticket className="w-4 h-4" /> Confirmar (Gratis)</>
                      : <><ExternalLink className="w-4 h-4" /> Pagar {quantity > 1 ? formatPrice(totalPrice) : 'con Wompi'}</>}
                </button>
              )}

              <p className="text-[11px] text-white/25 text-center">
                {isFree ? 'La entrada aparecerá en tu Ticket Vault con QR.' : 'Pago seguro · PSE · Nequi · Tarjeta'}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Event detail page ── */
function EventDetail({ event, onBack, onBuy, isFav, toggleFav }) {
  const [linkCopied, setLinkCopied] = React.useState(false);
  const lineup = event.lineup
    ? (Array.isArray(event.lineup) ? event.lineup : String(event.lineup).split(','))
    : [];

  const handleShare = async () => {
    const url = `${window.location.origin}/e/${event.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: event.title, url }); return; }
      await navigator.clipboard.writeText(url);
    } catch (_) {
      await navigator.clipboard.writeText(url);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  return (
    <motion.div
      key="event-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="p-5 space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Eventos
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 280 }}>
        <img
          src={event.image_url || FALLBACK_IMG}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

        {/* Favorite button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFav('event', event.id); }}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Star
            className="w-4 h-4"
            style={{
              fill: isFav('event', event.id) ? '#F59E0B' : 'none',
              color: isFav('event', event.id) ? '#F59E0B' : 'rgba(255,255,255,0.7)',
            }}
          />
        </button>

        <div className="relative z-10 p-6 flex flex-col justify-end" style={{ minHeight: 280 }}>
          {event.category && (
            <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {event.category}
            </span>
          )}
          <h1 className="text-3xl font-black text-white leading-tight">{event.title}</h1>
        </div>
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {event.date && (
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Calendar className="w-4 h-4 mx-auto mb-1.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Fecha</p>
            <p className="text-xs font-bold text-white mt-0.5">
              {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
        {event.venue && (
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Building className="w-4 h-4 mx-auto mb-1.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Venue</p>
            <p className="text-xs font-bold text-white mt-0.5 truncate">{event.venue}</p>
          </div>
        )}
        {event.city && (
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <MapPin className="w-4 h-4 mx-auto mb-1.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Ciudad</p>
            <p className="text-xs font-bold text-white mt-0.5">{event.city}</p>
          </div>
        )}
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Ticket className="w-4 h-4 mx-auto mb-1.5" style={{ color: 'rgba(255,255,255,0.85)' }} />
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Precio</p>
          <p className="text-sm font-black mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>{formatPrice(event.price)}</p>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Sobre el evento</h2>
          <p className="text-sm text-white/70 leading-relaxed">{event.description}</p>
        </div>
      )}

      {/* Lineup */}
      {lineup.length > 0 && (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Lineup
          </h2>
          <div className="flex flex-wrap gap-2">
            {lineup.map((artist, i) => (
              <span
                key={i}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {artist.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buy CTA + Share */}
      <div className="flex gap-3">
        <motion.button
          type="button"
          onClick={onBuy}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-cta flex-1 py-4 rounded-2xl text-base font-black flex items-center justify-center gap-3 transition-all duration-200"
        >
          <Ticket className="w-5 h-5" />
          Comprar Ticket
        </motion.button>
        <motion.button
          type="button"
          onClick={handleShare}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="py-4 px-4 rounded-2xl font-black flex items-center justify-center gap-2 text-sm transition-all"
          style={{
            background: linkCopied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${linkCopied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.10)'}`,
            color: linkCopied ? '#22c55e' : 'rgba(255,255,255,0.60)',
            minWidth: '3.5rem',
          }}
          title="Compartir enlace"
        >
          <Share2 className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function EventTerminal() {
  const { toast } = useToast();
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [buyingEvent, setBuyingEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [search, setSearch] = useState('');
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: events, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('events').select('*').order('date', { ascending: true }),
    []
  );

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.city?.toLowerCase().includes(q) ||
      e.venue?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  }, [events, search]);

  // Eventos que aparecen en el banner: los marcados como featured ordenados por featured_order.
  // Si ninguno tiene featured=true, muestra todos (comportamiento por defecto).
  const bannerEvents = useMemo(() => {
    if (!events) return [];
    const featured = events
      .filter(e => e.featured)
      .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999));
    return featured.length > 0 ? featured : events;
  }, [events]);

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'events') return;
      const inList = (events || []).find(ev => ev.id === id);
      if (inList) { setSelectedEvent(inList); return; }
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      if (data) setSelectedEvent(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [events]);

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    toggleFav('event', id);
  };

  const handlePrevFeatured = (e) => {
    e.stopPropagation();
    setFeaturedIndex(i => (i - 1 + bannerEvents.length) % bannerEvents.length);
  };

  const handleNextFeatured = (e) => {
    e.stopPropagation();
    setFeaturedIndex(i => (i + 1) % bannerEvents.length);
  };

  useEffect(() => {
    if (bannerEvents.length <= 1) return;
    const timer = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % bannerEvents.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [bannerEvents.length]);

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

  const safeIndex = Math.min(featuredIndex, bannerEvents.length - 1);
  const featured = bannerEvents[safeIndex];

  return (
    <>
      <AnimatePresence>
        {buyingEvent && <BuyModal event={buyingEvent} onClose={() => setBuyingEvent(null)} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedEvent ? (
          <EventDetail
            key="detail"
            event={selectedEvent}
            onBack={() => setSelectedEvent(null)}
            onBuy={() => setBuyingEvent(selectedEvent)}
            isFav={isFav}
            toggleFav={toggleFav}
          />
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-5 space-y-6"
          >
            {/* Featured Event Banner */}
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group"
              style={{ minHeight: 300 }}
              onClick={() => setSelectedEvent(featured)}
            >
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Prev / Next arrows */}
              {bannerEvents.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Evento anterior"
                    onClick={handlePrevFeatured}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center
                      opacity-80 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                    style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    type="button"
                    aria-label="Evento siguiente"
                    onClick={handleNextFeatured}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center
                      opacity-80 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                    style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}

              {/* Counter top-right */}
              {bannerEvents.length > 1 && (
                <div
                  className="absolute top-4 right-4 z-20 text-[11px] font-bold tabular-nums px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.50)', color: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {safeIndex + 1} / {bannerEvents.length}
                </div>
              )}

              <div className="relative z-10 p-6 md:p-8 flex flex-col justify-between" style={{ minHeight: 300 }}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    Evento Destacado
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
                      onClick={(e) => { e.stopPropagation(); setBuyingEvent(featured); }}
                      className="btn-cta flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                    >
                      <Ticket className="w-4 h-4" />
                      Comprar Ticket
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedEvent(featured); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white border transition-colors hover:bg-white/10"
                      style={{ borderColor: 'rgba(255,255,255,0.3)' }}
                    >
                      Ver detalles
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dots indicator */}
                  {bannerEvents.length > 1 && (
                    <div className="flex items-center gap-2 mt-5">
                      {bannerEvents.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Ir al evento ${i + 1}`}
                          onClick={(e) => { e.stopPropagation(); setFeaturedIndex(i); }}
                          className="rounded-full transition-all duration-300"
                          style={{
                            width: i === safeIndex ? 22 : 8,
                            height: 8,
                            background: i === safeIndex ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.28)',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar auto-rotate */}
              {bannerEvents.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] z-20" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    key={safeIndex}
                    className="h-full"
                    style={{ background: 'rgba(255,255,255,0.55)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 5.5, ease: 'linear' }}
                  />
                </div>
              )}
            </div>

            {/* Upcoming Events Grid */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-bold text-white">
                  {search.trim() ? `${filteredEvents.length} resultado${filteredEvents.length !== 1 ? 's' : ''}` : 'Próximos Eventos'}
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.30)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, ciudad…"
                    className="pl-9 pr-8 h-9 text-sm rounded-xl outline-none w-full sm:w-56"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.80)' }}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredEvents.length === 0 && search.trim() && (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Sin resultados para <span className="text-white/55">"{search}"</span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {filteredEvents.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl overflow-hidden border flex flex-col cursor-pointer group"
                    style={{ background: 'rgba(11, 16, 15, 0.90)', borderColor: 'rgba(255,255,255,0.07)' }}
                    onClick={() => setSelectedEvent(event)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,138,31,0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={event.image_url || FALLBACK_IMG}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
                        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {formatPrice(event.price)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBuyingEvent(event); }}
                          className="btn-cta text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200"
                        >
                          Comprar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
