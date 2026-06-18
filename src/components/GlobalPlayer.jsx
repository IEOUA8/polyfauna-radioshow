import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ListMusic, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';

const STREAM_URL = import.meta.env.VITE_RADIO_STREAM_URL || 'https://ice1.somafm.com/groovesalad-256-mp3';

export default function GlobalPlayer({ isPlaying, setIsPlaying }) {
  const { toast } = useToast();
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(0.75);
  const [muted, setMuted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const { song, isOnline, listeners, isLive, streamerName } = useNowPlaying();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      setStreamError(false);
      audio.play().catch(() => {
        setStreamError(true);
        setIsPlaying(false);
        toast({ title: 'Stream no disponible', description: 'Verifica la URL del stream en .env → VITE_RADIO_STREAM_URL', variant: 'destructive' });
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const noop = () => toast({ title: 'Próximamente', description: 'Disponible en la versión completa.' });

  return (
    <>
      <audio ref={audioRef} src={STREAM_URL} preload="none" crossOrigin="anonymous" />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center px-4 md:px-6 border-t"
        style={{
          background: 'rgba(8, 11, 22, 0.97)',
          backdropFilter: 'blur(24px)',
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Track Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <img
                src={song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop'}
                alt="Now playing"
                className="w-full h-full object-cover"
              />
            </div>
            <motion.span
              animate={{ opacity: isPlaying ? [1, 0.5, 1] : 1 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -top-1.5 -left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{
                background: isPlaying ? '#00CFFF' : 'rgba(255,255,255,0.2)',
                color: '#080B14',
                letterSpacing: '0.05em',
              }}
            >
              {isPlaying ? 'ON AIR' : 'PAUSED'}
            </motion.span>
          </div>

          <div className="min-w-0 hidden sm:block">
            <p className="text-sm font-bold text-white leading-tight truncate">
              {song?.title || 'PolyFauna Radio'}
            </p>
            <p className="text-xs text-white/40 truncate">
              {streamError
                ? 'Error de conexión'
                : song?.artist
                  ? song.artist
                  : isPlaying
                    ? 'Transmisión en vivo · 24/7'
                    : 'En pausa'}
            </p>
          </div>

          <button type="button" onClick={noop} className="hidden sm:flex text-white/30 hover:text-white/60 transition-colors p-1">
            <Heart className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <div className="flex items-center gap-3 md:gap-4">
            <button type="button" onClick={noop} className="hidden md:flex text-white/30 hover:text-white/60 transition-colors">
              <Shuffle className="w-4 h-4" />
            </button>
            <button type="button" onClick={noop} className="text-white/50 hover:text-white/80 transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-lg"
              style={{ background: '#00CFFF', boxShadow: '0 0 20px rgba(0,207,255,0.3)' }}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
                : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: '#080B14' }} />
              }
            </button>

            <button type="button" onClick={noop} className="text-white/50 hover:text-white/80 transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button type="button" onClick={noop} className="hidden md:flex text-white/30 hover:text-white/60 transition-colors">
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar — live stream, no seek */}
          <div className="w-full max-w-sm flex items-center gap-2 text-[11px] text-white/35 font-medium">
            <span>{isPlaying ? 'LIVE' : '——'}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              {isPlaying && (
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: '#00CFFF' }}
                  animate={{ width: ['0%', '100%'] }}
                  transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </div>
            <span>∞</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex-1 hidden md:flex justify-end items-center gap-3">
          <button type="button" onClick={() => setMuted(!muted)} className="text-white/30 hover:text-white/60 transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
            className="w-24 h-1 accent-[#00CFFF] cursor-pointer"
            style={{ accentColor: '#00CFFF' }}
          />
          <button type="button" onClick={noop} className="ml-2 text-white/30 hover:text-white/60 transition-colors">
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
