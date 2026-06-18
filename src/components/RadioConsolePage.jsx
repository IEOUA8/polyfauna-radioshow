import React from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Radio, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import HoloSpectrum from '@/components/HoloSpectrum';

export default function RadioConsolePage({ isPlaying, setIsPlaying }) {
  const { toast } = useToast();
  const { song, isOnline, listeners, isLive, streamerName } = useNowPlaying();

  const { data: shows, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('radio_shows').select('*').order('schedule', { ascending: true }).limit(8),
    []
  );

  return (
    <div className="p-5 space-y-6">

      {/* ── Now Playing card ── */}
      <div className="glass-card holo-border rounded-2xl overflow-hidden p-6 relative">

        {/* Subtle background glow behind album art */}
        {song?.art && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${song.art})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.04,
              filter: 'blur(40px)',
              transform: 'scale(1.2)',
            }}
          />
        )}

        <div className="relative flex flex-col md:flex-row gap-6 items-start">
          {/* Album art */}
          <div className="relative shrink-0">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 0 24px rgba(0,207,255,0.15), 0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop'}
                alt="Now playing"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Corner accent */}
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full"
              style={{ background: 'linear-gradient(135deg, #00CFFF, #7B5CF0)', boxShadow: '0 0 8px rgba(0,207,255,0.7)' }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Live badge with pulse + shimmer */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="relative inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full overflow-hidden"
                style={{
                  background: isOnline ? 'rgba(255,112,67,0.12)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${isOnline ? 'rgba(255,112,67,0.40)' : 'rgba(255,255,255,0.1)'}`,
                  color: isOnline ? '#FF7043' : 'rgba(255,255,255,0.4)',
                }}
              >
                {/* Pulse dot */}
                {isOnline && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full"
                      style={{ background: '#FF7043' }}
                      animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#FF7043' }} />
                  </span>
                )}

                {/* Shimmer overlay */}
                {isOnline && (
                  <motion.span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
                    }}
                    animate={{ x: ['-150%', '150%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                  />
                )}

                {isLive ? `🎙 ${streamerName || 'En vivo'}` : isOnline ? 'Live Channel' : 'Offline'}
              </span>
            </div>

            <h1 className="text-2xl font-black text-white leading-tight truncate">
              {song?.title || 'PolyFauna Radio'}
            </h1>
            <p className="text-white/50 text-sm mt-1 truncate">
              {song?.artist || (isOnline ? 'Transmisión en vivo · 24/7' : 'Estación offline')}
            </p>

            {/* Holographic spectrum */}
            <div className="mt-5">
              <HoloSpectrum isPlaying={isPlaying} height={68} />
            </div>
          </div>

          {/* Play controls */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-white/40 text-xs">
              <Users className="w-3.5 h-3.5" />
              <span>{listeners > 0 ? `${listeners} oyente${listeners !== 1 ? 's' : ''}` : 'En vivo'}</span>
            </div>

            {/* Play button with pulse ring */}
            <div className="relative flex items-center justify-center">
              {isPlaying && (
                <>
                  <motion.span
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -8, border: '1.5px solid rgba(0,207,255,0.35)' }}
                    animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.span
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -4, border: '1px solid rgba(0,207,255,0.2)' }}
                    animate={{ scale: [1, 1.25], opacity: [0.4, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #00CFFF, #00AADD)',
                  boxShadow: isPlaying
                    ? '0 0 32px rgba(0,207,255,0.55), 0 4px 16px rgba(0,0,0,0.4)'
                    : '0 0 20px rgba(0,207,255,0.3), 0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                {isPlaying
                  ? <Pause className="w-5 h-5 fill-current" style={{ color: '#080B14' }} />
                  : <Play className="w-5 h-5 fill-current ml-0.5" style={{ color: '#080B14' }} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-5 relative">
          {['Abrir sala en vivo', 'Preguntar al host', 'Compartir', 'Guardar sesión'].map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => toast({ title: action, description: 'Próximamente disponible.' })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white/50 transition-all duration-200 hover:text-white"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,207,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(0,207,255,0.25)';
                e.currentTarget.style.color = '#00CFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* ── Upcoming Shows ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Próximos Programas</h2>

        {loading && <LoadingSkeleton rows={4} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && (!shows || shows.length === 0) && (
          <EmptyState label="No hay programas programados" icon={Radio} />
        )}

        {!loading && !error && shows && shows.length > 0 && (
          <div className="space-y-2">
            {shows.map((show, i) => (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer group"
                style={{ borderRadius: '12px' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,207,255,0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
              >
                <span className="text-sm font-mono font-bold shrink-0 w-14 truncate" style={{ color: '#00CFFF' }}>
                  {show.schedule || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-white transition-colors">{show.name}</p>
                  <p className="text-xs text-white/35 truncate">{show.dj}</p>
                </div>
                {show.genre && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                    style={{ background: 'rgba(0,207,255,0.08)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.15)' }}
                  >
                    {show.genre}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
