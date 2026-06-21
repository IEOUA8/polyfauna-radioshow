import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock, Headphones, Heart, Link2, MessageCircle, Pause, Play, Plus, Send } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useLikes } from '@/hooks/useLikes';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import UploadPodcastModal from '@/components/UploadPodcastModal';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop';

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
  if (!genre) return 'rgba(255,255,255,0.9)';
  return GENRE_COLORS[genre.toLowerCase()] || 'rgba(255,255,255,0.9)';
}

function fmtDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(Number(secs) / 3600);
  const m = Math.floor((Number(secs) % 3600) / 60);
  const s = Number(secs) % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CREATOR_ROLES = ['artist', 'club', 'promoter', 'admin'];

/* ─────────────────────────────────────────
   Podcast detail view
───────────────────────────────────────── */
function PodcastDetail({ pod, onBack, onPlay, isActive, isCurrentlyPlaying, isLiked, onLike, currentUser }) {
  const gColor = getGenreColor(pod.genre);
  const dateStr = new Date(pod.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const [likesCount, setLikesCount]       = useState(0);
  const [comments, setComments]           = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const inputRef = useRef(null);

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
        <div className="shrink-0">
          <div className="relative w-full lg:w-72 xl:w-80 aspect-square rounded-2xl overflow-hidden"
            style={{ boxShadow: `0 24px 64px ${gColor}30, 0 8px 32px rgba(0,0,0,0.6)` }}>
            <img src={pod.cover_url || FALLBACK_IMG} alt={pod.title} className="w-full h-full object-cover" />
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
            <h1 className="text-3xl font-black text-white leading-tight">{pod.title}</h1>
            <p className="text-lg mt-1.5 font-medium" style={{ color: gColor }}>
              {pod.artists?.name || 'PolyFauna'}
            </p>
          </div>

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
          <div className="flex items-center gap-3 pt-1">
            <motion.button
              type="button"
              onClick={onPlay}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-black"
              style={{
                background: `linear-gradient(135deg, ${gColor}, ${gColor}BB)`,
                color: '#080B14',
                boxShadow: `0 0 28px ${gColor}45, 0 4px 16px rgba(0,0,0,0.4)`,
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
                const url = window.location.href;
                const shareText = `${pod.title} — ${pod.artists?.name || 'PolyFauna'} | PolyFauna Radio`;
                if (navigator.share) {
                  await navigator.share({ title: shareText, url });
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

          {/* Description */}
          {pod.description && (
            <div className="mt-2 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Descripción
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {pod.description}
              </p>
            </div>
          )}
        </div>
      </div>

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

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none -z-10"
        style={{ background: `radial-gradient(ellipse at 30% 20%, ${gColor}08 0%, transparent 55%)` }} />
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   Main page
───────────────────────────────────────── */
export default function PodcastsPage({ setCurrentTrack, setIsPlaying, currentTrack, isPlaying }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [activeGenre, setActiveGenre] = useState('All');
  const [selectedPod, setSelectedPod] = useState(null);
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

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'podcasts') return;
      const inList = (podcasts || []).find(p => p.id === id);
      if (inList) { setSelectedPod(inList); return; }
      const { data } = await supabase.from('podcasts').select('*, artists(name)').eq('id', id).single();
      if (data) setSelectedPod(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [podcasts]);

  const handlePlay = (pod) => {
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
      <AnimatePresence mode="wait">

        {/* ── Detail view ── */}
        {selectedPod ? (
          <PodcastDetail
            key="detail"
            pod={selectedPod}
            onBack={() => setSelectedPod(null)}
            onPlay={() => handlePlay(selectedPod)}
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
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-black text-white">Podcasts</h1>
                <p className="text-sm text-white/40 mt-1">Sesiones y mixes curados de la comunidad.</p>
              </div>
              {isCreator && (
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 shrink-0"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#7C5CFF)', color: '#fff', boxShadow: '0 0 16px rgba(167,139,250,0.3)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Subir
                </button>
              )}
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

            {/* ── Podcast grid ── */}
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
                      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
                      style={{
                        background: 'rgba(11, 16, 15, 0.90)',
                        border: `1px solid ${isActive ? `${gColor}40` : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: isActive ? `0 0 20px ${gColor}18` : 'none',
                        transition: 'border-color 0.3s, box-shadow 0.3s',
                      }}
                      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 350, damping: 22 } }}
                      onClick={() => setSelectedPod(pod)}
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

                        {/* Play button overlay */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handlePlay(pod); }}
                          className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                            style={{ background: gColor, boxShadow: `0 0 30px ${gColor}80` }}
                          >
                            {isCurrentlyPlaying
                              ? <Pause className="w-6 h-6 fill-current" style={{ color: '#080B14' }} />
                              : <Play className="w-6 h-6 ml-0.5 fill-current" style={{ color: '#080B14' }} />
                            }
                          </div>
                        </button>

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
                              <span className="text-[11px] text-white/30">{fmtDuration(pod.duration)}</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLike(pod.id);
                                if (!isLiked(pod.id)) {
                                  toast({
                                    title: pod.title,
                                    description: 'Guardado en tu biblioteca',
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
          </motion.div>
        )}
      </AnimatePresence>

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
