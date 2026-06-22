import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building, Calendar, CheckCircle, ExternalLink,
  Loader2, MapPin, Share2, Ticket, Users,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';

function formatPrice(price) {
  if (!price && price !== 0) return 'Gratis';
  return `$${Number(price).toLocaleString('es-CO')} COP`;
}

function formatDateLong(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
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

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setEvent(data);
        setLoading(false);
      });
  }, [eventId]);

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
    if (!currentUser) {
      navigate(`/login?next=/e/${eventId}`);
      return;
    }

    const isFree = !event.price || event.price === 0;
    setStatus('buying');
    setErrorMsg('');

    if (isFree) {
      const { data, error } = await supabase.rpc('purchase_ticket', {
        p_event_id: event.id,
        p_ticket_type: 'GA',
      });
      if (error || !data?.success) {
        setStatus('error');
        setErrorMsg(data?.error || error?.message || 'Error al procesar la compra');
      } else {
        setTicketNo(data.ticket_number);
        setStatus('success');
      }
    } else {
      try {
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: { event_id: event.id, ticket_type: 'GA', quantity: 1, assigned_emails: [] },
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

        window.location.href = checkoutUrl;
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message);
      }
    }
  };

  const shareUrl  = `${window.location.origin}/e/${eventId}`;
  const isFree    = event && (!event.price || event.price === 0);
  const available = event ? (event.tickets_total || 0) - (event.tickets_sold || 0) : 0;
  const isSoldOut = event && available <= 0;
  const lineup    = event?.lineup
    ? (Array.isArray(event.lineup) ? event.lineup : String(event.lineup).split(','))
    : [];

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
        <title>{event.title} — PolyFauna</title>
        <meta name="description" content={event.description || `${event.venue || ''} · ${formatDateLong(event.date)}`} />
        <meta property="og:title"       content={event.title} />
        <meta property="og:description" content={event.description || `${event.venue || ''} · ${formatDateLong(event.date)}`} />
        <meta property="og:image"       content={event.image_url || FALLBACK} />
        <meta property="og:url"         content={shareUrl} />
        <meta property="og:type"        content="website" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={event.title} />
        <meta name="twitter:description" content={event.description || ''} />
        <meta name="twitter:image"       content={event.image_url || FALLBACK} />
      </Helmet>

      <div className="min-h-screen" style={{ background: '#080B14' }}>

        {/* Hero */}
        <div className="relative w-full overflow-hidden" style={{ height: 'clamp(260px, 50vw, 420px)' }}>
          <img
            src={event.image_url || FALLBACK}
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
                  {lineup.map((a, i) => (
                    <span
                      key={i}
                      className="text-sm font-bold px-3 py-1.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      {a.trim()}
                    </span>
                  ))}
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

              {/* Price row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-white/40 uppercase tracking-wider">Precio por entrada</p>
                  <p className="text-2xl font-black mt-0.5" style={{ color: 'rgba(255,255,255,0.90)' }}>
                    {formatPrice(event.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider">Tipo</p>
                  <p className="text-sm font-bold text-white mt-0.5">General Admission</p>
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
                        Crear cuenta y comprar entrada
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
                      <motion.button
                        type="button"
                        onClick={handleBuy}
                        disabled={status === 'buying'}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-cta w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                      >
                        {status === 'buying'
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                          : isFree
                            ? <><Ticket className="w-4 h-4" /> Confirmar (Gratis)</>
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
