import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ListMusic, Pause, Play, Radio, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';

const STREAM_URL = import.meta.env.VITE_RADIO_STREAM_URL || 'https://ice1.somafm.com/groovesalad-256-mp3';

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GlobalPlayer({ isPlaying, setIsPlaying, currentTrack, setCurrentTrack }) {
  const { toast } = useToast();
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const { song, isOnline, listeners, isLive, streamerName } = useNowPlaying();

  useEffect(() => {
    if (audioRef.current) audioRef.current.src = STREAM_URL;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(0);
    setAudioDuration(0);
    audio.src = currentTrack?.audio_url || STREAM_URL;
  }, [currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      setStreamError(false);
      audio.play().catch(() => {
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
    const onTimeUpdate    = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setAudioDuration(audio.duration || 0);
    const onEnded         = () => { setCurrentTrack?.(null); setIsPlaying(false); setCurrentTime(0); setAudioDuration(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const handleSeek = (e) => {
    if (!currentTrack || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current) audioRef.current.currentTime = pct * audioDuration;
  };

  const backToRadio = () => { setCurrentTrack?.(null); setIsPlaying(false); setCurrentTime(0); setAudioDuration(0); };
  const noop = () => toast({ title: 'Próximamente', description: 'Disponible en la versión completa.' });

  const isOnDemand   = Boolean(currentTrack);
  const trackArt     = isOnDemand ? currentTrack.art : (song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop');
  const trackTitle   = isOnDemand ? currentTrack.title : (song?.title || 'PolyFauna Radio');
  const trackSub     = isOnDemand
    ? (currentTrack.artist || currentTrack.album || '')
    : streamError ? 'Error de conexión'
    : song?.artist || (isPlaying ? 'Transmisión en vivo · 24/7' : 'En pausa');
  const progressPct  = isOnDemand && audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <>
      <audio ref={audioRef} preload="none" />

      {/* Top border gradient line */}
      <div
        className="fixed bottom-[72px] left-0 right-0 z-50 h-px pointer-events-none"
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(0,207,255,0.3) 25%, rgba(123,92,240,0.25) 60%, rgba(236,72,153,0.2) 85%, transparent 100%)' }}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center px-4 md:px-6"
        style={{
          background: 'rgba(6, 8, 18, 0.96)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Track Info ── */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-12 h-12 rounded-xl overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: isPlaying ? '0 0 16px rgba(0,207,255,0.2)' : 'none',
              }}
            >
              <img src={trackArt} alt="Now playing" className="w-full h-full object-cover" />
            </div>
            <motion.span
              animate={{ opacity: isPlaying ? [1, 0.4, 1] : 1 }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="absolute -top-1.5 -left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{
                background: isPlaying
                  ? 'linear-gradient(90deg, #00CFFF, #00AADD)'
                  : 'rgba(255,255,255,0.15)',
                color: '#080B14',
                letterSpacing: '0.05em',
                boxShadow: isPlaying ? '0 0 8px rgba(0,207,255,0.5)' : 'none',
              }}
            >
              {isPlaying ? 'ON AIR' : 'PAUSED'}
            </motion.span>
          </div>

          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold text-white leading-tight truncate">{trackTitle}</p>
            <p className="text-xs text-white/35 truncate">{trackSub}</p>
          </div>

          {isOnDemand ? (
            <button
              type="button"
              onClick={backToRadio}
              title="Volver al radio stream"
              className="hidden sm:flex items-center gap-1 text-white/25 hover:text-white/60 transition-colors p-1 text-[10px] font-bold uppercase tracking-wider"
            >
              <Radio className="w-3.5 h-3.5" />
              Radio
            </button>
          ) : (
            <button type="button" onClick={noop} className="hidden sm:flex text-white/25 hover:text-white/50 transition-colors p-1">
              <Heart className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="flex items-center gap-3 md:gap-4">
            <button type="button" onClick={noop} className="hidden md:flex text-white/20 hover:text-white/50 transition-colors">
              <Shuffle className="w-4 h-4" />
            </button>
            <button type="button" onClick={noop} className="text-white/35 hover:text-white/70 transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play button */}
            <div className="relative flex items-center justify-center">
              {isPlaying && (
                <motion.span
                  className="absolute rounded-full pointer-events-none"
                  style={{ inset: -6, border: '1.5px solid rgba(0,207,255,0.3)' }}
                  animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #00CFFF, #00AADD)',
                  boxShadow: isPlaying
                    ? '0 0 24px rgba(0,207,255,0.5), 0 4px 12px rgba(0,0,0,0.4)'
                    : '0 0 14px rgba(0,207,255,0.25), 0 4px 10px rgba(0,0,0,0.3)',
                }}
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
                  : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: '#080B14' }} />
                }
              </button>
            </div>

            <button type="button" onClick={isOnDemand ? backToRadio : noop} className="text-white/35 hover:text-white/70 transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button type="button" onClick={noop} className="hidden md:flex text-white/20 hover:text-white/50 transition-colors">
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-sm flex items-center gap-2 text-[11px] text-white/30 font-medium">
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
                      background: 'linear-gradient(to right, #00CFFF, #7B5CF0)',
                      boxShadow: '0 0 6px rgba(0,207,255,0.4)',
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
                      style={{ background: 'linear-gradient(to right, #00CFFF, #7B5CF0, #EC4899)' }}
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

        {/* ── Volume ── */}
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
              style={{ accentColor: '#00CFFF' }}
            />
          </div>
          <button type="button" onClick={noop} className="ml-2 text-white/25 hover:text-white/55 transition-colors">
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
