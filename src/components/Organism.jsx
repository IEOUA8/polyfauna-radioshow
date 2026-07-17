import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, CalendarDays, Disc3, Dna, Headphones, Heart, Loader2, Music2,
  Pause, Play, Shuffle, Trash2, UserRound,
} from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, ErrorState, LoadingSkeleton, LoginRequired, PulseLoader } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';
const ACCENT = '#B8CFA6';

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Math.floor(Number(secs) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function shuffleList(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function toPlayerTrack(item) {
  if (item.kind === 'podcast') {
    return {
      kind: 'podcast',
      id: item.id,
      title: item.title,
      artist: item.artist || 'PolyFauna',
      album: item.genre || 'Podcast',
      art: item.image || FALLBACK,
      audio_url: item.audio_url,
      duration: item.duration,
      organism: true,
    };
  }

  return {
    kind: 'track',
    id: item.id,
    title: item.title,
    artist: item.artist || 'PolyFauna',
    album: item.album || item.genre || 'Música',
    art: item.image || FALLBACK,
    audio_url: item.audio_url,
    duration: item.duration,
    organism: true,
  };
}

function OrganismPulse({ isPlaying }) {
  return (
    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
      <motion.div
        className="absolute inset-2 rounded-full"
        style={{ border: '1px solid rgba(184,207,166,0.22)' }}
        animate={isPlaying ? { scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] } : { scale: 1, opacity: 0.55 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-6 rounded-full"
        style={{ border: '1px solid rgba(255,255,255,0.16)' }}
        animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(184,207,166,0.10)', border: '1px solid rgba(184,207,166,0.24)' }}
      >
        <Dna className="w-7 h-7" style={{ color: ACCENT }} />
      </div>
    </div>
  );
}

function TypeBadge({ kind }) {
  const meta = {
    podcast: { label: 'Podcast', icon: Headphones },
    track: { label: 'Track', icon: Music2 },
    album: { label: 'Album', icon: Disc3 },
  }[kind] || { label: 'Audio', icon: Music2 };
  const Icon = meta.icon;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md shrink-0"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.48)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function OrganismRow({ item, index, isActive, isPlaying, onPlay, onRemove, removing }) {
  const canPlay = item.queue.length > 0;
  const duration = item.kind === 'album'
    ? `${item.queue.length} track${item.queue.length !== 1 ? 's' : ''}`
    : formatDuration(item.duration);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      className="group flex items-center gap-3 px-3 py-3 rounded-xl"
      style={{
        background: isActive ? 'rgba(184,207,166,0.08)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isActive ? 'rgba(184,207,166,0.25)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        aria-label={isPlaying && isActive ? `Pausar ${item.title}` : `Reproducir ${item.title}`}
        className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 disabled:opacity-40"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <img src={item.image || FALLBACK} alt="" className="w-full h-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.42)' }}>
          {isPlaying && isActive
            ? <Pause className="w-4 h-4 fill-current text-white" />
            : <Play className="w-4 h-4 fill-current text-white ml-0.5" />
          }
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: isActive ? ACCENT : 'white' }}>
            {item.title}
          </p>
          {isActive && (
            <span className="hidden sm:inline text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(184,207,166,0.14)', color: ACCENT }}>
              {isPlaying ? 'sonando' : 'activo'}
            </span>
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.36)' }}>
          {item.artist || item.album || 'PolyFauna'}
          {duration ? ` · ${duration}` : ''}
        </p>
      </div>

      <div className="hidden sm:block">
        <TypeBadge kind={item.kind} />
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        title="Quitar del Organismo"
      >
        {removing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/45" />
          : <Trash2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.42)' }} />
        }
      </button>
    </motion.div>
  );
}

export default function Organism({ currentTrack, isPlaying, setIsPlaying }) {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [discoveries, setDiscoveries] = useState({ events: [], people: [] });
  const [activeTab, setActiveTab] = useState('music');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [shuffle, setShuffle] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    async function loadOrganism() {
      setLoading(true);
      setError(null);
      try {
        const [favsRes] = await Promise.all([
          supabase
            .from('user_favorites')
            .select('id, item_type, item_id, created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false }),
        ]);

        if (favsRes.error) throw favsRes.error;

        const favs = favsRes.data || [];
        const podcastIds = uniq(favs.filter(row => row.item_type === 'podcast').map(row => row.item_id));
        const trackIds = uniq(favs.filter(row => row.item_type === 'track').map(row => row.item_id));
        const albumIds = uniq(favs.filter(row => row.item_type === 'album').map(row => row.item_id));
        const eventIds = uniq(favs.filter(row => row.item_type === 'event').map(row => row.item_id));
        const artistIds = uniq(favs.filter(row => row.item_type === 'artist').map(row => row.item_id));
        const organizerIds = uniq(favs.filter(row => row.item_type === 'organizer').map(row => row.item_id));

        const [podcastsRes, tracksRes, albumsRes, albumTracksRes, eventsRes, artistsRes, organizersRes] = await Promise.all([
          podcastIds.length
            ? supabase.from('podcasts').select('id, title, cover_url, audio_url, duration, genre, artists:artists!podcasts_artist_id_fkey(name)').in('id', podcastIds)
            : Promise.resolve({ data: [], error: null }),
          trackIds.length
            ? supabase.from('tracks').select('id, title, audio_url, duration, genre, track_number, albums(title, cover_url), artists(name)').in('id', trackIds)
            : Promise.resolve({ data: [], error: null }),
          albumIds.length
            ? supabase.from('albums').select('id, title, cover_url, genre, artists:artists!albums_artist_id_fkey(name)').in('id', albumIds)
            : Promise.resolve({ data: [], error: null }),
          albumIds.length
            ? supabase.from('tracks').select('id, title, album_id, audio_url, duration, genre, track_number, albums(title, cover_url), artists(name)').in('album_id', albumIds).order('track_number', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          eventIds.length
            ? supabase.from('events').select('id, title, date, venue, city, image_url, mobile_image_url').in('id', eventIds)
            : Promise.resolve({ data: [], error: null }),
          artistIds.length
            ? supabase.from('artists_public').select('id, name, type, image_url, genres').in('id', artistIds)
            : Promise.resolve({ data: [], error: null }),
          organizerIds.length
            ? supabase.from('organizers').select('id, name, type, image_url, city').in('id', organizerIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (podcastsRes.error) throw podcastsRes.error;
        if (tracksRes.error) throw tracksRes.error;
        if (albumsRes.error) throw albumsRes.error;
        if (albumTracksRes.error) throw albumTracksRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (artistsRes.error) throw artistsRes.error;
        if (organizersRes.error) throw organizersRes.error;

        const podcasts = new Map((podcastsRes.data || []).map(row => [row.id, row]));
        const tracks = new Map((tracksRes.data || []).map(row => [row.id, row]));
        const albums = new Map((albumsRes.data || []).map(row => [row.id, row]));
        const tracksByAlbum = (albumTracksRes.data || []).reduce((acc, track) => {
          acc[track.album_id] = acc[track.album_id] || [];
          acc[track.album_id].push(track);
          return acc;
        }, {});

        const byKey = new Map();

        favs.forEach((fav) => {
          if (fav.item_type === 'podcast') {
            const pod = podcasts.get(fav.item_id);
            if (!pod) return;
            byKey.set(`podcast-${pod.id}`, {
              key: `podcast-${pod.id}`,
              kind: 'podcast',
              id: pod.id,
              sourceId: fav.id,
              title: pod.title,
              artist: pod.artists?.name || 'PolyFauna',
              genre: pod.genre,
              image: pod.cover_url || FALLBACK,
              audio_url: pod.audio_url,
              duration: pod.duration,
              addedAt: fav.created_at,
              queue: pod.audio_url ? [toPlayerTrack({
                kind: 'podcast',
                id: pod.id,
                title: pod.title,
                artist: pod.artists?.name || 'PolyFauna',
                genre: pod.genre,
                image: pod.cover_url || FALLBACK,
                audio_url: pod.audio_url,
                duration: pod.duration,
              })] : [],
            });
          }

          if (fav.item_type === 'track') {
            const track = tracks.get(fav.item_id);
            if (!track) return;
            byKey.set(`track-${track.id}`, {
              key: `track-${track.id}`,
              kind: 'track',
              id: track.id,
              sourceId: fav.id,
              title: track.title,
              artist: track.artists?.name || 'PolyFauna',
              album: track.albums?.title,
              genre: track.genre,
              image: track.albums?.cover_url || FALLBACK,
              audio_url: track.audio_url,
              duration: track.duration,
              addedAt: fav.created_at,
              queue: track.audio_url ? [toPlayerTrack({
                kind: 'track',
                id: track.id,
                title: track.title,
                artist: track.artists?.name || 'PolyFauna',
                album: track.albums?.title,
                genre: track.genre,
                image: track.albums?.cover_url || FALLBACK,
                audio_url: track.audio_url,
                duration: track.duration,
              })] : [],
            });
          }

          if (fav.item_type === 'album') {
            const album = albums.get(fav.item_id);
            if (!album) return;
            const albumTracks = (tracksByAlbum[album.id] || [])
              .filter(track => track.audio_url)
              .map(track => toPlayerTrack({
                kind: 'track',
                id: track.id,
                title: track.title,
                artist: track.artists?.name || album.artists?.name || 'PolyFauna',
                album: album.title,
                genre: track.genre || album.genre,
                image: album.cover_url || FALLBACK,
                audio_url: track.audio_url,
                duration: track.duration,
              }));

            byKey.set(`album-${album.id}`, {
              key: `album-${album.id}`,
              kind: 'album',
              id: album.id,
              sourceId: fav.id,
              title: album.title,
              artist: album.artists?.name || 'PolyFauna',
              genre: album.genre,
              image: album.cover_url || FALLBACK,
              addedAt: fav.created_at,
              queue: albumTracks,
            });
          }
        });

        const nextItems = [...byKey.values()].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
        if (active) {
          setItems(nextItems);
          setDiscoveries({
            events: (eventsRes.data || []).map(event => ({ ...event, kind: 'event', image: event.mobile_image_url || event.image_url })),
            people: [
              ...(artistsRes.data || []).map(artist => ({ ...artist, kind: 'artist', title: artist.name, image: artist.image_url, meta: Array.isArray(artist.genres) ? artist.genres.join(' · ') : artist.type })),
              ...(organizersRes.data || []).map(org => ({ ...org, kind: 'organizer', title: org.name, image: org.image_url, meta: org.city || org.type })),
            ],
          });
        }
      } catch (err) {
        if (active) setError(err.message || 'No pudimos cargar tu Organismo.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrganism();
    return () => { active = false; };
  }, [currentUser?.id, version]);

  const playableQueue = useMemo(() => items.flatMap(item => item.queue), [items]);
  const visibleItems = useMemo(() => (shuffle ? shuffleList(items) : items), [items, shuffle]);
  const activeItem = useMemo(() => {
    if (!currentTrack) return null;
    return items.find(item => item.queue.some(track => track.id === currentTrack.id)) || null;
  }, [items, currentTrack]);

  if (authLoading) {
    return (
      <div className="p-5">
        <PulseLoader label="Verificando sesión..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-5">
        <LoginRequired message="Inicia sesión para construir tu Organismo." />
      </div>
    );
  }

  const playQueue = (queue, startIndex = 0) => {
    if (!queue.length) {
      toast({ title: 'Sin audio disponible', description: 'Este contenido todavía no tiene archivo de audio.' });
      return;
    }
    window.dispatchEvent(new CustomEvent('pf:play-queue', { detail: { items: queue, startIndex } }));
  };

  const playAll = () => {
    const queue = shuffle ? shuffleList(playableQueue) : playableQueue;
    playQueue(queue, 0);
  };

  const playRandom = () => {
    const queue = shuffleList(playableQueue);
    setShuffle(true);
    playQueue(queue, 0);
  };

  const playItem = (item) => {
    if (activeItem?.key === item.key) {
      setIsPlaying(prev => !prev);
      return;
    }
    playQueue(item.queue, 0);
  };

  const removeItem = async (item) => {
    setRemoving(item.key);
    try {
      await supabase.from('user_favorites').delete().eq('user_id', currentUser.id).eq('id', item.sourceId);
      toast({ title: 'Organismo actualizado', description: `"${item.title}" salió de tu organismo.` });
      setVersion(v => v + 1);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="p-4 sm:p-5 pb-48 lg:pb-5 space-y-5">
      <section
        className="relative overflow-hidden rounded-2xl"
        style={{ background: 'rgba(7,12,11,0.92)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="absolute inset-0 poly-grid opacity-70 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4 px-4 sm:px-6 py-5 sm:py-6">
          <OrganismPulse isPlaying={Boolean(activeItem && isPlaying)} />
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ color: 'rgba(184,207,166,0.72)', fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Biblioteca viva
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">Tu Organismo</h1>
            <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Todo lo que marcas con like se reúne aquí como una lista de reproducción personal.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {items.length} señal{items.length !== 1 ? 'es' : ''}
              </span>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(184,207,166,0.09)', color: ACCENT, border: '1px solid rgba(184,207,166,0.18)' }}>
                {playableQueue.length} reproducible{playableQueue.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap md:flex-col gap-2 md:w-44">
            <button
              type="button"
              onClick={playAll}
              disabled={!playableQueue.length}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black disabled:opacity-35"
              style={{ background: '#ECECEC', color: '#080B14' }}
            >
              <Play className="w-4 h-4 fill-current" />
              Reproducir
            </button>
            <button
              type="button"
              onClick={playRandom}
              disabled={!playableQueue.length}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-35"
              style={{
                background: shuffle ? 'rgba(184,207,166,0.14)' : 'rgba(255,255,255,0.06)',
                color: shuffle ? ACCENT : 'rgba(255,255,255,0.70)',
                border: `1px solid ${shuffle ? 'rgba(184,207,166,0.25)' : 'rgba(255,255,255,0.09)'}`,
              }}
            >
              <Shuffle className="w-4 h-4" />
              Aleatorio
            </button>
          </div>
        </div>
      </section>

      <nav
        className="flex gap-1 p-1 rounded-xl overflow-x-auto"
        aria-label="Secciones de Tu Organismo"
        style={{
          background: 'rgba(184,207,166,0.045)',
          border: '1px solid rgba(184,207,166,0.13)',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'music', label: 'Tu música', icon: Music2, count: items.length },
          { id: 'events', label: 'Tu agenda', icon: CalendarDays, count: discoveries.events.length },
          { id: 'people', label: 'Siguiendo', icon: UserRound, count: discoveries.people.length },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0"
            style={{
              minWidth: 105,
              background: activeTab === tab.id ? 'rgba(184,207,166,0.15)' : 'transparent',
              color: activeTab === tab.id ? ACCENT : 'rgba(255,255,255,0.43)',
              boxShadow: activeTab === tab.id ? 'inset 0 0 0 1px rgba(184,207,166,0.13)' : 'none',
            }}
          >
            <tab.icon className="w-4 h-4" strokeWidth={1.75} />
            <span>{tab.label}</span>
            <span
              className="min-w-4 h-4 px-1 rounded-full inline-flex items-center justify-center text-[9px] tabular-nums"
              style={{ background: activeTab === tab.id ? 'rgba(184,207,166,0.12)' : 'rgba(255,255,255,0.05)' }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </nav>

      {loading && <LoadingSkeleton rows={5} />}
      {!loading && error && <ErrorState message={error} onRetry={() => setVersion(v => v + 1)} />}
      {!loading && !error && activeTab === 'music' && items.length === 0 && (
        <EmptyState
          icon={Heart}
          label="Tu Organismo todavía está vacío"
          subtitle="Dale like a podcasts, tracks o álbumes para que empiece a crecer."
        />
      )}

      {!loading && !error && activeTab === 'music' && items.length > 0 && (
        <section className="space-y-2">
          {visibleItems.map((item, index) => (
            <OrganismRow
              key={item.key}
              item={item}
              index={index}
              isActive={activeItem?.key === item.key}
              isPlaying={activeItem?.key === item.key && isPlaying}
              onPlay={() => playItem(item)}
              onRemove={() => removeItem(item)}
              removing={removing === item.key}
            />
          ))}
        </section>
      )}

      {!loading && !error && activeTab === 'events' && (
        discoveries.events.length ? <section className="grid sm:grid-cols-2 gap-3">
          {discoveries.events.map(event => (
            <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <img src={event.image || FALLBACK} alt="" className="w-14 h-14 rounded-xl object-cover" />
              <div className="min-w-0"><p className="text-sm font-bold text-white truncate">{event.title}</p><p className="text-xs text-white/40 mt-1">{event.date ? new Date(event.date).toLocaleDateString('es-CO') : 'Fecha por anunciar'}{event.city ? ` · ${event.city}` : ''}</p></div>
            </div>
          ))}
        </section> : <EmptyState icon={CalendarDays} label="Tu agenda está vacía" subtitle="Los eventos que marques con corazón aparecerán aquí. Tus entradas viven únicamente en Ticket Vault." />
      )}

      {!loading && !error && activeTab === 'people' && (
        discoveries.people.length ? <section className="grid sm:grid-cols-2 gap-3">
          {discoveries.people.map(person => (
            <div key={`${person.kind}-${person.id}`} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {person.image ? <img src={person.image} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5">{person.kind === 'organizer' ? <Building2 className="w-5 h-5 text-white/35" /> : <UserRound className="w-5 h-5 text-white/35" />}</div>}
              <div className="min-w-0"><p className="text-sm font-bold text-white truncate">{person.title}</p><p className="text-xs text-white/40 mt-1 capitalize">{person.meta || (person.kind === 'artist' ? 'Artista' : 'Organizador')}</p></div>
            </div>
          ))}
        </section> : <EmptyState icon={UserRound} label="Aún no sigues perfiles" subtitle="Artistas, sellos, clubes y colectivos aparecerán aquí sin quitar protagonismo a tu música." />
      )}
    </div>
  );
}
