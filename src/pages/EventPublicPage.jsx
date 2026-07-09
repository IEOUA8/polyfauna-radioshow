import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building, Calendar, CheckCircle, ExternalLink,
  Loader2, MapPin, Share2, Ticket, Users,
} from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { resolveLineupArtists } from '@/lib/artistIdentity';
import { trackUsageEvent } from '@/lib/telemetry';
import { getFunctionErrorMessage } from '@/lib/functionErrors';
import { claimFreeTicket } from '@/lib/freeTickets';
import { buildWompiCheckoutUrl } from '@/lib/wompiCheckout';
import { loadTicketIdentity } from '@/lib/ticketIdentity';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';
const useFallbackImage = (event) => {
  if (event.currentTarget.src !== FALLBACK) event.currentTarget.src = FALLBACK;
};

function formatPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return 'Gratis';
  return `$${value.toLocaleString('es-CO')} COP`;
}

function formatDateLong(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getTicketTypes(event) {
  const configured = Array.isArray(event?.ticket_types)
    ? event.ticket_types
      .filter(ticket => ticket?.name && !/^cortes[ií]a$/i.test(ticket.name) && Number(ticket?.capacity) > 0)
      .map(ticket => ({
        name: String(ticket.name),
        price: Math.max(0, Number(ticket.price) || 0),
        capacity: Math.max(1, Number(ticket.capacity) || 1),
      }))
    : [];
  if (configured.length > 0) return configured;
  return [{
    name: 'General',
    price: Math.max(0, Number(event?.price) || 0),
    capacity: Math.max(1, Number(event?.tickets_total) || 1),
  }];
}

export default function EventPublicPage() {
  const { eventId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [event,    setEvent]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status,   setStatus]   = useState('idle'); // idle | buying | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketNo, setTicketNo] = useState('');
  const [copied,   setCopied]   = useState(false);
  const [artists,  setArtists]  = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [identity, setIdentity] = useState({ fullName: '', documentNumber: '' });
  const [loadingIdentity, setLoadingIdentity] = useState(false);
  const ticketTypes = getTicketTypes(event);
  const selectedTicket = ticketTypes.find(ticket => ticket.name === selectedType) || ticketTypes[0];

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else {
          setEvent(data);
          setSelectedType(getTicketTypes(data)[0].name);
        }
        setLoading(false);
      });
  }, [eventId]);

  // Link de un co-promotor (?ref=...) — se guarda para que la compra, aunque
  // el comprador navegue dentro de la app antes de pagar, se atribuya a él.
  useEffect(() => {
    if (!eventId) return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem(`pf_seller_ref_${eventId}`, ref);
  }, [eventId]);

  useEffect(() => {
    supabase
      .from('artists')
      .select('id, name, slug')
      .then(({ data }) => setArtists(data || []));
  }, []);

  useEffect(() => {
    if (!currentUser?.id || selectedTicket.price !== 0) return;
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
  }, [currentUser?.id, selectedTicket.price]);

  useEffect(() => {
    if (!event?.id) return;
    trackUsageEvent('event_view', {
      event_id: event.id,
      status: event.status || null,
      price_tier: selectedTicket.price === 0 ? 'free' : 'paid',
    });
  }, [event?.id, event?.status, selectedTicket.price]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (_) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleBuy = async () => {
    trackUsageEvent('checkout_start', {
      event_id: event?.id || eventId,
      price_tier: selectedTicket.price === 0 ? 'free' : 'paid',
      quantity: 1,
      status: currentUser ? 'started' : 'auth_required',
    });

    if (!currentUser) {
      navigate(`/login?next=/e/${eventId}`);
      return;
    }

    const isFree = selectedTicket.price === 0;
    setStatus('buying');
    setErrorMsg('');

    if (isFree) {
      try {
        const data = await claimFreeTicket({
          eventId: event.id,
          ticketType: selectedTicket.name,
          userId: currentUser.id,
          fullName: identity.fullName,
          documentNumber: identity.documentNumber,
        });
        setTicketNo(data.ticket_number);
        setStatus('success');
        trackUsageEvent('ticket_claimed', {
          event_id: event.id,
          price_tier: 'free',
          quantity: 1,
        });
        if (data.email_warning) {
          setErrorMsg('El ticket está en tu Vault, pero el correo no pudo enviarse.');
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
      try {
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: {
            event_id: event.id, ticket_type: selectedTicket.name, quantity: 1, assigned_emails: [],
            seller_ref: sessionStorage.getItem(`pf_seller_ref_${event.id}`) || undefined,
          },
        });
        if (error) throw new Error(await getFunctionErrorMessage(error, 'Error al crear el pago'));
        if (!data?.reference) throw new Error('Respuesta inválida del servidor de pagos');

        const checkoutUrl = buildWompiCheckoutUrl(data, window.location.origin);

        trackUsageEvent('checkout_ready', {
          event_id: event.id,
          price_tier: 'paid',
          quantity: 1,
        });
        window.location.assign(checkoutUrl);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
        trackUsageEvent('checkout_error', {
          event_id: event.id,
          price_tier: 'paid',
          error_code: err?.name || 'create_payment_failed',
        });
      }
    }
  };

  const isFree    = event && selectedTicket.price === 0;
  const eventAvailable = event ? (event.tickets_total || 0) - (event.tickets_sold || 0) : 0;
  const available = event ? Math.min(eventAvailable, selectedTicket.capacity) : 0;
  const isSoldOut = event && available <= 0;
  const lineup = resolveLineupArtists(event?.lineup, artists);
  const canonicalUrl = `https://www.polyfauna.com/e/${eventId}`;
  const seoDescription = event?.description || `${event?.venue || 'Evento de música electrónica'} · ${formatDateLong(event?.date)}`;
  const seoImage = event?.image_url || 'https://www.polyfauna.com/icons/og-cover.png';

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(255,255,255,0.25)' }} />
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ background: '#080B14' }}>
        <p className="text-2xl font-black text-white">Evento no encontrado</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          El enlace puede haber caducado o el evento fue eliminado.
        </p>
        <Link to="/" className="mt-2 text-sm font-bold transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}>
          ← Ir a PolyFauna
        </Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{event.title} — Eventos POLYFAUNA</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:site_name"   content="POLYFAUNA" />
        <meta property="og:locale"      content="es_CO" />
        <meta property="og:title"       content={`${event.title} — POLYFAUNA`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image"       content={seoImage} />
        <meta property="og:image:alt"   content={`${event.title} en POLYFAUNA`} />
        <meta property="og:url"         content={canonicalUrl} />
        <meta property="og:type"        content="website" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${event.title} — POLYFAUNA`} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image"       content={seoImage} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: event.title,
          description: seoDescription,
          image: [seoImage],
          startDate: event.date,
          endDate: event.ends_at || undefined,
          eventStatus: event.status === 'cancelled'
            ? 'https://schema.org/EventCancelled'
            : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: event.venue || event.city || 'POLYFAUNA',
            address: {
              '@type': 'PostalAddress',
              addressLocality: event.city || 'Bogotá',
              addressCountry: 'CO',
            },
          },
          offers: {
            '@type': 'Offer',
            url: canonicalUrl,
            price: Number(event.price || 0),
            priceCurrency: 'COP',
            availability: isSoldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
          },
          organizer: { '@type': 'Organization', name: 'POLYFAUNA', url: 'https://www.polyfauna.com/' },
          performer: lineup.map(item => ({
            '@type': 'MusicGroup',
            name: item.artist?.name || item.name,
            url: item.artist?.slug ? `https://www.polyfauna.com/profiles/${item.artist.slug}` : undefined,
          })),
          url: canonicalUrl,
        })}</script>
      </Helmet>

      <div className="min-h-screen" style={{ background: '#080B14' }}>

        {/* Hero */}
        <div className="relative w-full overflow-hidden" style={{ height: 'clamp(260px, 50vw, 420px)' }}>
          <img
            src={event.image_url || FALLBACK}
            onError={useFallbackImage}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080B14] via-black/50 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-5 sm:pt-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-bold transition-colors"
              style={{ color: 'rgba(255,255,255,0.70)', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              PolyFauna
            </Link>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl transition-all"
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: copied ? '#22c55e' : 'rgba(255,255,255,0.85)',
              }}
            >
              <Share2 className="w-4 h-4" />
              {copied ? '¡Copiado!' : 'Compartir'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-xl mx-auto px-5 pb-24 -mt-10 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* Title */}
            <div>
              {event.category && (
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {event.category}
                </p>
              )}
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {event.title}
              </h1>
            </div>

            {/* Info tiles */}
            <div className="grid grid-cols-2 gap-3">
              {event.date && (
                <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Calendar className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }} />
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Fecha</p>
                    <p className="text-sm font-bold text-white leading-snug capitalize">{formatDateLong(event.date)}</p>
                    {event.ends_at && (
                      <p className="text-[11px] text-white/40 mt-1">
                        Hasta {new Date(event.ends_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {(event.venue || event.city) && (
                <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Building className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }} />
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Lugar</p>
                    <p className="text-sm font-bold text-white leading-snug">
                      {[event.venue, event.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Lineup */}
            {lineup.length > 0 && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Lineup
                </p>
                <div className="flex flex-wrap gap-2">
                  {lineup.map(({ name, artist }, i) => {
                    const label = artist?.name || name;
                    const className = "text-sm font-bold px-3 py-1.5 rounded-xl transition-colors";
                    const style = {
                      background: artist ? 'rgba(32,199,232,0.10)' : 'rgba(255,255,255,0.06)',
                      color: artist ? 'rgba(125,231,255,0.92)' : 'rgba(255,255,255,0.85)',
                      border: artist ? '1px solid rgba(32,199,232,0.22)' : '1px solid rgba(255,255,255,0.10)',
                    };

                    return artist?.slug ? (
                      <Link key={`${artist.id}-${i}`} to={`/profiles/${artist.slug}`} className={className} style={style}>
                        {label}
                      </Link>
                    ) : (
                      <span key={`${name}-${i}`} className={className} style={style}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2">Sobre el evento</p>
                <p className="text-sm text-white/70 leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Buy CTA */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(11,16,15,0.95)', border: '1px solid rgba(255,255,255,0.09)' }}>

              <div className="space-y-2">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Elige tu entrada</p>
                <div className="grid grid-cols-2 gap-2">
                  {ticketTypes.map(ticket => {
                    const selected = ticket.name === selectedTicket.name;
                    return (
                      <button
                        key={ticket.name}
                        type="button"
                        onClick={() => {
                          setSelectedType(ticket.name);
                          setErrorMsg('');
                        }}
                        disabled={status === 'buying'}
                        className="rounded-xl p-3 text-left transition-all"
                        style={{
                          background: selected ? 'rgba(32,199,232,0.13)' : 'rgba(255,255,255,0.045)',
                          border: selected ? '1px solid rgba(32,199,232,0.48)' : '1px solid rgba(255,255,255,0.1)',
                          color: selected ? '#A5F1FF' : 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <span className="block text-xs font-black">{ticket.name}</span>
                        <span className="block text-base font-black mt-1">{formatPrice(ticket.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {available > 0 && available <= 20 && (
                <p className="text-xs font-bold text-center" style={{ color: '#F59E0B' }}>
                  ⚡ Solo quedan {available} entradas
                </p>
              )}

              {/* Success state */}
              {status === 'success' ? (
                <div className="flex flex-col items-center gap-3 py-3 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                    <CheckCircle className="w-6 h-6" style={{ color: '#22c55e' }} />
                  </div>
                  <p className="text-base font-black text-white">¡Entrada confirmada!</p>
                  <p className="text-xs font-mono text-white/40">#{ticketNo}</p>
                  <Link
                    to="/"
                    className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2"
                    style={{ background: '#22c55e', color: '#fff' }}
                  >
                    <Ticket className="w-4 h-4" />
                    Ver en Ticket Vault
                  </Link>
                </div>
              ) : (
                <>
                  {status === 'error' && (
                    <p className="text-xs text-red-300 text-center px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      {errorMsg}
                    </p>
                  )}

                  {/* Auth gate */}
                  {!currentUser ? (
                    <div className="space-y-2.5">
                      <Link
                        to={`/signup?next=/e/${eventId}`}
                        className="w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                        style={{ background: 'rgba(255,255,255,0.95)', color: '#080B14' }}
                      >
                        <Ticket className="w-4 h-4" />
                        {isFree ? 'Crear cuenta y obtener entrada' : 'Crear cuenta y comprar entrada'}
                      </Link>
                      <p className="text-[11px] text-white/35 text-center">
                        ¿Ya tienes cuenta?{' '}
                        <Link
                          to={`/login?next=/e/${eventId}`}
                          className="font-bold underline underline-offset-2 transition-colors hover:text-white/70"
                          style={{ color: 'rgba(255,255,255,0.50)' }}
                        >
                          Inicia sesión
                        </Link>
                      </p>
                    </div>
                  ) : isSoldOut ? (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-xl text-sm font-black opacity-40 cursor-not-allowed"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}
                    >
                      Entradas agotadas
                    </button>
                  ) : (
                    <>
                      {isFree && (
                        <div className="space-y-3 rounded-xl p-4 mb-3 text-left"
                          style={{ background: 'rgba(34,197,94,0.055)', border: '1px solid rgba(34,197,94,0.16)' }}>
                          <div>
                            <p className="text-xs font-black text-white">Identificación del asistente</p>
                            <p className="text-[10px] leading-relaxed mt-1 text-white/35">
                              Quedará asociada al ticket para validar tu identidad con la cédula física en la entrada.
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
                                disabled={status === 'buying' || loadingIdentity}
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
                                disabled={status === 'buying' || loadingIdentity}
                                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 disabled:opacity-50"
                                style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      <motion.button
                        type="button"
                        onClick={handleBuy}
                        disabled={status === 'buying' || (isFree && (loadingIdentity || !identity.fullName.trim() || !identity.documentNumber.trim()))}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-cta w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                      >
                        {status === 'buying'
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                          : isFree
                            ? <><Ticket className="w-4 h-4" /> {selectedTicket.name === 'Cortesía' ? 'Confirmar cortesía' : 'Obtener entrada gratis'}</>
                            : <><ExternalLink className="w-4 h-4" /> Pagar con Wompi</>
                        }
                      </motion.button>
                      <p className="text-[11px] text-white/25 text-center">
                        {isFree ? 'La entrada aparecerá en tu Ticket Vault.' : 'Pago seguro · PSE · Nequi · Tarjeta'}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Open in OS */}
            <div className="text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-bold transition-colors"
                style={{ color: 'rgba(255,255,255,0.28)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.28)'; }}
              >
                Abrir en PolyFauna
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
