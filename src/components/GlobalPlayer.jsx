import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ListMusic, Pause, Play, Radio, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayback } from '@/contexts/PlaybackContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useActiveRadioSet } from '@/hooks/useActiveRadioSet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { trackUsageEvent } from '@/lib/telemetry';
import { getStreamReconnectDelay, isPlaybackPermissionError, STREAM_STALL_TIMEOUT_MS } from '@/lib/streamRecovery';
import { EDITORIAL_ACCENT, editorialAccent } from '@/lib/editorialTheme';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import HoloSpectrum from '@/components/HoloSpectrum';

// Rutas con su propia página pública/standalone donde el reproductor nunca
// se muestra (sin cambios respecto al comportamiento anterior a moverlo
// fuera de PolyfaunaOS). Todo lo demás — el catch-all de PolyfaunaOS,
// /admin y /dashboard — sí lo muestra, para que la música no se detenga
// al navegar entre esas tres.
const PLAYER_HIDDEN_PREFIXES = [
  '/login', '/signup', '/validate', '/artist/', '/profiles/',
  '/organizadores/', '/music/', '/events/', '/entrevistas/', '/e/',
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
const HIGH_STREAM = import.meta.env.VITE_RADIO_STREAM_HIGH || BASE_STREAM;
const MEDIUM_STREAM = import.meta.env.VITE_RADIO_STREAM_MEDIUM || BASE_STREAM;
const LOW_STREAM = import.meta.env.VITE_RADIO_STREAM_LOW || MEDIUM_STREAM;
const QUALITY_STREAMS = {
  auto:   MEDIUM_STREAM,
  high:   HIGH_STREAM,
  medium: MEDIUM_STREAM,
  low:    LOW_STREAM,
};
const QUALITY_KEY = 'pf_stream_quality';
const FLOATING_PLAY_BACKGROUND = `linear-gradient(135deg, #E4BD74, ${EDITORIAL_ACCENT})`;
function getSelectedQuality() {
  return localStorage.getItem(QUALITY_KEY) || 'auto';
}
function getStreamUrl() {
  return QUALITY_STREAMS[getSelectedQuality()] || MEDIUM_STREAM;
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
  const { radioSet, liked: isSetLiked, toggleLike: toggleSetLike } = useActiveRadioSet();
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
  const currentTrackRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const stallTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const streamIssueStartedAtRef = useRef(null);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState('idle');
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
      const url = QUALITY_STREAMS[quality] || MEDIUM_STREAM;
      setStreamUrl(url);
    };
    window.addEventListener('pf:quality-change', handler);
    return () => window.removeEventListener('pf:quality-change', handler);
  }, []);

  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { queueRef.current = playbackQueue; }, [playbackQueue]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

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
    if (!playbackQueue) return;
    if (!currentTrack) {
      setPlaybackQueue(null);
      queueRef.current = null;
      return;
    }
    const expected = playbackQueue.items[playbackQueue.index];
    if (!expected || expected.id !== currentTrack.id || expected.audio_url !== currentTrack.audio_url) {
      setPlaybackQueue(null);
      queueRef.current = null;
    }
  }, [currentTrack?.id, currentTrack?.audio_url, playbackQueue]);

  // isPlaying representa la intención del usuario. El estado técnico vive en
  // playbackStatus y un fallo transitorio del stream no apaga esa intención.
  // Para radio en vivo se recuperan pausas ajenas, stalls, errores y finales
  // de conexión con backoff. Los archivos on-demand conservan su semántica.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let disposed = false;
    const isLiveStream = !currentTrack;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const clearStallTimer = () => {
      if (stallTimerRef.current !== null) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    const streamProperties = (extra = {}) => ({
      mode: 'live',
      quality: getSelectedQuality(),
      network_type: navigator.connection?.effectiveType || 'unknown',
      ...extra,
    });

    const handleTerminalPlaybackError = (reason = 'terminal_error') => {
      if (isLiveStream) {
        trackUsageEvent('stream_failed', streamProperties({
          reason,
          attempt: reconnectAttemptRef.current,
          duration_ms: streamIssueStartedAtRef.current ? Date.now() - streamIssueStartedAtRef.current : 0,
        }));
      }
      setPlaybackStatus('error');
      setStreamError(true);
      setIsPlaying(false);
      toast({ title: 'Audio no disponible', description: 'Verifica la conexión o el archivo de audio.', variant: 'destructive' });
    };

    const scheduleReconnect = (reason, immediate = false) => {
      if (disposed || !isPlaying || !isLiveStream || reconnectTimerRef.current !== null) return;
      clearStallTimer();
      reconnectInFlightRef.current = false;

      const attempt = reconnectAttemptRef.current;
      const delay = immediate ? 0 : getStreamReconnectDelay(attempt);
      if (!streamIssueStartedAtRef.current) streamIssueStartedAtRef.current = Date.now();
      setPlaybackStatus('retrying');
      setStreamError(true);
      trackUsageEvent('stream_reconnect_attempt', streamProperties({
        reason,
        attempt: attempt + 1,
        delay_ms: delay,
      }));

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (disposed || !isPlaying || currentTrack) return;

        reconnectAttemptRef.current += 1;
        const shouldUseLowFallback = getSelectedQuality() === 'auto'
          && reconnectAttemptRef.current >= 3
          && LOW_STREAM !== streamUrl;
        const reconnectUrl = shouldUseLowFallback ? LOW_STREAM : streamUrl;
        reconnectInFlightRef.current = true;
        setPlaybackStatus('connecting');

        if (shouldUseLowFallback) setStreamUrl(LOW_STREAM);

        // Fuerza una conexión HTTP nueva al mount de Icecast. El guard evita
        // que el pause producido por esta recarga programe otro reintento.
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audio.src = reconnectUrl;
        audio.load();
        audio.play().catch((error) => {
          reconnectInFlightRef.current = false;
          if (disposed || error?.name === 'AbortError') return;
          if (isPlaybackPermissionError(error)) {
            handleTerminalPlaybackError('playback_permission');
            return;
          }
          scheduleReconnect(reason);
        });
      }, delay);
    };

    const onPlaying = () => {
      const attempts = reconnectAttemptRef.current;
      const issueStartedAt = streamIssueStartedAtRef.current;
      clearReconnectTimer();
      clearStallTimer();
      reconnectAttemptRef.current = 0;
      reconnectInFlightRef.current = false;
      setStreamError(false);
      setPlaybackStatus('playing');
      if (isLiveStream) {
        trackUsageEvent(issueStartedAt || attempts > 0 ? 'stream_recovered' : 'stream_playing', streamProperties({
          attempt: attempts,
          duration_ms: issueStartedAt ? Date.now() - issueStartedAt : 0,
        }));
        streamIssueStartedAtRef.current = null;
      }
    };
    const onWaiting = () => {
      if (!isPlaying || !isLiveStream) return;
      setPlaybackStatus('buffering');
      if (stallTimerRef.current !== null) return;
      if (!streamIssueStartedAtRef.current) streamIssueStartedAtRef.current = Date.now();
      trackUsageEvent('stream_stalled', streamProperties({ reason: 'waiting' }));
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = null;
        scheduleReconnect('stall_timeout', true);
      }, STREAM_STALL_TIMEOUT_MS);
    };
    const onStalled = () => {
      if (!isPlaying || !isLiveStream) return;
      setPlaybackStatus('buffering');
      onWaiting();
    };
    const onError = () => {
      if (!isPlaying) return;
      if (isLiveStream) scheduleReconnect('media_error');
      else handleTerminalPlaybackError('media_error');
    };
    const onPause = () => {
      if (isPlaying && isLiveStream && !reconnectInFlightRef.current) scheduleReconnect('unexpected_pause');
    };
    const onLiveEnded = () => {
      if (isPlaying && isLiveStream) scheduleReconnect('stream_ended', true);
    };
    const onOnline = () => {
      if (isPlaying && isLiveStream && audio.paused) scheduleReconnect('network_online', true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && isLiveStream && audio.paused) {
        scheduleReconnect('visibility_resume', true);
      }
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onLiveEnded);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (isPlaying) {
      setStreamError(false);
      setPlaybackStatus('connecting');
      if (isLiveStream) trackUsageEvent('stream_connecting', streamProperties());
      audio.play().catch((error) => {
        if (disposed || error?.name === 'AbortError') return;
        if (isLiveStream && !isPlaybackPermissionError(error)) scheduleReconnect('play_error');
        else handleTerminalPlaybackError(isPlaybackPermissionError(error) ? 'playback_permission' : 'play_error');
      });
    } else {
      clearReconnectTimer();
      clearStallTimer();
      reconnectAttemptRef.current = 0;
      reconnectInFlightRef.current = false;
      streamIssueStartedAtRef.current = null;
      setPlaybackStatus('idle');
      audio.pause();
    }

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearStallTimer();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onLiveEnded);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentTrack?.id, currentTrack?.audio_url, isPlaying, setIsPlaying, streamUrl, toast]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate     = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setAudioDuration(audio.duration || 0);
    const onEnded = () => {
      // El stream en vivo se recupera en el efecto de resiliencia; esta
      // lógica corresponde exclusivamente a archivos y colas on-demand.
      if (!currentTrackRef.current) return;
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

  const favoriteType = currentTrack?.kind === 'podcast' ? 'podcast' : 'track';
  const isLiked = currentUser && currentTrack ? isFav(favoriteType, currentTrack.id) : false;

  const handleLike = async () => {
    if (!currentUser) {
      toast({ title: 'Inicia sesión', description: 'Necesitas cuenta para alimentar tu Organismo.' });
      return;
    }
    if (currentTrack) {
      await toggleFav(favoriteType, currentTrack.id);
      return;
    }
    if (!radioSet) {
      toast({ title: 'Sin set programado', description: 'El corazón se habilita cuando hay un programa radial activo.' });
      return;
    }
    const { error } = await toggleSetLike();
    if (error) toast({ title: 'No se pudo registrar', description: error.message, variant: 'destructive' });
  };

  const isOnDemand   = Boolean(currentTrack);
  const trackArt     = isOnDemand ? currentTrack.art : (song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop');
  const trackTitle   = isOnDemand ? currentTrack.title : (song?.title || 'PolyFauna Radio');
  const trackSub     = isOnDemand
    ? (currentTrack.artist || currentTrack.album || '')
    : playbackStatus === 'buffering' ? 'Esperando señal…'
    : playbackStatus === 'retrying' || playbackStatus === 'connecting' ? 'Reconectando…'
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

  const playerHidden = isPlayerHiddenRoute(location.pathname);

  return (
    <>
      <audio ref={audioRef} preload="none" />

      {!playerHidden && <>

      {/* Sin mode="wait": barra y disco animan a la vez (ambos "fixed", no
          hay salto de layout) en vez de encadenar salida+entrada, para no
          sumar más trabajo de animación justo cuando /admin monta de golpe
          en móvil. */}
      <AnimatePresence>
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
            // 78px despeja la barra de navegación rápida propia de
            // /admin (MobileOperationsDock, ~64px) para no tapar su botón
            // "Menú" — el disco solo existe en rutas que tienen esa barra.
            bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
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
                style={{ inset: 6, border: `1.5px solid ${editorialAccent(0.55)}` }}
                animate={{ scale: [1, 1.28], opacity: [0.5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir'}
              className="w-8 h-8 rounded-full flex items-center justify-center relative z-10"
              style={{ background: FLOATING_PLAY_BACKGROUND }}
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
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleLike}
                className="flex transition-colors p-1 shrink-0"
                style={{ color: isLiked ? '#FF5C7A' : 'rgba(255,255,255,0.25)' }}
                title={isLiked ? 'Quitar de Tu música' : 'Agregar a Tu música'}
              >
                <Heart className="w-4 h-4" style={isLiked ? { fill: '#FF5C7A' } : {}} />
              </button>
              <button
              type="button"
              onClick={backToRadio}
              title="Volver al radio stream"
              className="flex items-center gap-1 text-white/25 hover:text-white/60 transition-colors p-1 text-[10px] font-bold uppercase tracking-wider shrink-0"
            >
              <Radio className="w-3.5 h-3.5" />
              Radio
              </button>
            </div>
          ) : radioSet ? (
            <button
              type="button"
              onClick={handleLike}
              className="hidden sm:flex transition-colors p-1 shrink-0"
              style={{ color: isSetLiked ? '#FF5C7A' : 'rgba(255,255,255,0.25)' }}
              title={`${radioSet.likes_count || 0} corazones en este set`}
            >
              <Heart className="w-4 h-4" style={isSetLiked ? { fill: '#FF5C7A' } : {}} />
            </button>
          ) : null}

          {/* Play button — mobile only, inline with info */}
          <div className="sm:hidden relative flex items-center justify-center shrink-0 ml-1">
            {isPlaying && (
              <motion.span
                className="absolute rounded-full pointer-events-none"
                style={{ inset: -6, border: `1.5px solid ${editorialAccent(0.38)}` }}
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
                background: FLOATING_PLAY_BACKGROUND,
                boxShadow: isPlaying
                  ? `0 0 18px ${editorialAccent(0.30)}, 0 4px 12px rgba(0,0,0,0.4)`
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
              aria-label="Reiniciar pista"
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
                  style={{ inset: -6, border: `1.5px solid ${editorialAccent(0.38)}` }}
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
                  background: FLOATING_PLAY_BACKGROUND,
                  boxShadow: isPlaying
                    ? `0 0 18px ${editorialAccent(0.30)}, 0 4px 12px rgba(0,0,0,0.4)`
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
              aria-label={queueRef.current?.items?.[queueRef.current?.index + 1] ? 'Siguiente' : isOnDemand ? 'Volver al radio' : 'Siguiente no disponible en radio en vivo'}
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
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Activar volumen' : 'Silenciar'}
            className="text-white/25 hover:text-white/55 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative w-24">
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={muted ? 0 : volume}
              aria-label="Volumen"
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
      </>}
    </>
  );
}
