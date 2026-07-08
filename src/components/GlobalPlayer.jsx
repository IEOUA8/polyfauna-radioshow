import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ListMusic, Pause, Play, Radio, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayback } from '@/contexts/PlaybackContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { trackUsageEvent } from '@/lib/telemetry';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import HoloSpectrum from '@/components/HoloSpectrum';

// Rutas con su propia página pública/standalone donde el reproductor nunca
// se muestra (sin cambios respecto al comportamiento anterior a moverlo
// fuera de PolyfaunaOS). Todo lo demás — el catch-all de PolyfaunaOS,
// /admin y /dashboard — sí lo muestra, para que la música no se detenga
// al navegar entre esas tres.
const PLAYER_HIDDEN_PREFIXES = [
  '/login', '/signup', '/validate', '/artist/', '/profiles/',
  '/organizadores/', '/music/', '/podcasts/', '/events/', '/entrevistas/', '/e/',
];
function isPlayerHiddenRoute(pathname) {
  return PLAYER_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

// /admin y /dashboard no tienen el layout de PolyfaunaOS (sin su propio
// <audio>) — en esas rutas, y solo en móvil, el reproductor se reduce a un
// disco flotante para no taparle la pantalla al panel operativo/admin,
// sin dejar de sonar.
function isCompactRoute(pathname) {
  return pathname === '/admin' || pathname === '/dashboard';
}

const BASE_STREAM = import.meta.env.VITE_RADIO_STREAM_URL || 'https://ice1.somafm.com/groovesalad-256-mp3';
const QUALITY_STREAMS = {
  auto:   BASE_STREAM,
  high:   import.meta.env.VITE_RADIO_STREAM_HIGH   || BASE_STREAM,
  medium: BASE_STREAM,
  low:    import.meta.env.VITE_RADIO_STREAM_LOW    || BASE_STREAM,
};
const QUALITY_KEY = 'pf_stream_quality';
function getStreamUrl() {
  return QUALITY_STREAMS[localStorage.getItem(QUALITY_KEY) || 'auto'] || BASE_STREAM;
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniSignalBars({ active }) {
  return (
    <div className="flex items-end gap-0.5 h-3.5 shrink-0" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="w-0.5 rounded-full"
          style={{
            background: active ? 'rgba(236,236,236,0.72)' : 'rgba(255,255,255,0.20)',
            height: active ? undefined : '4px',
            animation: active ? `pf-mini-bar 1s ease-in-out ${index * 0.1}s infinite` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export default function GlobalPlayer() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { isPlaying, setIsPlaying, currentTrack, setCurrentTrack, goToSection } = usePlayback();
  const { isFav, toggle: toggleFav } = useFavorites();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const compactEligible = isMobile && isCompactRoute(location.pathname);
  const [discExpanded, setDiscExpanded] = useState(false);

  // Cada vez que se entra a /admin o /dashboard en móvil, arranca
  // colapsado como disco — no debe tapar el panel apenas se navega ahí.
  useEffect(() => {
    if (compactEligible) setDiscExpanded(false);
  }, [location.pathname, compactEligible]);

  const audioRef = useRef(null);
  const repeatRef = useRef(false);
  const queueRef = useRef(null);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState(null);
  const [streamUrl, setStreamUrl] = useState(getStreamUrl);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const { song, isOnline, listeners, isLive, streamerName } = useNowPlaying();

  useEffect(() => {
    const handler = (e) => setTicketModalOpen(!!e.detail?.open);
    window.addEventListener('pf:ticket-modal', handler);
    return () => window.removeEventListener('pf:ticket-modal', handler);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newSrc = currentTrack?.audio_url || streamUrl;
    if (audio.src !== newSrc) {
      audio.src = newSrc;
    }
    setCurrentTime(0);
    setAudioDuration(0);
  }, [currentTrack?.id, streamUrl]);

  useEffect(() => {
    const handler = (e) => {
      const { quality } = e.detail || {};
      const url = QUALITY_STREAMS[quality] || BASE_STREAM;
      setStreamUrl(url);
      const audio = audioRef.current;
      if (!currentTrack && isPlaying && audio) {
        audio.src = url;
        audio.play().catch(() => {});
      }
    };
    window.addEventListener('pf:quality-change', handler);
    return () => window.removeEventListener('pf:quality-change', handler);
  }, [currentTrack, isPlaying]);

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { queueRef.current = playbackQueue; }, [playbackQueue]);

  useEffect(() => {
    const handler = (e) => {
      const { items = [], startIndex = 0 } = e.detail || {};
      const queueItems = items.filter(item => item?.audio_url);
      if (!queueItems.length) return;
      const boundedIndex = Math.max(0, Math.min(startIndex, queueItems.length - 1));
      const nextQueue = { items: queueItems, index: boundedIndex };
      setPlaybackQueue(nextQueue);
      queueRef.current = nextQueue;
      setCurrentTrack?.(queueItems[boundedIndex]);
      setCurrentTime(0);
      setAudioDuration(0);
      setIsPlaying(true);
    };
    window.addEventListener('pf:play-queue', handler);
    return () => window.removeEventListener('pf:play-queue', handler);
  }, [setCurrentTrack, setIsPlaying]);

  useEffect(() => {
    if (!currentTrack || !playbackQueue) return;
    const expected = playbackQueue.items[playbackQueue.index];
    if (!expected || expected.id !== currentTrack.id || expected.audio_url !== currentTrack.audio_url) {
      setPlaybackQueue(null);
      queueRef.current = null;
    }
  }, [currentTrack?.id, currentTrack?.audio_url, playbackQueue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      setStreamError(false);
      audio.play().catch((err) => {
        if (err.name === 'AbortError') return;
        setStreamError(true);
        setIsPlaying(false);
        toast({ title: 'Stream no disponible', description: 'Verifica la URL del stream o el archivo de audio.', variant: 'destructive' });
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate     = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setAudioDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeatRef.current && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        setCurrentTime(0);
        return;
      }
      const queue = queueRef.current;
      const nextIndex = queue ? queue.index + 1 : -1;
      if (queue?.items?.[nextIndex]) {
        const nextQueue = { items: queue.items, index: nextIndex };
        setPlaybackQueue(nextQueue);
        queueRef.current = nextQueue;
        setCurrentTrack?.(queue.items[nextIndex]);
        setIsPlaying(true);
        setCurrentTime(0);
        setAudioDuration(0);
        return;
      }
      setPlaybackQueue(null);
      queueRef.current = null;
      setCurrentTrack?.(null); setIsPlaying(false); setCurrentTime(0); setAudioDuration(0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying(p => !p); }
      if (e.code === 'KeyM')  { setMuted(m => !m); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSeek = (e) => {
    if (!currentTrack || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (audioRef.current) audioRef.current.currentTime = pct * audioDuration;
  };

  const playQueueIndex = (index) => {
    const queue = queueRef.current;
    if (!queue?.items?.[index]) return false;
    const nextQueue = { items: queue.items, index };
    setPlaybackQueue(nextQueue);
    queueRef.current = nextQueue;
    setCurrentTrack?.(queue.items[index]);
    setCurrentTime(0);
    setAudioDuration(0);
    setIsPlaying(true);
    return true;
  };

  const backToRadio = () => {
    setPlaybackQueue(null);
    queueRef.current = null;
    setCurrentTrack?.(null); setIsPlaying(false); setCurrentTime(0); setAudioDuration(0);
  };

  const handleSkipBack = () => {
    if (!isOnDemand || !audioRef.current) return;
    const queue = queueRef.current;
    if (queue?.index > 0 && audioRef.current.currentTime < 3) {
      playQueueIndex(queue.index - 1);
      return;
    }
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const handleSkipForward = () => {
    if (!isOnDemand) return;
    const queue = queueRef.current;
    if (queue?.items?.[queue.index + 1]) {
      playQueueIndex(queue.index + 1);
      return;
    }
    backToRadio();
  };

  const liveTrackKey = `live-${song?.title || 'stream'}`;
  const isLiked = currentUser ? isFav('song', liveTrackKey) : false;

  const handleLike = async () => {
    if (!currentUser) {
      toast({ title: 'Inicia sesión', description: 'Necesitas cuenta para alimentar tu Organismo.' });
      return;
    }
    await toggleFav('song', liveTrackKey);
  };

  const isOnDemand   = Boolean(currentTrack);
  const trackArt     = isOnDemand ? currentTrack.art : (song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop');
  const trackTitle   = isOnDemand ? currentTrack.title : (song?.title || 'PolyFauna Radio');
  const trackSub     = isOnDemand
    ? (currentTrack.artist || currentTrack.album || '')
    : streamError ? 'Error de conexión'
    : song?.artist || (isPlaying ? 'Transmisión en vivo · 24/7' : 'En pausa');
  const progressPct  = isOnDemand && audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  useEffect(() => {
    if (!isPlaying) return;
    trackUsageEvent(isOnDemand ? 'media_start' : 'stream_start', {
      mode: isOnDemand ? 'on_demand' : 'live',
      media_type: currentTrack?.kind || (isOnDemand ? 'track' : 'radio'),
      content_id: currentTrack?.id || null,
    });
  }, [isPlaying, isOnDemand, currentTrack?.id, currentTrack?.kind, currentTrack?.album]);

  // Media Session API — metadata for lock screen
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: trackTitle,
      artist: trackSub,
      album: 'PolyFauna Radio',
      artwork: [{ src: trackArt, sizes: '512x512', type: 'image/jpeg' }],
    });
  }, [trackTitle, trackSub, trackArt]);

  // Media Session API — playback state + action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play',  () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    if (isOnDemand && audioDuration > 0) {
      navigator.mediaSession.setActionHandler('seekbackward', ({ seekOffset = 10 }) => {
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seekOffset);
      });
      navigator.mediaSession.setActionHandler('seekforward', ({ seekOffset = 10 }) => {
        if (audioRef.current) audioRef.current.currentTime = Math.min(audioDuration, audioRef.current.currentTime + seekOffset);
      });
      navigator.mediaSession.setActionHandler('seekto', ({ seekTime }) => {
        if (audioRef.current && seekTime !== undefined) audioRef.current.currentTime = seekTime;
      });
    } else {
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    }
  }, [isPlaying, isOnDemand, audioDuration]);

  // Media Session API — position state (enables lock screen scrubber)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !isOnDemand || audioDuration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audioDuration,
        playbackRate: 1,
        position: Math.min(currentTime, audioDuration),
      });
    } catch (_) {}
  }, [currentTime, audioDuration, isOnDemand]);

  if (isPlayerHiddenRoute(location.pathname)) return null;

  return (
    <>
      <audio ref={audioRef} preload="none" />

      <AnimatePresence mode="wait">
      {compactEligible && !discExpanded ? (
        <motion.div
          key="disc"
          role="button"
          tabIndex={0}
          onClick={() => setDiscExpanded(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDiscExpanded(true); } }}
          aria-label="Mostrar reproductor completo"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="fixed z-50 rounded-full overflow-hidden cursor-pointer"
          style={{
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            right: 16,
            width: 56,
            height: 56,
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          }}
        >
          <img src={trackArt} alt="" className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.32)' }}>
            {isPlaying && (
              <motion.span
                className="absolute rounded-full pointer-events-none"
                style={{ inset: 6, border: '1.5px solid rgba(255,255,255,0.35)' }}
                animate={{ scale: [1, 1.28], opacity: [0.5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir'}
              className="w-8 h-8 rounded-full flex items-center justify-center relative z-10"
              style={{ background: 'rgba(255,255,255,0.92)' }}
            >
              {isPlaying
                ? <Pause className="w-3.5 h-3.5 fill-current" style={{ color: '#080B14' }} />
                : <Play className="w-3.5 h-3.5 fill-current ml-0.5" style={{ color: '#080B14' }} />}
            </button>
          </div>
        </motion.div>
      ) : (
      <motion.div
        key="bar"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={compactEligible ? { y: 40, opacity: 0 } : undefined}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: compactEligible ? 0 : 0.3 }}
        className={`fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] lg:bottom-4 left-3 right-3 md:left-4 md:right-4 lg:left-[256px] xl:right-[304px] z-50 flex flex-col sm:flex-row sm:items-center px-3 sm:px-4 md:px-6 pt-3 pb-2 sm:py-0 sm:h-[76px]${ticketModalOpen ? ' max-lg:hidden' : ''}`}
        style={{
          background: 'rgba(8, 12, 11, 0.75)',
          backdropFilter: 'blur(48px) saturate(220%) brightness(1.1)',
          WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.1)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* ── Row 1: Track Info + Mobile Play ── */}
        <div className="flex items-center gap-2.5 sm:gap-3 sm:flex-1 min-w-0">
          <div className="relative shrink-0">
            {/* Móvil + live → organismo breathing. En /admin y /dashboard
                móvil, tocarlo también vuelve al disco (mismo gesto que la
                portada de abajo, para el caso on-demand). */}
            {!isOnDemand ? (
              <motion.div
                className={`sm:hidden w-10 h-10 flex items-center justify-center shrink-0${compactEligible ? ' cursor-pointer' : ''}`}
                animate={isPlaying ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                onClick={compactEligible ? () => setDiscExpanded(false) : undefined}
                title={compactEligible ? 'Minimizar reproductor' : undefined}
              >
                <img src="/icons/symbol-ui.svg" alt="" className="w-9 h-9 object-contain" draggable={false} />
              </motion.div>
            ) : null}
            {/* Portada — siempre en desktop, solo en on-demand en móvil.
                En /admin y /dashboard móvil, tocarla vuelve al disco. */}
            <div
              className={`${!isOnDemand ? 'hidden sm:block' : ''} w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden${compactEligible ? ' cursor-pointer' : ''}`}
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={compactEligible ? () => setDiscExpanded(false) : undefined}
              title={compactEligible ? 'Minimizar reproductor' : undefined}
            >
              <img src={trackArt} alt="Now playing" className="w-full h-full object-cover" />
            </div>
            {/* Badge ON AIR — desktop */}
            <span
              className="hidden sm:block absolute -top-1.5 -left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{
                background: isPlaying ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                color: isPlaying ? '#ECECEC' : 'rgba(255,255,255,0.35)',
                letterSpacing: '0.05em',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {isPlaying ? 'ON AIR' : 'PAUSED'}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold text-white leading-tight truncate">{trackTitle}</p>
              <MiniSignalBars active={isPlaying} />
            </div>
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{trackSub}</p>
          </div>

          {/* Like / Radio — desktop only */}
          {isOnDemand ? (
            <button
              type="button"
              onClick={backToRadio}
              title="Volver al radio stream"
              className="hidden sm:flex items-center gap-1 text-white/25 hover:text-white/60 transition-colors p-1 text-[10px] font-bold uppercase tracking-wider shrink-0"
            >
              <Radio className="w-3.5 h-3.5" />
              Radio
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLike}
              className="hidden sm:flex transition-colors p-1 shrink-0"
              style={{ color: isLiked ? '#FF5C7A' : 'rgba(255,255,255,0.25)' }}
              title={isLiked ? 'Quitar del Organismo' : 'Agregar al Organismo'}
            >
              <Heart className="w-4 h-4" style={isLiked ? { fill: '#FF5C7A' } : {}} />
            </button>
          )}

          {/* Play button — mobile only, inline with info */}
          <div className="sm:hidden relative flex items-center justify-center shrink-0 ml-1">
            {isPlaying && (
              <motion.span
                className="absolute rounded-full pointer-events-none"
                style={{ inset: -6, border: '1.5px solid rgba(255,255,255,0.18)' }}
                animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir'}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
              style={{
                background: '#ECECEC',
                boxShadow: isPlaying
                  ? '0 0 18px rgba(255,255,255,0.22), 0 4px 12px rgba(0,0,0,0.4)'
                  : '0 4px 10px rgba(0,0,0,0.3)',
              }}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
                : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: '#080B14' }} />
              }
            </button>
          </div>
        </div>

        {/* ── Row 2 (mobile only): progress bar + spectrum ── */}
        <div className="sm:hidden flex flex-col gap-1.5 mt-2 w-full">
          {isOnDemand && audioDuration > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
              <span className="tabular-nums">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-[3px] rounded-full overflow-hidden cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                onClick={handleSeek}
                onTouchStart={handleSeek}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background: '#ECECEC',
                    transition: 'width 0.25s linear',
                  }}
                />
              </div>
              <span className="tabular-nums">{formatTime(audioDuration || currentTrack?.duration)}</span>
            </div>
          )}
          <HoloSpectrum isPlaying={isPlaying} height={18} fillWidth className="w-full" />
        </div>

        {/* ── Desktop Controls (center) ── */}
        <div className="hidden sm:flex flex-col items-center gap-1 flex-1">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setShuffle(s => !s)}
              className="hidden md:flex transition-colors"
              title={shuffle ? 'Aleatorio activo' : 'Aleatorio'}
              style={{ color: shuffle ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.20)' }}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSkipBack}
              className="flex transition-colors"
              title="Reiniciar pista"
              style={{ color: isOnDemand ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.10)', cursor: isOnDemand ? 'pointer' : 'default' }}
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play button — desktop */}
            <div className="relative flex items-center justify-center">
              {isPlaying && (
                <motion.span
                  className="absolute rounded-full pointer-events-none"
                  style={{ inset: -6, border: '1.5px solid rgba(255,255,255,0.18)' }}
                  animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir'}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
                style={{
                  background: '#ECECEC',
                  boxShadow: isPlaying
                    ? '0 0 18px rgba(255,255,255,0.22), 0 4px 12px rgba(0,0,0,0.4)'
                    : '0 4px 10px rgba(0,0,0,0.3)',
                }}
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
                  : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: '#080B14' }} />
                }
              </button>
            </div>

            <button
              type="button"
              onClick={handleSkipForward}
              className="flex transition-colors"
              title={queueRef.current?.items?.[queueRef.current?.index + 1] ? 'Siguiente' : isOnDemand ? 'Volver al radio' : undefined}
              style={{ color: isOnDemand ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.10)', cursor: isOnDemand ? 'pointer' : 'default' }}
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setRepeat(r => !r)}
              className="hidden md:flex transition-colors"
              title={repeat ? 'Repetir activo' : 'Repetir'}
              style={{ color: repeat ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.20)' }}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar — desktop */}
          <div className="flex w-full max-w-sm items-center gap-2 text-[11px] text-white/30 font-medium">
            {isOnDemand ? (
              <>
                <span className="tabular-nums">{formatTime(currentTime)}</span>
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: '#ECECEC',
                      transition: 'width 0.25s linear',
                    }}
                  />
                </div>
                <span className="tabular-nums">{formatTime(audioDuration || currentTrack?.duration)}</span>
              </>
            ) : (
              <>
                <span>{isPlaying ? 'LIVE' : '——'}</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  {isPlaying && (
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'rgba(255,255,255,0.8)' }}
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
                <span>∞</span>
              </>
            )}
          </div>
        </div>

        {/* ── Volume — desktop ── */}
        <div className="flex-1 hidden md:flex justify-end items-center gap-3">
          <button type="button" onClick={() => setMuted(!muted)} className="text-white/25 hover:text-white/55 transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative w-24">
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
              className="w-full h-1 cursor-pointer appearance-none rounded-full"
              style={{ accentColor: 'rgba(255,255,255,0.9)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => { if (!goToSection('podcasts')) navigate('/?section=podcasts'); }}
            className="ml-2 text-white/25 hover:text-white/55 transition-colors"
            title="Ver podcasts"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
