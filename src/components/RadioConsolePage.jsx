import React from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Radio, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const BARS = [68, 42, 82, 56, 92, 48, 74, 64, 88, 52, 76, 60, 84, 44, 70, 58, 90, 46];

export default function RadioConsolePage({ isPlaying, setIsPlaying }) {
  const { toast } = useToast();

  const { data: shows, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('radio_shows').select('*').order('schedule', { ascending: true }).limit(8),
    []
  );

  return (
    <div className="p-5 space-y-6">
      {/* Now Playing */}
      <div
        className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div
            className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00CFFF22, #7B5CF022)' }}
          >
            <img
              src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop"
              alt="Now playing"
              className="w-full h-full object-cover opacity-60"
            />
            <Radio className="w-8 h-8 text-white absolute" style={{ filter: 'drop-shadow(0 0 8px #00CFFF)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ background: '#00CFFF', color: '#080B14' }}
              >
                Live Channel
              </motion.span>
            </div>
            <h1 className="text-2xl font-black text-white">PolyFauna Radio</h1>
            <p className="text-white/50 text-sm mt-1">Transmisión en vivo · 24/7</p>

            <div className="flex items-end gap-px h-10 mt-4">
              {BARS.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{ background: isPlaying ? '#00CFFF' : 'rgba(0,207,255,0.3)', opacity: 0.65 }}
                  animate={isPlaying ? { height: [`${h * 0.3}%`, `${h}%`, `${h * 0.5}%`] } : { height: '15%' }}
                  transition={{ duration: 0.7 + (i % 5) * 0.1, repeat: Infinity, repeatType: 'reverse', delay: i * 0.04 }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-white/50 text-xs">
              <Users className="w-3.5 h-3.5" />
              <span>En vivo</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-lg"
              style={{ background: '#00CFFF', boxShadow: '0 0 24px rgba(0,207,255,0.35)' }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" style={{ color: '#080B14' }} />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" style={{ color: '#080B14' }} />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {['Abrir sala en vivo', 'Preguntar al host', 'Compartir', 'Guardar sesión'].map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => toast({ title: action, description: 'Próximamente disponible.' })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white/60 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Shows */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">Próximos Programas</h2>

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
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-white/5 cursor-pointer"
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span
                  className="text-sm font-mono font-bold shrink-0 w-14 truncate"
                  style={{ color: '#00CFFF' }}
                >
                  {show.schedule || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{show.name}</p>
                  <p className="text-xs text-white/40 truncate">{show.dj}</p>
                </div>
                {show.genre && (
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded shrink-0"
                    style={{ background: 'rgba(0,207,255,0.1)', color: '#00CFFF' }}
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
