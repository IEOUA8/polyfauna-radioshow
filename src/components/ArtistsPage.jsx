import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarDays, Disc3, ExternalLink, Globe, Headphones, Heart, Instagram, Link2, Music, Twitter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { lineupIncludesArtist } from '@/lib/artistIdentity';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

const SOCIAL_DETAIL = [
  { key: 'instagram', icon: Instagram, label: 'Instagram', color: '#E1306C', build: (h) => `https://instagram.com/${h}` },
  { key: 'twitter',   icon: Twitter,   label: 'Twitter / X', color: '#94A3B8', build: (h) => `https://x.com/${h}` },
  { key: 'bandcamp',  icon: Music,     label: 'Bandcamp',  color: '#1DA0C3', build: (h) => h.includes('.') ? `https://${h}` : `https://${h}.bandcamp.com` },
  { key: 'soundcloud',icon: Music,     label: 'SoundCloud',color: '#FF5500', build: (h) => `https://soundcloud.com/${h}` },
  { key: 'website',   icon: Globe,     label: 'Website',   color: '#C8C8C8', build: (h) => h.startsWith('http') ? h : `https://${h}` },
];

function SocialButton({ href, icon: Icon, label, color }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Icon className="w-3.5 h-3.5" />
    </a>
  );
}

function ArtistDetail({ artist, onBack, isFav, toggleFav, setCurrentSection }) {
  const { toast } = useToast();
  const links = typeof artist.social_links === 'object' && artist.social_links ? artist.social_links : {};
  const genres = artist.genres
    ? (Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
    : [];
  const favoured = isFav('artist', artist.id);
  const img = artist.image_url || FALLBACK;

  const profileUrl = artist.slug
    ? `${window.location.origin}/?section=artists&artist=${artist.slug}`
    : `${window.location.origin}/?section=artists`;

  const { data: albums } = useSupabaseQuery(
    () => supabase
      .from('albums')
      .select('id, title, cover_url, genre, release_year, description, artists(name)')
      .eq('artist_id', artist.id)
      .order('created_at', { ascending: false })
      .limit(6),
    [artist.id]
  );

  const { data: tracks } = useSupabaseQuery(
    async () => {
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, duration, genre, album_id, albums(id, title, cover_url), artists(name)')
        .eq('artist_id', artist.id)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error || !data?.length) return { data: data || [], error };

      const ids = data.map(track => track.id);
      const favs = ids.length
        ? await supabase
            .from('user_favorites')
            .select('item_id')
            .eq('item_type', 'track')
            .in('item_id', ids)
        : { data: [], error: null };

      const counts = (favs.data || []).reduce((acc, row) => {
        acc[row.item_id] = (acc[row.item_id] || 0) + 1;
        return acc;
      }, {});

      return {
        data: data
          .map(track => ({ ...track, favorite_count: counts[track.id] || 0 }))
          .sort((a, b) => (b.favorite_count - a.favorite_count) || String(a.title).localeCompare(String(b.title)))
          .slice(0, 5),
        error: favs.error,
      };
    },
    [artist.id]
  );

  const { data: podcasts } = useSupabaseQuery(
    () => supabase
      .from('podcasts')
      .select('id, title, audio_url, cover_url, duration, genre, artists(name)')
      .eq('artist_id', artist.id)
      .order('created_at', { ascending: false })
      .limit(6),
    [artist.id]
  );

  const { data: events } = useSupabaseQuery(
    () => supabase
      .from('events')
      .select('id, title, date, venue, city, image_url, lineup')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(40),
    [artist.id]
  );

  const artistEvents = useMemo(
    () => (events || []).filter(event => lineupIncludesArtist(event.lineup, artist)).slice(0, 4),
    [events, artist]
  );

  const handleShare = async () => {
    const text = `${artist.name} en POLYFAUNA`;
    if (navigator.share) {
      await navigator.share({ title: text, url: profileUrl });
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: 'Enlace copiado', description: text });
    }
  };

  const openAlbum = (album) => {
    if (!album?.id) return;
    setCurrentSection?.('music');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pf:open-item', { detail: { type: 'albums', id: album.id } }));
    }, 60);
  };

  const openPodcast = (podcast) => {
    if (!podcast?.id) return;
    setCurrentSection?.('podcasts');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pf:open-item', { detail: { type: 'podcasts', id: podcast.id } }));
    }, 60);
  };

  const openEvent = (event) => {
    setCurrentSection?.('events');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pf:open-item', { detail: { type: 'events', id: event.id } }));
    }, 60);
  };

  return (
    <motion.div
      key="artist-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-0"
    >
      {/* Back */}
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-white/45 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Artists & Labels
        </button>
      </div>

      {/* Cover banner — outer wrapper sin overflow:hidden para no clipear el row */}
      <div className="relative" style={{ height: 170 }}>
        {/* Inner clip: solo contiene la imagen blureada */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={img}
            alt=""
            aria-hidden
            className="w-full h-full object-cover scale-110"
            style={{ filter: 'blur(6px) brightness(0.38) saturate(0.7)' }}
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,9,10,0.08) 0%, rgba(5,9,10,0.50) 65%, #05090A 100%)',
          }} />
        </div>
        {/* Action buttons: share + favorite */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={handleShare}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <Link2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.65)' }} />
          </button>
          <button
            type="button"
            onClick={() => toggleFav('artist', artist.id)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <Heart
              className="w-4 h-4 transition-colors"
              style={{ fill: favoured ? '#F87171' : 'none', color: favoured ? '#F87171' : 'rgba(255,255,255,0.65)' }}
            />
          </button>
        </div>
      </div>

      {/* Avatar (left) + Info (right) — items-end: ambos alineados abajo */}
      <div className="px-5 flex items-end gap-4 relative" style={{ marginTop: -64, zIndex: 2 }}>
        {/* Avatar circle grande */}
        <div
          className="rounded-full overflow-hidden shrink-0"
          style={{
            width: 120,
            height: 120,
            border: '3px solid #05090A',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.13), 0 10px 32px rgba(0,0,0,0.75)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <img src={img} alt={artist.name} className="w-full h-full object-cover" />
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0 pb-1">
          {artist.type && (
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              {artist.type}
            </span>
          )}
          <h1 className="text-xl font-black text-white leading-tight">{artist.name}</h1>
          {artist.city && (
            <p className="text-xs text-white/40 mt-0.5">{artist.city}</p>
          )}
          {/* Social icons inline */}
          {SOCIAL_DETAIL.some(({ key }) => links[key]) && (
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {SOCIAL_DETAIL.map(({ key, icon, label, color, build }) =>
                links[key] ? (
                  <SocialButton
                    key={key}
                    href={build(links[key])}
                    icon={icon}
                    label={label}
                    color={color}
                  />
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio + Genres */}
      <div className="px-5 pt-5 pb-6 space-y-4">
        {artist.bio && (
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Biografía</h2>
            <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
          </div>
        )}
        {genres.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Géneros</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {g.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {(albums?.length > 0 || tracks?.length > 0 || podcasts?.length > 0 || artistEvents.length > 0) && (
          <div className="space-y-5">
            {tracks?.length > 0 && (
              <section className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3 flex items-center gap-2">
                  <Music className="w-3.5 h-3.5" />
                  Top tracks
                </h2>
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => openAlbum(track.albums)}
                      disabled={!track.albums?.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors disabled:opacity-60 disabled:cursor-default"
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                        {track.albums?.cover_url
                          ? <img src={track.albums.cover_url} alt="" className="w-full h-full object-cover" />
                          : <Music className="w-4 h-4 text-white/45" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{track.title}</p>
                        <p className="text-[11px] text-white/35 truncate">{track.albums?.title || track.genre || artist.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {track.favorite_count > 0 && (
                          <p className="text-[10px] font-bold text-white/35">{track.favorite_count} like{track.favorite_count === 1 ? '' : 's'}</p>
                        )}
                        <p className="text-[10px] text-white/22">Ver álbum</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {albums?.length > 0 && (
              <section className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3 flex items-center gap-2">
                  <Disc3 className="w-3.5 h-3.5" />
                  Música
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      onClick={() => openAlbum(album)}
                      className="text-left rounded-xl overflow-hidden transition-colors"
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="aspect-square bg-white/5 overflow-hidden">
                        <img src={album.cover_url || img} alt={album.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-bold text-white truncate">{album.title}</p>
                        <p className="text-[11px] text-white/35 truncate">{[album.genre, album.release_year].filter(Boolean).join(' · ') || artist.name}</p>
                        <p className="text-[10px] text-white/22 mt-1">Ver detalle</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {podcasts?.length > 0 && (
              <section className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3 flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5" />
                  Podcasts / Mixes
                </h2>
                <div className="space-y-2">
                  {podcasts.map((podcast) => (
                    <button
                      key={podcast.id}
                      type="button"
                      onClick={() => openPodcast(podcast)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        <img src={podcast.cover_url || img} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{podcast.title}</p>
                        <p className="text-[11px] text-white/35 truncate">{podcast.genre || 'Mix POLYFAUNA'}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/25 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {artistEvents.length > 0 && (
              <section className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Eventos vinculados
                </h2>
                <div className="space-y-2">
                  {artistEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEvent(event)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        <img src={event.image_url || img} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{event.title}</p>
                        <p className="text-[11px] text-white/35 truncate">
                          {[event.venue || event.city, event.date && new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-white/25 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ArtistCard({ artist, index, isFav, toggleFav, onClick }) {
  const links = typeof artist.social_links === 'object' ? artist.social_links : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={artist.image_url || FALLBACK}
          alt={artist.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {artist.type && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {artist.type}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFav('artist', artist.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          title={isFav('artist', artist.id) ? 'Quitar del Organismo' : 'Agregar al Organismo'}
        >
          <Heart
            className="w-3.5 h-3.5 transition-colors"
            style={{
              fill: isFav('artist', artist.id) ? '#F87171' : 'none',
              color: isFav('artist', artist.id) ? '#F87171' : 'rgba(255,255,255,0.7)',
            }}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-sm font-black text-white">{artist.name}</p>
        {artist.bio && (
          <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{artist.bio}</p>
        )}
        {artist.genres && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
              .slice(0, 3)
              .map((g) => (
                <span
                  key={g}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
                >
                  {g.trim()}
                </span>
              ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-auto pt-2">
          <SocialButton href={links.instagram} icon={Instagram} label="Instagram" color="#E1306C" />
          <SocialButton href={links.twitter} icon={Twitter} label="Twitter" color="#94A3B8" />
          <SocialButton href={links.website} icon={Globe} label="Website" color="#C8C8C8" />
          {(!links.instagram && !links.twitter && !links.website) && (
            <span className="text-[10px] text-white/20">Sin redes</span>
          )}
          <span className="ml-auto text-[10px] text-white/20 group-hover:text-white/40 transition-colors">Ver más →</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function ArtistsPage({ setCurrentSection }) {
  const [search, setSearch] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: artists, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('artists').select('*').order('name'),
    []
  );

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'artists') return;
      const inList = (artists || []).find(a => a.id === id);
      if (inList) { setSelectedArtist(inList); return; }
      const { data } = await supabase.from('artists').select('*').eq('id', id).single();
      if (data) setSelectedArtist(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [artists]);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('artist');
    if (!slug || !artists?.length) return;
    const inList = artists.find(a => a.slug === slug);
    if (inList) setSelectedArtist(inList);
  }, [artists]);

  const filtered = useMemo(() => {
    if (!artists) return [];
    const q = search.toLowerCase();
    return q ? artists.filter((a) => a.name?.toLowerCase().includes(q) || a.bio?.toLowerCase().includes(q)) : artists;
  }, [artists, search]);

  return (
    <AnimatePresence mode="wait">
      {selectedArtist ? (
        <ArtistDetail
          key="detail"
          artist={selectedArtist}
          onBack={() => setSelectedArtist(null)}
          isFav={isFav}
          toggleFav={toggleFav}
          setCurrentSection={setCurrentSection}
        />
      ) : (
        <motion.div
          key="grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-white">Artists & Labels</h1>
              <p className="text-sm text-white/40 mt-1">Los artistas y sellos que dan vida a PolyFauna.</p>
            </div>
            <input
              type="text"
              placeholder="Buscar artista…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg outline-none w-full sm:w-64"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
            />
          </div>

          {loading && <CardSkeleton count={6} />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState label={search ? 'Sin resultados para tu búsqueda' : 'No hay artistas aún'} icon={Disc3} />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((artist, i) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  index={i}
                  isFav={isFav}
                  toggleFav={toggleFav}
                  onClick={() => setSelectedArtist(artist)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
