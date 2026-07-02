import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building, Calendar, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, Loader2, MapPin, Search, Share2, Star, Ticket, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import { resolveLineupArtists } from '@/lib/artistIdentity';
import { trackUsageEvent } from '@/lib/telemetry';
import { getFunctionErrorMessage } from '@/lib/functionErrors';
import { claimFreeTicket } from '@/lib/freeTickets';
import { loadTicketIdentity } from '@/lib/ticketIdentity';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';
const useFallbackImage = (event) => {
  if (event.currentTarget.src !== FALLBACK_IMG) event.currentTarget.src = FALLBACK_IMG;
};

function formatPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return 'Gratis';
  return `$${value.toLocaleString('es-CO')}`;
}

function formatDateLong(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getTicketTypes(event) {
  if (Array.isArray(event?.ticket_types) && event.ticket_types.length > 0) {
    const configured = event.ticket_types
      .filter(ticket => ticket?.name && !/^cortes[ií]a$/i.test(ticket.name) && Number(ticket?.capacity) > 0)
      .map(ticket => ({
        name: String(ticket.name),
        price: Math.max(0, Number(ticket.price) || 0),
        capacity: Math.max(1, Number(ticket.capacity) || 1),
      }));
    if (configured.length > 0) return configured;
  }
  return [{
    name: 'General',
    price: Math.max(0, Number(event?.price) || 0),
    capacity: Math.max(1, Number(event?.tickets_total) || 1),
  }];
}

/* ── Modal de compra ── */
function BuyModal({ event, onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [wompiRef, setWompiRef] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [assignedEmails, setAssignedEmails] = useState({ 2: '', 3: '', 4: '' });
  const [identity, setIdentity] = useState({ fullName: '', documentNumber: '' });
  const [loadingIdentity, setLoadingIdentity] = useState(false);
  const ticketTypes = useMemo(() => getTicketTypes(event), [event]);
  const [selectedType, setSelectedType] = useState(() => ticketTypes[0]?.name || 'General');
  const selectedTicket = ticketTypes.find(ticket => ticket.name === selectedType) || ticketTypes[0];

  const isFree = selectedTicket.price === 0;
  const eventAvailable = (event.tickets_total || 0) - (event.tickets_sold || 0);
  const availableLeft = Math.min(eventAvailable, selectedTicket.capacity);
  const isSoldOut = availableLeft <= 0;
  const isBusy = status === 'buying' || status === 'processing';
  const totalPrice = selectedTicket.price * quantity;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id || !isFree) return;
    let active = true;
    setLoadingIdentity(true);
    loadTicketIdentity(currentUser.id)
      .then(data => {
        if (active) setIdentity(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingIdentity(false);
      });
    return () => { active = false; };
  }, [currentUser?.id, isFree]);

  useEffect(() => {
    trackUsageEvent('event_view', {
      event_id: event.id,
      status: event.status || null,
      price_tier: isFree ? 'free' : 'paid',
    });
  }, [event.id, event.status, isFree]);

  const handleConfirm = async () => {
    trackUsageEvent('checkout_start', {
      event_id: event.id,
      price_tier: isFree ? 'free' : 'paid',
      quantity,
      status: currentUser ? 'started' : 'auth_required',
    });

    if (!currentUser) {
      onClose();
      navigate('/login');
      return;
    }

    if (isFree) {
      // Evento gratuito o cortesía: emisión directa y correo, sin Wompi.
      setStatus('buying');
      try {
        const data = await claimFreeTicket({
          eventId: event.id,
          ticketType: selectedTicket.name,
          userId: currentUser.id,
          fullName: identity.fullName,
          documentNumber: identity.documentNumber,
        });
        setTicketNumber(data.ticket_number);
        setStatus('success');
        trackUsageEvent('ticket_claimed', {
          event_id: event.id,
          price_tier: 'free',
          quantity: 1,
        });
        toast({
          title: selectedTicket.name === 'Cortesía' ? '¡Cortesía confirmada!' : '¡Entrada confirmada!',
          description: `#${data.ticket_number} · ${event.title}`,
        });
        if (data.email_warning) {
          toast({
            title: 'Ticket creado',
            description: 'Está en tu Ticket Vault, aunque el correo no pudo enviarse.',
          });
        }
      } catch (error) {
        setStatus('error');
        setErrorMsg(error?.message || 'Error al procesar la entrada');
        trackUsageEvent('checkout_error', {
          event_id: event.id,
          price_tier: 'free',
          error_code: error?.code || 'purchase_ticket_failed',
        });
      }
    } else {
      // Evento de pago: flujo Wompi
      setStatus('processing');
      try {
        const emails = Array.from({ length: quantity - 1 }, (_, i) => assignedEmails[i + 2] || null);
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: {
            event_id: event.id, ticket_type: selectedTicket.name, quantity, assigned_emails: emails,
            seller_ref: sessionStorage.getItem(`pf_seller_ref_${event.id}`) || undefined,
          },
        });
        if (error) throw new Error(await getFunctionErrorMessage(error, 'Error al crear el pago'));
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
        trackUsageEvent('checkout_ready', {
          event_id: event.id,
          price_tier: 'paid',
          quantity,
        });
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Error al iniciar el pago');
        trackUsageEvent('checkout_error', {
          event_id: event.id,
          price_tier: 'paid',
          quantity,
          error_code: err?.name || 'create_payment_failed',
        });
      }
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: 'rgba(4,7,7,0.82)',
        backdropFilter: 'blur(18px) saturate(120%)',
        WebkitBackdropFilter: 'blur(18px) saturate(120%)',
      }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Comprar entrada para ${event.title}`}
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-md max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)] rounded-3xl flex flex-col"
        style={{
          background: 'rgba(8,14,9,0.98)',
          border: '1px solid rgba(255,255,255,0.09)',
          overflow: 'hidden',
          boxShadow: '0 30px 100px rgba(0,0,0,0.72)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-36 shrink-0 overflow-hidden">
          <img src={event.image_url || FALLBACK_IMG} onError={useFallbackImage} alt={event.title} loading="lazy" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080E09] via-black/40 to-transparent" />
          <button
            type="button" onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-6 pt-4 space-y-4 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.16) transparent' }}>
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

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  Elige tu entrada
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ticketTypes.map(ticket => {
                    const selected = ticket.name === selectedTicket.name;
                    return (
                      <button
                        key={ticket.name}
                        type="button"
                        onClick={() => {
                          setSelectedType(ticket.name);
                          setQuantity(1);
                          setErrorMsg('');
                        }}
                        disabled={isBusy}
                        className="rounded-xl p-3 text-left transition-all"
                        style={{
                          background: selected ? 'rgba(255,138,31,0.14)' : 'rgba(255,255,255,0.045)',
                          border: selected ? '1px solid rgba(255,138,31,0.5)' : '1px solid rgba(255,255,255,0.1)',
                          color: selected ? '#FFD4A8' : 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <span className="block text-xs font-black">{ticket.name}</span>
                        <span className="block text-sm font-black mt-1">{formatPrice(ticket.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {availableLeft > 0 && availableLeft <= 20 && (
                <p className="text-xs font-bold text-center" style={{ color: '#F59E0B' }}>
                  ⚡ Solo quedan {availableLeft} entradas
                </p>
              )}

              {/* ── Identidad para entrada gratuita ── */}
              {!isSoldOut && currentUser && isFree && (
                <div className="space-y-3 rounded-xl p-4"
                  style={{ background: 'rgba(34,197,94,0.055)', border: '1px solid rgba(34,197,94,0.16)' }}>
                  <div>
                    <p className="text-xs font-black text-white">Identificación del asistente</p>
                    <p className="text-[10px] leading-relaxed mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Estos datos quedarán asociados al ticket y se compararán con tu cédula física en la entrada.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <label className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Nombre completo</span>
                      <input
                        type="text"
                        autoComplete="name"
                        value={identity.fullName}
                        onChange={e => setIdentity(current => ({ ...current, fullName: e.target.value }))}
                        placeholder="Nombre y apellido"
                        disabled={isBusy || loadingIdentity}
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Número de cédula</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={identity.documentNumber}
                        onChange={e => setIdentity(current => ({ ...current, documentNumber: e.target.value.replace(/\D/g, '') }))}
                        placeholder="Ej. 1023456789"
                        disabled={isBusy || loadingIdentity}
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
                      />
                    </label>
                  </div>
                </div>
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
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>{quantity} tickets {selectedTicket.name} × {formatPrice(selectedTicket.price)}</span>
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
                <button type="button" onClick={handleConfirm}
                  disabled={isBusy || (isFree && (loadingIdentity || !identity.fullName.trim() || !identity.documentNumber.trim()))}
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
    </div>,
    document.body
  );
}

/* ── Event grid card (memoizado: la carga automática del banner destacado cada
   8s no debe re-renderizar toda la grilla de eventos) ── */
const EventCard = React.memo(function EventCard({ event, index, isFavorite, onToggleFavorite, onSelect, onBuy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl overflow-hidden border flex flex-col cursor-pointer group"
      style={{ background: 'rgba(11, 16, 15, 0.90)', borderColor: 'rgba(255,255,255,0.07)' }}
      onClick={() => onSelect(event)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,138,31,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={event.image_url || FALLBACK_IMG}
          onError={useFallbackImage}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button
          type="button"
          onClick={(e) => onToggleFavorite(e, event.id)}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <Star
            className="w-4 h-4 transition-colors"
            style={{
              fill: isFavorite ? '#F59E0B' : 'none',
              color: isFavorite ? '#F59E0B' : 'rgba(255,255,255,0.6)',
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
            onClick={(e) => { e.stopPropagation(); onBuy(event); }}
            className="btn-cta text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            Comprar
          </button>
        </div>
      </div>
    </motion.div>
  );
});

/* ── Event detail page ── */
function EventDetail({ event, onBack, onBuy, isFav, toggleFav, artists = [], setCurrentSection }) {
  const [linkCopied, setLinkCopied] = React.useState(false);
  const lineup = resolveLineupArtists(event.lineup, artists);

  const openArtist = (artist) => {
    if (!artist?.id) return;
    setCurrentSection?.('artists');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pf:open-item', { detail: { type: 'artists', id: artist.id } }));
    }, 60);
  };

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
          onError={useFallbackImage}
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
            {lineup.map(({ name, artist }, i) => {
              const label = artist?.name || name;
              const className = "text-xs font-bold px-3 py-1.5 rounded-lg transition-colors";
              const style = {
                background: artist ? 'rgba(32,199,232,0.10)' : 'rgba(255,255,255,0.06)',
                color: artist ? 'rgba(125,231,255,0.92)' : 'rgba(255,255,255,0.85)',
                border: artist ? '1px solid rgba(32,199,232,0.22)' : '1px solid rgba(255,255,255,0.1)',
              };

              return artist ? (
                <button key={`${artist.id}-${i}`} type="button" onClick={() => openArtist(artist)} className={className} style={style}>
                  {label}
                </button>
              ) : (
                <span key={`${name}-${i}`} className={className} style={style}>
                  {label}
                </span>
              );
            })}
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

export default function EventTerminal({ setCurrentSection }) {
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
  const { data: artists } = useSupabaseQuery(
    () => supabase.from('artists').select('id, name, slug'),
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

  useEffect(() => {
    const eventParam = new URLSearchParams(window.location.search).get('event');
    if (!eventParam || !events?.length) return;
    const inList = events.find(ev => ev.id === eventParam || ev.slug === eventParam);
    if (inList) setSelectedEvent(inList);
  }, [events]);

  const toggleFavorite = useCallback((e, id) => {
    e.stopPropagation();
    toggleFav('event', id);
  }, [toggleFav]);

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
    }, 8000);
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
            artists={artists || []}
            setCurrentSection={setCurrentSection}
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
                  onError={useFallbackImage}
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
                  <EventCard
                    key={event.id}
                    event={event}
                    index={i}
                    isFavorite={isFav('event', event.id)}
                    onToggleFavorite={toggleFavorite}
                    onSelect={setSelectedEvent}
                    onBuy={setBuyingEvent}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
