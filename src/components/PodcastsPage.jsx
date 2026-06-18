import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Headphones, Heart, Pause, Play, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import UploadPodcastModal from '@/components/UploadPodcastModal';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop';

// Genre color map based on the electronic music genre wheel
const GENRE_COLORS = {
  // House — cyan
  'house': '#00CFFF', 'tech house': '#00CFFF', 'deep house': '#00B4DD',
  'acid house': '#00AADD', 'funky house': '#33DDFF', 'micro house': '#00BBEE',
  'french house': '#0088BB', 'electro house': '#00CCDD', 'disco house': '#00BBEE',
  // Disco — pink
  'disco': '#E879A0', 'nu disco': '#FF69B4', 'italo disco': '#FF85C0',
  'space disco': '#CC5599', 'electro clash': '#FF5599', 'disco classic': '#DD6699',
  // Trance — green
  'trance': '#4CAF50', 'goa trance': '#66BB6A', 'classic trance': '#43A047',
  'acid trance': '#2E7D32', 'psy trance': '#81C784', 'tech trance': '#388E3C',
  'uplifting': '#A5D6A7', 'progressive trance': '#4CAF50',
  // Techno — orange
  'techno': '#FF8C00', 'detroit techno': '#FF7F00', 'minimal': '#E67E00',
  'electro': '#FFA000', 'dub techno': '#FF9500', 'ambient techno': '#FFB300',
  'industrial techno': '#E65100', 'minimal techno': '#E67E00',
  // Hardcore — magenta
  'hardcore': '#FF1493', 'gabber': '#FF0080', 'hardstyle': '#FF69B4',
  'breakbeat hardcore': '#FF1177', 'frenchcore': '#FF33AA', 'speedcore': '#DD0077',
  'hardtek': '#FF2299', 'industrial hardcore': '#AA0055',
  // Industrial — yellow
  'industrial': '#FFD700', 'industrial dance': '#FFC107', 'ebm': '#FF8F00',
  'aggrotech': '#FFA000', 'power electronics': '#FFCA28', 'new beat': '#FFD54F',
  // Downtempo / Ambient — purple
  'downtempo': '#9C27B0', 'ambient': '#7B5CF0', 'chillout': '#8E24AA',
  'chillwave': '#AB47BC', 'psybient': '#6A1B9A', 'idm': '#4527A0',
  'drone': '#5E35B1', 'dark ambient': '#4527A0',
  // Hip Hop — red
  'hip hop': '#F44336', 'trap': '#FF5722', 'east coast rap': '#E53935',
  'trip hop': '#EF5350', 'jazz hop': '#FF6F00', 'turntablism': '#E53935',
  'instrumental hip hop': '#FF7043',
  // Garage — teal
  'garage': '#00BCD4', 'uk garage': '#00ACC1', '2-step': '#0097A7',
  'grime': '#00838F', 'uk bass': '#006064', 'future garage': '#00B4CC',
  // Breaks — light blue
  'breaks': '#4FC3F7', 'breakbeat': '#29B6F6', 'big beat': '#0288D1',
  'liquid funk': '#039BE5', 'drum and bass': '#0277BD', 'dnb': '#0277BD',
  'jungle': '#0288D1',
  // Funk / Soul
  'funk': '#FF9800', 'soul': '#FF8F00', 'afrobeat': '#FF6D00',
  // Experimental
  'experimental': '#7C4DFF', 'noise': '#6200EA', 'glitch': '#AA00FF',
  // Mixed / Other
  'mixed': '#94A3B8', 'various': '#94A3B8',
};

function getGenreColor(genre) {
  if (!genre) return '#00CFFF';
  return GENRE_COLORS[genre.toLowerCase()] || '#00CFFF';
}

