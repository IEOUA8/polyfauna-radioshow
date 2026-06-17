import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Building, Calendar, ChevronRight, MapPin, Star, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop';

function formatPrice(price) {
  if (!price && price !== 0) return 'Free';
  return `$${Number(price).toFixed(2)}`;
}

export default function EventTerminal() {
  const { toast } = useToast();
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: events, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('events').select('*').order('date', { ascending: true }).limit(8),
    []
  );

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    toggleFav('event', id);
  };

  const handleBuyTicket = (event) => {
    toast({ title: `Comprando entrada para ${event.title}`, description: 'Abriendo vendedor de tickets...' });
  };

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
  );
}
