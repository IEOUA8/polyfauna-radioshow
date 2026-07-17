import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ArrowLeft, CalendarDays, ChevronDown, Clock, Headphones, Heart, LayoutGrid, LayoutList, Link, Link2, Lock, MessageCircle, Pause, Play, Send, UserRound, X } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import { openInSection } from '@/lib/openInSection';
import { EDITORIAL_ACCENT } from '@/lib/editorialTheme';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop';
const SITE_URL = 'https://www.polyfauna.com';

function podcastPublicUrl(podcast) {
  const identifier = podcast?.slug || podcast?.id;
  return identifier ? `${SITE_URL}/podcasts/${encodeURIComponent(identifier)}` : `${SITE_URL}/?section=podcasts`;
}

function podcastIdentifierFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/podcasts\/([^/]+)\/?$/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  return new URLSearchParams(window.location.search).get('podcast');
}

function podcastMetaDescription(podcast) {
  const raw = String(podcast?.description || '').replace(/\s+/g, ' ').trim();
  return (raw || `Escucha ${podcast?.title || 'este podcast'} en POLYFAUNA, archivo sonoro de música electrónica independiente.`).slice(0, 200);
}

function schemaDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return undefined;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${secs || (!hours && !minutes) ? `${secs}S` : ''}`;
}

const GENRE_COLORS = {
  'house': 'rgba(255,255,255,0.9)', 'tech house': 'rgba(255,255,255,0.9)', 'deep house': '#00B4DD',
  'acid house': '#00AADD', 'funky house': '#33DDFF', 'micro house': '#00BBEE',
  'french house': '#0088BB', 'electro house': '#00CCDD', 'disco house': '#00BBEE',
  'disco': '#E879A0', 'nu disco': '#FF69B4', 'italo disco': '#FF85C0',
  'space disco': '#CC5599', 'electro clash': '#FF5599', 'disco classic': '#DD6699',
  'trance': '#4CAF50', 'goa trance': '#66BB6A', 'classic trance': '#43A047',
  'acid trance': '#2E7D32', 'psy trance': '#81C784', 'tech trance': '#388E3C',
  'uplifting': '#A5D6A7', 'progressive trance': '#4CAF50',
  'techno': '#FF8C00', 'detroit techno': '#FF7F00', 'minimal': '#E67E00',
  'electro': '#FFA000', 'dub techno': '#FF9500', 'ambient techno': '#FFB300',
  'industrial techno': '#E65100', 'minimal techno': '#E67E00',
  'hardcore': '#FF1493', 'gabber': '#FF0080', 'hardstyle': '#FF69B4',
  'breakbeat hardcore': '#FF1177', 'frenchcore': '#FF33AA', 'speedcore': '#DD0077',
  'hardtek': '#FF2299', 'industrial hardcore': '#AA0055',
  'industrial': '#FFD700', 'industrial dance': '#FFC107', 'ebm': '#FF8F00',
  'aggrotech': '#FFA000', 'power electronics': '#FFCA28', 'new beat': '#FFD54F',
  'downtempo': '#9C27B0', 'ambient': '#7C5CFF', 'chillout': '#8E24AA',
  'chillwave': '#AB47BC', 'psybient': '#6A1B9A', 'idm': '#4527A0',
  'drone': '#5E35B1', 'dark ambient': '#4527A0',
  'hip hop': '#F44336', 'trap': '#FF5722', 'east coast rap': '#E53935',
  'trip hop': '#EF5350', 'jazz hop': '#FF6F00', 'turntablism': '#E53935',
  'instrumental hip hop': '#FF8A1F',
  'garage': '#00BCD4', 'uk garage': '#00ACC1', '2-step': '#0097A7',
  'grime': '#00838F', 'uk bass': '#006064', 'future garage': '#00B4CC',
  'breaks': '#4FC3F7', 'breakbeat': '#29B6F6', 'big beat': '#0288D1',
  'liquid funk': '#039BE5', 'drum and bass': '#0277BD', 'dnb': '#0277BD',
  'jungle': '#0288D1',
  'funk': '#FF9800', 'soul': '#FF8F00', 'afrobeat': '#FF6D00',
  'experimental': '#7C4DFF', 'noise': '#6200EA', 'glitch': '#AA00FF',
  'mixed': '#94A3B8', 'various': '#94A3B8',
};

function getGenreColor(genre) {
  if (!genre) return '#E8EEE9';
  const normalized = genre.toLowerCase().trim();
  if (GENRE_COLORS[normalized]) return GENRE_COLORS[normalized];
  const matchingGenre = normalized.split(/[,/|]/).map((item) => item.trim()).find((item) => GENRE_COLORS[item]);
  return matchingGenre ? GENRE_COLORS[matchingGenre] : '#E8EEE9';
}

function fmtDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(Number(secs) / 3600);
  const m = Math.floor((Number(secs) % 3600) / 60);
  const s = Number(secs) % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Vista lista (memoizada: que cambie el track activo no debe re-renderizar
   toda la lista, solo la fila que en verdad cambió) ── */
const PodcastListItem = React.memo(function PodcastListItem({ pod, index, isActive, isCurrentlyPlaying, isLiked, onSelect, onPlay, onToggleLike }) {
  const { toast } = useToast();
  const gColor = getGenreColor(pod.genre);
  const handleToggleLike = () => {
    onToggleLike(pod.id);
    if (!isLiked) toast({ title: pod.title, description: 'Guardado en tu biblioteca', style: { borderLeft: `3px solid ${gColor}` } });
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl group cursor-pointer"
      style={{
        background: isActive ? `${gColor}0C` : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isActive ? `${gColor}30` : 'rgba(255,255,255,0.06)'}`,
        transition: 'background 0.2s, border-color 0.2s',
      }}
      onClick={() => onSelect(pod)}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; } }}
    >
      {/* Thumb */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0"
        style={{ border: `1px solid ${isActive ? `${gColor}40` : 'rgba(255,255,255,0.07)'}` }}>
        <img src={pod.cover_url || FALLBACK_IMG} alt={pod.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        {isCurrentlyPlaying && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: `${gColor}55` }}>
            <div className="flex items-end gap-px h-4">
              {[4, 7, 5, 6].map((h, j) => (
                <motion.div key={j} className="w-0.5 rounded-t-sm"
                  style={{ background: '#fff' }}
                  animate={{ height: [`${h}px`, `${h * 2}px`] }}
                  transition={{ duration: 0.35 + j * 0.07, repeat: Infinity, repeatType: 'reverse' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight truncate" style={{ color: isActive ? gColor : 'white' }}>
          {pod.title}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.40)' }}>
          {pod.artists?.name || 'PolyFauna'}
          {pod.duration ? ` · ${fmtDuration(pod.duration)}` : ''}
        </p>
      </div>

      {/* Like */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); handleToggleLike(); }}
        className="shrink-0 p-1.5 rounded-full transition-colors hover:bg-white/5"
      >
        <Heart className="w-4 h-4" style={{ fill: isLiked ? gColor : 'none', color: isLiked ? gColor : 'rgba(255,255,255,0.25)' }} />
      </button>

      {/* Play */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onPlay(pod); }}
        aria-label={isCurrentlyPlaying ? `Pausar ${pod.title}` : `Reproducir ${pod.title}`}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all"
        style={{
          background: isCurrentlyPlaying ? gColor : 'rgba(255,255,255,0.08)',
          border: `1px solid ${isCurrentlyPlaying ? 'transparent' : 'rgba(255,255,255,0.10)'}`,
        }}
      >
        {isCurrentlyPlaying
          ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
          : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: 'rgba(255,255,255,0.75)' }} />
        }
      </button>
    </motion.div>
  );
});