function secondsToMMSS(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Number(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CREATOR_ROLES = ['artist', 'club', 'promoter', 'admin'];

export default function PodcastsPage({ setCurrentTrack, setIsPlaying, currentTrack, isPlaying }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [activeGenre, setActiveGenre] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const { isLiked, toggle: toggleLike } = useLikes();
  const isCreator = currentUser && CREATOR_ROLES.includes(profile?.role);

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
    if (!pod.audio_url) {
      toast({ title: pod.title, description: 'Audio no disponible aún.' });
      return;
    }
    const isActive = currentTrack?.id === pod.id;
    if (isActive) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack({
        id: pod.id,
        title: pod.title,
        artist: pod.artists?.name || 'PolyFauna',
        album: pod.genre || 'Podcast',
        art: pod.cover_url || FALLBACK_IMG,
        audio_url: pod.audio_url,
        duration: pod.duration,
      });
      setIsPlaying(true);
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Podcasts</h1>
          <p className="text-sm text-white/40 mt-1">Sesiones y mixes curados de la comunidad.</p>
        </div>
        {isCreator && (
          <button type="button" onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 shrink-0"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#7B5CF0)', color: '#fff', boxShadow: '0 0 16px rgba(167,139,250,0.3)' }}>
            <Plus className="w-3.5 h-3.5" />
            Subir
          </button>
        )}
      </div>

      {/* Genre filter */}
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => {
          const gColor = g === 'All' ? '#00CFFF' : getGenreColor(g);
          const isActive = activeGenre === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGenre(g)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200"
              style={{
                background: isActive ? `${gColor}22` : 'rgba(255,255,255,0.04)',
                color: isActive ? gColor : 'rgba(255,255,255,0.45)',
                border: isActive ? `1px solid ${gColor}55` : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isActive ? `0 0 12px ${gColor}25` : 'none',
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="No hay podcasts disponibles" icon={Headphones} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((pod, i) => {
            const isActive = currentTrack?.id === pod.id;
            const isCurrentlyPlaying = isActive && isPlaying;
            const gColor = getGenreColor(pod.genre);

            return (
              <motion.div
                key={pod.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl overflow-hidden flex flex-col group"
                style={{
                  background: 'rgba(15, 19, 34, 0.9)',
                  border: `1px solid ${isActive ? `${gColor}40` : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isActive ? `0 0 20px ${gColor}18` : 'none',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={pod.cover_url || FALLBACK_IMG}
                    alt={pod.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                  {pod.genre && (
                    <span
                      className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        background: `${gColor}22`,
                        color: gColor,
                        border: `1px solid ${gColor}40`,
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {pod.genre}
                    </span>
                  )}

                  {/* Playing indicator badge */}
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="absolute top-2 right-2 text-[9px] font-black uppercase px-2 py-0.5 rounded"
                      style={{ background: gColor, color: '#080B14' }}
                    >
                      {isCurrentlyPlaying ? 'ON AIR' : 'PAUSED'}
                    </motion.span>
                  )}

                  {/* Hover play/pause overlay */}
                  <button
                    type="button"
                    onClick={() => handlePlay(pod)}
                    className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                      style={{ background: gColor, boxShadow: `0 0 30px ${gColor}80` }}
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-6 h-6 fill-current" style={{ color: '#080B14' }} />
                      ) : (
                        <Play className="w-6 h-6 ml-0.5 fill-current" style={{ color: '#080B14' }} />
                      )}
                    </div>
                  </button>

                  {/* Animated bars when playing */}
                  {isCurrentlyPlaying && (
                    <div className="absolute bottom-3 left-3 flex items-end gap-px h-5">
                      {[5, 9, 6, 8, 4].map((h, j) => (
                        <motion.div
                          key={j}
                          className="w-0.5 rounded-t-sm"
                          style={{ background: gColor }}
                          animate={{ height: [`${h * 1.5}px`, `${h * 3}px`] }}
                          transition={{ duration: 0.4 + j * 0.08, repeat: Infinity, repeatType: 'reverse' }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-1">
                  <p className="text-sm font-bold leading-tight" style={{ color: isActive ? gColor : 'white' }}>
                    {pod.title}
                  </p>
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
                        onClick={() => {
                          toggleLike(pod.id);
                          if (!isLiked(pod.id)) {
                            toast({
                              title: pod.title,
                              description: `Guardado en tu biblioteca`,
                              style: { borderLeft: `3px solid ${gColor}` },
                            });
                          }
                        }}
                        className="p-1 rounded-full transition-colors hover:bg-white/5"
                        title={isLiked(pod.id) ? 'Quitar like' : 'Me gusta'}
                      >
                        <motion.div
                          animate={isLiked(pod.id) ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Heart
                            className="w-3.5 h-3.5 transition-colors"
                            style={{
                              fill: isLiked(pod.id) ? gColor : 'none',
                              color: isLiked(pod.id) ? gColor : 'rgba(255,255,255,0.3)',
                            }}
                          />
                        </motion.div>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <UploadPodcastModal
            onClose={() => setShowUpload(false)}
            onSuccess={() => { setShowUpload(false); refetch(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
