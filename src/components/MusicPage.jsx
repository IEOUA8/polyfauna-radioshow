import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Disc3, Heart, Music, Play } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Number(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MusicPage({ setCurrentTrack, setIsPlaying, currentTrack }) {
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [activeGenre, setActiveGenre] = useState('All');
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: albums, loading, error, refetch } = useSupabaseQuery(
    () => supabase
      .from('albums')
      .select('*, artists(name, image_url)')
      .order('created_at', { ascending: false }),
    []
  );

  const { data: tracks, loading: tracksLoading } = useSupabaseQuery(
    () => selectedAlbum
      ? supabase
          .from('tracks')
          .select('*, artists(name)')
          .eq('album_id', selectedAlbum.id)
          .order('track_number', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    [selectedAlbum?.id]
  );

  const genres = useMemo(() => {
    if (!albums) return ['All'];
    const unique = [...new Set(albums.map((a) => a.genre).filter(Boolean))];
    return unique.length > 0 ? ['All', ...unique] : ['All'];
  }, [albums]);

  const filtered = useMemo(() => {
    if (!albums) return [];
    return activeGenre === 'All' ? albums : albums.filter((a) => a.genre === activeGenre);
  }, [albums, activeGenre]);

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'albums') return;
      const inList = (albums || []).find(a => a.id === id);
      if (inList) { setSelectedAlbum(inList); return; }
      const { data } = await supabase
        .from('albums').select('*, artists(name, image_url)').eq('id', id).single();
      if (data) setSelectedAlbum(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [albums]);

  useEffect(() => {
    const albumParam = new URLSearchParams(window.location.search).get('album');
    if (!albumParam || !albums?.length) return;
    const inList = albums.find(album => album.id === albumParam || album.slug === albumParam);
    if (inList) setSelectedAlbum(inList);
  }, [albums]);

  const handlePlayTrack = (track, album) => {
    if (!track.audio_url) return;
    setCurrentTrack({
      id: track.id,
      title: track.title,
      artist: track.artists?.name || album?.artists?.name || '',
      album: album?.title || '',
      art: album?.cover_url || FALLBACK_COVER,
      audio_url: track.audio_url,
      duration: track.duration,
    });
    setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className="p-5 space-y-5">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <CardSkeleton count={6} />
      </div>
    );
  }

  if (error) return <div className="p-5"><ErrorState message={error} onRetry={refetch} /></div>;

  /* ── Album detail view ── */
  if (selectedAlbum) {
    return (
      <div className="p-5 space-y-5">
        <button
          type="button"
          onClick={() => setSelectedAlbum(null)}
          className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a álbumes
        </button>

        <div
          className="flex gap-5 items-start p-5 rounded-2xl"
          style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <img
            src={selectedAlbum.cover_url || FALLBACK_COVER}
            alt={selectedAlbum.title}
            className="w-28 h-28 rounded-xl object-cover shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Álbum</p>
            <h1 className="text-xl font-black text-white leading-tight">{selectedAlbum.title}</h1>
            <p className="text-sm text-white/50 mt-0.5">
              {selectedAlbum.artists?.name || 'PolyFauna'}
              {selectedAlbum.release_year && (
                <span className="text-white/30"> · {selectedAlbum.release_year}</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {selectedAlbum.genre && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {selectedAlbum.genre}
                </span>
              )}
              <motion.button
                type="button"
                onClick={e => { e.stopPropagation(); toggleFav('album', selectedAlbum.id); }}
                whileTap={{ scale: 0.85 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: isFav('album', selectedAlbum.id) ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isFav('album', selectedAlbum.id) ? 'rgba(248,113,113,0.30)' : 'rgba(255,255,255,0.09)'}`,
                }}
              >
                <Heart className="w-3.5 h-3.5"
                  style={{ fill: isFav('album', selectedAlbum.id) ? '#F87171' : 'none', color: isFav('album', selectedAlbum.id) ? '#F87171' : 'rgba(255,255,255,0.40)' }} />
                <span className="text-[10px] font-bold" style={{ color: isFav('album', selectedAlbum.id) ? '#F87171' : 'rgba(255,255,255,0.35)' }}>
                  {isFav('album', selectedAlbum.id) ? 'Guardado' : 'Me encanta'}
                </span>
              </motion.button>
            </div>
            {selectedAlbum.description && (
              <p className="text-xs text-white/35 mt-2 line-clamp-3">{selectedAlbum.description}</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Tracks</h2>

          {tracksLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          )}

          {!tracksLoading && (!tracks || tracks.length === 0) && (
            <EmptyState label="No hay tracks en este álbum" icon={Music} />
          )}

          {!tracksLoading && tracks && tracks.length > 0 && (
            <div className="space-y-1">
              {tracks.map((track, i) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`group flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${track.audio_url ? 'cursor-pointer hover:bg-white/5' : 'opacity-50'}`}
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                    onClick={() => handlePlayTrack(track, selectedAlbum)}
                  >
                    <div className="w-6 shrink-0 flex items-center justify-center">
                      {isActive ? (
                        <div className="flex items-end gap-px h-4">
                          {[4, 7, 5].map((h, j) => (
                            <motion.div
                              key={j}
                              className="w-0.5 rounded-t-sm"
                              style={{ background: 'rgba(255,255,255,0.9)' }}
                              animate={{ height: [`${h * 2}px`, `${h * 3.5}px`] }}
                              transition={{ duration: 0.4 + j * 0.1, repeat: Infinity, repeatType: 'reverse' }}
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <span className="text-xs text-white/30 group-hover:hidden font-mono">
                            {String(track.track_number || i + 1).padStart(2, '0')}
                          </span>
                          {track.audio_url && (
                            <Play className="w-3.5 h-3.5 hidden group-hover:block fill-current text-white/80" />
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                        {track.title}
                      </p>
                      {track.artists?.name && (
                        <p className="text-xs text-white/40 truncate">{track.artists.name}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {track.duration && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(track.duration)}
                        </span>
                      )}
                      {!track.audio_url && (
                        <span className="text-[10px] text-white/20">Sin audio</span>
                      )}
                      <motion.button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleFav('track', track.id); }}
                        whileTap={{ scale: 0.80 }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        style={{ background: isFav('track', track.id) ? 'rgba(248,113,113,0.12)' : 'transparent' }}
                      >
                        <Heart className="w-3.5 h-3.5"
                          style={{ fill: isFav('track', track.id) ? '#F87171' : 'none', color: isFav('track', track.id) ? '#F87171' : 'rgba(255,255,255,0.35)' }} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Albums grid view ── */
  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white">Música</h1>
        <p className="text-sm text-white/40 mt-1">Álbumes y tracks de la comunidad PolyFauna.</p>
      </div>

      {genres.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <motion.button
              key={g}
              type="button"
              onClick={() => setActiveGenre(g)}
              whileHover={activeGenre !== g ? { scale: 1.08, y: -2 } : {}}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: activeGenre === g ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.05)',
                color: activeGenre === g ? '#080B14' : 'rgba(255,255,255,0.5)',
                border: activeGenre === g ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={activeGenre !== g ? (e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
              } : undefined}
              onMouseLeave={activeGenre !== g ? (e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              } : undefined}
            >
              {g}
            </motion.button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState label="No hay álbumes disponibles aún" icon={Disc3} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((album, i) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group cursor-pointer"
              onClick={() => setSelectedAlbum(album)}
            >
              <div
                className="relative aspect-square rounded-xl overflow-hidden mb-2"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <img
                  src={album.cover_url || FALLBACK_COVER}
                  alt={album.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-2xl"
                    style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 24px rgba(32,199,232,0.5)' }}
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" style={{ color: '#080B14' }} />
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold text-white truncate">{album.title}</p>
              <p className="text-xs text-white/40 truncate">{album.artists?.name || 'PolyFauna'}</p>
              {album.release_year && (
                <p className="text-[11px] text-white/25">{album.release_year}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