/* ── Vista cuadrícula (mismo motivo de memoización que la lista) ── */
const PodcastGridCard = React.memo(function PodcastGridCard({ pod, index, isActive, isCurrentlyPlaying, isLiked, onSelect, onPlay, onToggleLike }) {
  const { toast } = useToast();
  const gColor = getGenreColor(pod.genre);
  const handleToggleLike = () => {
    onToggleLike(pod.id);
    if (!isLiked) toast({ title: pod.title, description: 'Guardado en tu biblioteca', style: { borderLeft: `3px solid ${gColor}` } });
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
      style={{
        background: 'rgba(11, 16, 15, 0.90)',
        border: `1px solid ${isActive ? `${gColor}40` : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? `0 0 20px ${gColor}18` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 350, damping: 22 } }}
      onClick={() => onSelect(pod)}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={pod.cover_url || FALLBACK_IMG}
          alt={pod.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        {pod.genre && (
          <span
            className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
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

        {isActive && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
            style={{ background: gColor, color: '#080B14' }}
          >
            {isCurrentlyPlaying ? 'ON AIR' : '⏸'}
          </motion.span>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(pod); }}
          aria-label={isCurrentlyPlaying ? `Pausar ${pod.title}` : `Reproducir ${pod.title}`}
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-2xl"
            style={{ background: gColor, boxShadow: `0 0 24px ${gColor}80` }}
          >
            {isCurrentlyPlaying
              ? <Pause className="w-5 h-5 fill-current" style={{ color: '#080B14' }} />
              : <Play className="w-5 h-5 ml-0.5 fill-current" style={{ color: '#080B14' }} />
            }
          </div>
        </button>

        {isCurrentlyPlaying && (
          <div className="absolute bottom-2.5 left-2.5 flex items-end gap-px h-4">
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

      <div className="p-2.5 flex flex-col gap-1">
        <p className="text-xs font-bold leading-tight line-clamp-2" style={{ color: isActive ? gColor : 'white' }}>
          {pod.title}
        </p>
        <p className="text-[10px] text-white/40 truncate">{pod.artists?.name || 'PolyFauna'}</p>
        <div className="flex items-center justify-between mt-0.5">
          {pod.duration ? (
            <span className="text-[10px] text-white/25">{fmtDuration(pod.duration)}</span>
          ) : <span />}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}
            className="p-1 rounded-full transition-colors hover:bg-white/5"
          >
            <Heart
              className="w-3 h-3"
              style={{ fill: isLiked ? gColor : 'none', color: isLiked ? gColor : 'rgba(255,255,255,0.3)' }}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

/* ─────────────────────────────────────────
   Podcast detail view
───────────────────────────────────────── */
function PodcastDetail({ pod, onBack, onPlay, onArtistClick, isActive, isCurrentlyPlaying, isLiked, onLike, currentUser }) {
  const { toast } = useToast();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const gColor = EDITORIAL_ACCENT;
  const dateStr = new Date(pod.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const [likesCount, setLikesCount]       = useState(0);
  const [comments, setComments]           = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const inputRef = useRef(null);

  const taggedArtists = useMemo(() => {
    const credits = (pod.podcast_artist_credits || [])
      .map((credit) => credit.artists)
      .filter(Boolean)
      .filter((artist) => artist.id !== pod.artist_id);
    const source = credits.length > 0 ? credits : (pod.artists ? [pod.artists] : []);
    const seen = new Set();
    return source.filter((artist) => {
      const key = artist.id || artist.slug || artist.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pod.artist_id, pod.artists, pod.podcast_artist_credits]);

  const descriptionIsLong = (pod.description?.length || 0) > 260;
  const descriptionCollapsed = descriptionIsLong && (isMobile || !descriptionExpanded);

  useEffect(() => {
    setDescriptionExpanded(false);
    setDescriptionModalOpen(false);
  }, [pod.id]);

  // Fetch likes count + comments
  useEffect(() => {
    let active = true;
    async function load() {
      const [{ count }, { data: cmts }] = await Promise.all([
        supabase.from('user_likes').select('*', { count: 'exact', head: true }).eq('podcast_id', pod.id),
        supabase
          .from('podcast_comments')
          .select('id, content, created_at, user_id, profiles(display_name, username, avatar_url)')
          .eq('podcast_id', pod.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (!active) return;
      setLikesCount(count ?? 0);
      setComments(cmts ?? []);
      setLoadingComments(false);
    }
    load();
    return () => { active = false; };
  }, [pod.id]);

  const handleLike = () => {
    onLike();
    setLikesCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
  };

  const canonicalUrl = podcastPublicUrl(pod);
  const metaDescription = podcastMetaDescription(pod);
  const socialImage = pod.cover_url || `${SITE_URL}/icons/og-cover.png`;
  const seoTitle = `${pod.title} — ${pod.artists?.name || 'POLYFAUNA'}`;
  const podcastSchema = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: pod.title,
    description: metaDescription,
    url: canonicalUrl,
    image: socialImage,
    inLanguage: 'es-CO',
    ...(pod.created_at ? { datePublished: pod.created_at } : {}),
    ...(schemaDuration(pod.duration) ? { duration: schemaDuration(pod.duration) } : {}),
    associatedMedia: {
      '@type': 'AudioObject',
      name: pod.title,
      ...(pod.audio_url ? { contentUrl: pod.audio_url } : {}),
      ...(schemaDuration(pod.duration) ? { duration: schemaDuration(pod.duration) } : {}),
    },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'Podcasts POLYFAUNA',
      url: `${SITE_URL}/?section=podcasts`,
    },
    publisher: { '@type': 'Organization', name: 'POLYFAUNA', url: SITE_URL },
    ...(pod.artists?.name ? { actor: { '@type': 'Person', name: pod.artists.name } } : {}),
  };

  const handleComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || submitting || !currentUser) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('podcast_comments')
      .insert({ podcast_id: pod.id, user_id: currentUser.id, content: text })
      .select('id, content, created_at, user_id, profiles(display_name, username, avatar_url)')
      .single();
    setSubmitting(false);
    if (!error && data) {
      setComments(prev => [data, ...prev]);
      setCommentText('');
    }
  };

  const deleteComment = async (id) => {
    await supabase.from('podcast_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  return (
    <>
    <Helmet>
      <title>{seoTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content="POLYFAUNA" />
      <meta property="og:type" content="music.song" />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:secure_url" content={socialImage} />
      <meta property="og:image:alt" content={`Portada de ${pod.title}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="1200" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={socialImage} />
      <script type="application/ld+json">{JSON.stringify(podcastSchema)}</script>
    </Helmet>
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-full space-y-6"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold transition-colors"
        style={{ color: 'rgba(255,255,255,0.45)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
      >
        <ArrowLeft className="w-4 h-4" />
        Podcasts
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Cover ── */}
        <div className="shrink-0 w-full lg:w-auto">
          <div className="relative w-full max-w-[320px] sm:max-w-sm mx-auto lg:mx-0 lg:w-72 xl:w-80 aspect-square rounded-2xl overflow-hidden"
            style={{ boxShadow: `0 24px 64px ${gColor}30, 0 8px 32px rgba(0,0,0,0.6)` }}>
            <img
              src={pod.cover_url || FALLBACK_IMG}
              alt={pod.title}
              decoding="async"
              fetchPriority="high"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {isCurrentlyPlaying && (
              <div className="absolute bottom-4 left-4 flex items-end gap-1 h-6">
                {[6, 10, 7, 9, 5, 8].map((h, j) => (
                  <motion.div key={j} className="w-1 rounded-t-sm" style={{ background: gColor }}
                    animate={{ height: [`${h * 1.5}px`, `${h * 2.8}px`] }}
                    transition={{ duration: 0.35 + j * 0.07, repeat: Infinity, repeatType: 'reverse' }} />
                ))}
              </div>
            )}
            <motion.button
              type="button"
              onClick={onPlay}
              aria-label={isCurrentlyPlaying ? `Pausar ${pod.title}` : `Reproducir ${pod.title}`}
              whileTap={{ scale: 0.92 }}
              className="md:hidden absolute bottom-4 right-4 w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #F7FAF8 0%, #C8D1CC 100%)',
                color: '#07100C',
                border: '1px solid rgba(255,255,255,0.78)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
              }}
            >
              {isCurrentlyPlaying
                ? <Pause className="w-6 h-6 fill-current" />
                : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </motion.button>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">

          {pod.genre && (
            <span className="self-start text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: `${gColor}18`, color: gColor, border: `1px solid ${gColor}35` }}>
              {pod.genre}
            </span>
          )}

          <div>
            <h1 className="pf-detail-title">{pod.title}</h1>
            <p className="text-sm mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.48)' }}>
              Publicado por <span className="font-bold" style={{ color: gColor }}>{pod.artists?.name || 'PolyFauna'}</span>
            </p>
          </div>

          {taggedArtists.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="pf-section-label">
                {taggedArtists.length === 1 ? 'Artista' : 'Artistas'}
              </span>
              {taggedArtists.map((artist) => (
                <button
                  key={artist.id || artist.slug || artist.name}
                  type="button"
                  onClick={() => onArtistClick?.(artist)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: `${gColor}16`, border: `1px solid ${gColor}35`, color: gColor }}
                  title={`Abrir perfil de ${artist.name}`}
                >
                  <UserRound className="w-3.5 h-3.5" />
                  {artist.name}
                </button>
              ))}
            </div>
          )}

          {/* Meta: fecha · duración · plays */}
          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {dateStr}
            </span>
            {pod.duration && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {fmtDuration(pod.duration)}
              </span>
            )}
            {(pod.play_count || 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <Play className="w-3 h-3 fill-current" />
                {(pod.play_count).toLocaleString('es-CO')} reproducciones
              </span>
            )}
          </div>

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <motion.button
              type="button"
              onClick={onPlay}
              aria-label={isCurrentlyPlaying ? `Pausar ${pod.title}` : `Reproducir ${pod.title}`}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="hidden md:flex min-w-[150px] items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-black"
              style={{
                background: 'linear-gradient(135deg, #F7FAF8 0%, #C8D1CC 100%)',
                color: '#07100C',
                border: '1px solid rgba(255,255,255,0.72)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              {isCurrentlyPlaying
                ? <><Pause className="w-5 h-5 fill-current" /> Pausar</>
                : <><Play className="w-5 h-5 fill-current ml-0.5" /> {isActive ? 'Reanudar' : 'Reproducir'}</>}
            </motion.button>

            {/* Me encanta + count */}
            <motion.button
              type="button"
              onClick={handleLike}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl transition-all"
              style={{
                background: isLiked ? `${gColor}20` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isLiked ? `${gColor}50` : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <Heart className="w-5 h-5 transition-all"
                style={{ fill: isLiked ? gColor : 'none', color: isLiked ? gColor : 'rgba(255,255,255,0.5)' }} />
              {likesCount > 0 && (
                <span className="text-sm font-black" style={{ color: isLiked ? gColor : 'rgba(255,255,255,0.45)' }}>
                  {likesCount.toLocaleString('es-CO')}
                </span>
              )}
            </motion.button>

            {/* Compartir */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center justify-center w-12 h-12 rounded-2xl transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              title="Compartir podcast"
              onClick={async () => {
                const url = canonicalUrl;
                const shareText = `${pod.title} — ${pod.artists?.name || 'PolyFauna'} | PolyFauna Radio`;
                if (navigator.share) {
                  await navigator.share({ title: shareText, text: metaDescription, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast({ title: 'Enlace copiado', description: shareText });
                }
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            >
              <Link2 className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.55)' }} />
            </motion.button>
          </div>

        </div>
      </div>

      {/* La descripción comienza debajo de la portada y ocupa el ancho útil. */}
      {pod.description && (
        <motion.section
          layout
          className="rounded-2xl px-5 py-5 sm:px-6 sm:py-6"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="pf-section-label mb-3">
            Descripción
          </p>
          <motion.div
            id="podcast-description-content"
            initial={false}
            animate={{ height: descriptionCollapsed ? '7.35rem' : 'auto' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="relative overflow-hidden"
          >
            <p className="whitespace-pre-wrap text-sm sm:text-[15px] leading-7" style={{ color: 'rgba(255,255,255,0.60)' }}>
              {pod.description}
            </p>
            {descriptionCollapsed && (
              <div
                className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, #090E0C)' }}
                aria-hidden
              />
            )}
          </motion.div>
          {descriptionIsLong && (
            <button
              type="button"
              onClick={() => isMobile ? setDescriptionModalOpen(true) : setDescriptionExpanded((value) => !value)}
              aria-expanded={isMobile ? descriptionModalOpen : descriptionExpanded}
              aria-controls="podcast-description-content"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-black transition-colors hover:text-white"
              style={{ color: gColor }}
            >
              {isMobile ? 'Leer más…' : (descriptionExpanded ? 'Leer menos' : 'Leer más…')}
              <ChevronDown className={`w-4 h-4 transition-transform ${!isMobile && descriptionExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </motion.section>
      )}

      {/* ── Comentarios ─────────────────────────────── */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Comentarios {comments.length > 0 && `· ${comments.length}`}
          </p>
        </div>

        {/* Input — solo usuarios autenticados */}
        {currentUser ? (
          <form onSubmit={handleComment} className="flex gap-2 mb-5">
            <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black text-white/50"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                {(currentUser.email?.[0] ?? '?').toUpperCase()}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Escribe un comentario…"
                maxLength={500}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'rgba(255,255,255,0.80)', caretColor: gColor }}
              />
            </div>
            <motion.button
              type="submit"
              disabled={!commentText.trim() || submitting}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: commentText.trim() ? `${gColor}22` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${commentText.trim() ? `${gColor}40` : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <Send className="w-4 h-4" style={{ color: commentText.trim() ? gColor : 'rgba(255,255,255,0.35)' }} />
            </motion.button>
          </form>
        ) : (
          <p className="text-sm mb-5 px-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
            Inicia sesión para dejar un comentario.
          </p>
        )}

        {/* Lista de comentarios */}
        {loadingComments ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'rgba(255,255,255,0.20)' }}>
            Sé el primero en comentar.
          </p>
        ) : (
          <div className="space-y-2">
            {comments.map(c => {
              const name = c.profiles?.display_name || c.profiles?.username || 'Usuario';
              const initial = name[0].toUpperCase();
              const isOwn = currentUser?.id === c.user_id;
              const timeAgo = new Date(c.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 px-4 py-3 rounded-xl group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black text-white/50 mt-0.5"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-bold text-white/70">{name}</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{c.content}</p>
                  </div>
                  {isOwn && (
                    <button type="button" onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold shrink-0 transition-opacity mt-0.5"
                      style={{ color: 'rgba(239,68,68,0.5)' }}>
                      Borrar
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {pod.footer_description && (
        <footer
          className="rounded-2xl px-5 py-6 sm:px-7"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            className="pf-section-label mb-3"
          >
            Notas del episodio
          </p>
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {pod.footer_description}
          </p>
        </footer>
      )}

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none -z-10"
        style={{ background: `radial-gradient(ellipse at 30% 20%, ${gColor}08 0%, transparent 55%)` }} />
    </motion.div>

    {createPortal(
      <AnimatePresence>
        {descriptionModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] flex items-center justify-center p-4"
            style={{
              background: 'rgba(0,0,0,0.78)',
              backdropFilter: 'blur(10px)',
              paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
            onClick={() => setDescriptionModalOpen(false)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="podcast-description-title"
              className="w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-2xl p-5 sm:p-6"
              style={{ background: '#0A100E', border: '1px solid rgba(255,255,255,0.11)', boxShadow: '0 24px 80px rgba(0,0,0,0.65)' }}
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: gColor }}>Descripción</p>
                  <h2 id="podcast-description-title" className="text-lg font-black text-white leading-tight">{pod.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDescriptionModalOpen(false)}
                  className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  aria-label="Cerrar descripción"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-7" style={{ color: 'rgba(255,255,255,0.66)' }}>
                {pod.description}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}

/* ─────────────────────────────────────────
   Main page
───────────────────────────────────────── */
export default function PodcastsPage({ setCurrentTrack, setIsPlaying, currentTrack, isPlaying, setCurrentSection }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [activeGenre, setActiveGenre] = useState('All');
  const [selectedPod, setSelectedPod] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const { isFav, toggle: toggleFavorite } = useFavorites();
  const isLiked = useCallback((id) => isFav('podcast', id), [isFav]);
  const toggleLike = useCallback((id) => toggleFavorite('podcast', id), [toggleFavorite]);
  const openPodcastDetail = useCallback((podcast, { replace = false } = {}) => {
    if (!podcast) return;
    setSelectedPod(podcast);
    const path = `/podcasts/${encodeURIComponent(podcast.slug || podcast.id)}`;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  }, []);
  const closePodcastDetail = useCallback(() => {
    setSelectedPod(null);
    window.history.pushState({}, '', '/?section=podcasts');
  }, []);

  const { data: podcasts, loading, error, refetch } = useSupabaseQuery(
    () => supabase
      .from('podcasts')
      .select('*, artists:artists!podcasts_artist_id_fkey(id, name, slug), podcast_artist_credits(artists(id, name, slug))')
      .order('created_at', { ascending: false }),
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

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'podcasts') return;
      const inList = (podcasts || []).find(p => p.id === id);
      if (inList) { openPodcastDetail(inList); return; }
      const { data } = await supabase
        .from('podcasts')
        .select('*, artists:artists!podcasts_artist_id_fkey(id, name, slug), podcast_artist_credits(artists(id, name, slug))')
        .eq('id', id)
        .single();
      if (data) openPodcastDetail(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [podcasts, openPodcastDetail]);

  useEffect(() => {
    const podcastParam = podcastIdentifierFromLocation();
    if (!podcastParam || !podcasts?.length) return;
    const inList = podcasts.find(pod => pod.id === podcastParam || pod.slug === podcastParam);
    if (inList) openPodcastDetail(inList, { replace: true });
  }, [podcasts, openPodcastDetail]);

  useEffect(() => {
    const handleHistoryNavigation = () => {
      const podcastParam = podcastIdentifierFromLocation();
      if (!podcastParam) {
        setSelectedPod(null);
        return;
      }
      const inList = (podcasts || []).find((pod) => pod.id === podcastParam || pod.slug === podcastParam);
      if (inList) setSelectedPod(inList);
    };
    window.addEventListener('popstate', handleHistoryNavigation);
    return () => window.removeEventListener('popstate', handleHistoryNavigation);
  }, [podcasts]);

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handlePlay = useCallback((pod) => {
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    if (!pod.audio_url) {
      toast({ title: pod.title, description: 'Audio no disponible aún.' });
      return;
    }
    const isActive = currentTrack?.id === pod.id;
    if (isActive) {
      setIsPlaying(!isPlaying);
    } else {
      // Incrementar contador de reproducciones al iniciar (no al reanudar)
      supabase.rpc('increment_podcast_plays', { p_podcast_id: pod.id }).then(() => {});
      setCurrentTrack({
        kind: 'podcast',
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
  }, [currentUser, currentTrack?.id, isPlaying, toast, setCurrentTrack, setIsPlaying]);

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
      <AnimatePresence mode="wait">

        {/* ── Detail view ── */}
        {selectedPod ? (
          <PodcastDetail
            key="detail"
            pod={selectedPod}
            onBack={closePodcastDetail}
            onPlay={() => handlePlay(selectedPod)}
            onArtistClick={(artist) => openInSection(setCurrentSection, 'artists', 'artist', artist.slug || artist.id)}
            isActive={currentTrack?.id === selectedPod.id}
            isCurrentlyPlaying={currentTrack?.id === selectedPod.id && isPlaying}
            isLiked={isLiked(selectedPod.id)}
            currentUser={currentUser}
            onLike={() => {
              toggleLike(selectedPod.id);
              if (!isLiked(selectedPod.id)) {
                toast({
                  title: selectedPod.title,
                  description: 'Guardado en tu biblioteca',
                  style: { borderLeft: `3px solid ${getGenreColor(selectedPod.genre)}` },
                });
              }
            }}
          />
        ) : (

          /* ── Grid view ── */
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="pf-page-title">Podcasts</h1>
                <p className="pf-page-subtitle">Sesiones y mixes curados de la comunidad.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* View toggle */}
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className="flex items-center justify-center w-8 h-8 transition-colors"
                    style={{ background: viewMode === 'grid' ? 'rgba(255,255,255,0.10)' : 'transparent' }}
                    title="Vista cuadrícula"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" style={{ color: viewMode === 'grid' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="flex items-center justify-center w-8 h-8 transition-colors"
                    style={{ background: viewMode === 'list' ? 'rgba(255,255,255,0.10)' : 'transparent' }}
                    title="Vista lista"
                  >
                    <LayoutList className="w-3.5 h-3.5" style={{ color: viewMode === 'list' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Genre filter pills ── */}
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => {
                const gColor = g === 'All' ? 'rgba(255,255,255,0.9)' : getGenreColor(g);
                const isActive = activeGenre === g;
                return (
                  <motion.button
                    key={g}
                    type="button"
                    onClick={() => setActiveGenre(g)}
                    whileHover={{ scale: 1.10, y: -3 }}
                    whileTap={{ scale: 0.95, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
                    style={{
                      background: isActive ? `${gColor}22` : 'rgba(255,255,255,0.04)',
                      color: isActive ? gColor : 'rgba(255,255,255,0.45)',
                      border: isActive ? `1px solid ${gColor}55` : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isActive ? `0 0 14px ${gColor}30, 0 4px 8px rgba(0,0,0,0.2)` : 'none',
                      transition: 'background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = `${gColor}16`;
                        e.currentTarget.style.color = gColor;
                        e.currentTarget.style.borderColor = `${gColor}45`;
                        e.currentTarget.style.boxShadow = `0 0 14px ${gColor}25, 0 4px 8px rgba(0,0,0,0.2)`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {g}
                  </motion.button>
                );
              })}
            </div>

            {/* ── Podcast grid / list ── */}
            {filtered.length === 0 ? (
              <EmptyState label="No hay podcasts disponibles" icon={Headphones} />
            ) : viewMode === 'list' ? (
              /* ── Vista lista (SoundCloud style) ── */
              <div className="space-y-1.5">
                {filtered.map((pod, i) => (
                  <PodcastListItem
                    key={pod.id}
                    pod={pod}
                    index={i}
                    isActive={currentTrack?.id === pod.id}
                    isCurrentlyPlaying={currentTrack?.id === pod.id && isPlaying}
                    isLiked={isLiked(pod.id)}
                    onSelect={openPodcastDetail}
                    onPlay={handlePlay}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            ) : (
              /* ── Vista cuadrícula ── */
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((pod, i) => (
                  <PodcastGridCard
                    key={pod.id}
                    pod={pod}
                    index={i}
                    isActive={currentTrack?.id === pod.id}
                    isCurrentlyPlaying={currentTrack?.id === pod.id && isPlaying}
                    isLiked={isLiked(pod.id)}
                    onSelect={openPodcastDetail}
                    onPlay={handlePlay}
                    onToggleLike={toggleLike}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* Guest play gate modal */}
      {createPortal(
        <AnimatePresence>
        {showLoginPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{
              background: 'rgba(0,0,0,0.70)',
              backdropFilter: 'blur(8px)',
              paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            }}
            onClick={() => setShowLoginPrompt(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4 max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto"
              style={{ background: 'rgba(11,16,15,0.98)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Lock className="w-5 h-5 text-white/40" />
              </div>
              <div>
                <h3 className="text-base font-black text-white mb-1">Inicia sesión para escuchar</h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  Crea una cuenta gratis para acceder a todos los podcasts y mixes de POLYFAUNA.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <a href="/login"
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  Iniciar sesión
                </a>
                <a href="/signup"
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
                  Crear cuenta
                </a>
              </div>
              <button type="button" onClick={() => setShowLoginPrompt(false)}
                className="text-xs text-white/25 hover:text-white/50 transition-colors">
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
