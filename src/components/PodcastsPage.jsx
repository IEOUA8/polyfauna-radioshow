import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Headphones, Heart, Play } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useLikes } from '@/hooks/useLikes';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop';

function secondsToMMSS(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Number(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PodcastsPage() {
  const { toast } = useToast();
  const [activeGenre, setActiveGenre] = useState('All');
  const [playing, setPlaying] = useState(null);
  const { isLiked, toggle: toggleLike } = useLikes();

  const { data: podcasts, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('podcasts').select('*, artists(name)').order('created_at', { ascending: false }),
    []
  );

  const genres = useMemo(() => {
    if (!podcasts) return ['All'];
    const unique = [...new Set(podcasts.map((p) => p.genre).filter(Boolean))];
    return ['All', ...unique];
  }, [podcasts]);

  const filtered = useMemo(() => {
    if (!podcasts) return [];
    return activeGenre === 'All' ? podcasts : podcasts.filter((p) => p.genre === activeGenre);
  }, [podcasts, activeGenre]);

  const handlePlay = (pod) => {
    if (pod.audio_url) {
      setPlaying(playing === pod.id ? null : pod.id);
    } else {
      toast({ title: pod.title, description: 'Audio no disponible aún.' });
    }
  };

  if (loading) {
    return (
      <div className="p-5 space-y-5">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-20 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (error) return <div className="p-5"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Podcasts</h1>
        <p className="text-sm text-white/40 mt-1">Sesiones y mixes curados de la comunidad.</p>
      </div>

      {/* Genre filter */}
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveGenre(g)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: activeGenre === g ? '#00CFFF' : 'rgba(255,255,255,0.05)',
              color: activeGenre === g ? '#080B14' : 'rgba(255,255,255,0.5)',
              border: activeGenre === g ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No hay podcasts disponibles" icon={Headphones} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((pod, i) => (
            <motion.div
              key={pod.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl overflow-hidden flex flex-col group"
              style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={pod.cover_url || FALLBACK_IMG}
                  alt={pod.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {pod.genre && (
                  <span
                    className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {pod.genre}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handlePlay(pod)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                    style={{
                      background: playing === pod.id ? 'rgba(0,207,255,0.9)' : '#00CFFF',
                      boxShadow: '0 0 30px rgba(0,207,255,0.5)',
                    }}
                  >
                    <Play className="w-6 h-6 ml-0.5 fill-current" style={{ color: '#080B14' }} />
                  </div>
                </button>
              </div>

              <div className="p-3 flex flex-col gap-1">
                <p className="text-sm font-bold text-white leading-tight">{pod.title}</p>
                <p className="text-xs text-white/40">{pod.artists?.name || 'PolyFauna'}</p>
                {pod.description && (
                  <p className="text-[11px] text-white/30 line-clamp-2 mt-0.5">{pod.description}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-white/30">
                    {new Date(pod.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2">
                    {pod.duration && (
                      <span className="text-[11px] text-white/30">{secondsToMMSS(pod.duration)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLike(pod.id)}
                      className="p-1 rounded-full transition-colors hover:bg-white/5"
                      title={isLiked(pod.id) ? 'Quitar like' : 'Me gusta'}
                    >
                      <Heart
                        className="w-3.5 h-3.5 transition-colors"
                        style={{
                          fill: isLiked(pod.id) ? '#F87171' : 'none',
                          color: isLiked(pod.id) ? '#F87171' : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
