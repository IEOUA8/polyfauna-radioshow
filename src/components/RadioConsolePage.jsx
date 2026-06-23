import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Loader2, MessageCircle, Pause, Play, Radio, Share2, Tv2, User, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import HoloSpectrum from '@/components/HoloSpectrum';
import FormModal, { FField, FTextarea, FSubmit } from '@/components/ui/FormModal';

export default function RadioConsolePage({ isPlaying, setIsPlaying }) {
  const { toast } = useToast();
  const { song, isOnline, listeners, isLive, streamerName } = useNowPlaying();
  const { currentUser } = useAuth();
  const { isFav, toggle: toggleFav } = useFavorites();

  const [showAskHost, setShowAskHost] = useState(false);
  const [hostQuestion, setHostQuestion] = useState('');
  const [sendingQuestion, setSendingQuestion] = useState(false);

  const sessionFavId = `live-${song?.title || 'polyfauna-radio'}-${new Date().toISOString().slice(0, 10)}`;
  const isSessionSaved = Boolean(currentUser && isFav('session', sessionFavId));

  const handleShare = async () => {
    const shareData = {
      title: song?.title || 'PolyFauna Radio',
      text: `Escuchando ${song?.title || 'PolyFauna Radio'} en PolyFauna`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copiado', description: 'URL copiada al portapapeles.' });
    }
  };

  const handleSaveSession = async () => {
    if (!currentUser) {
      toast({ title: 'Inicia sesión', description: 'Necesitas una cuenta para guardar sesiones.' });
      return;
    }
    const wasSaved = isFav('session', sessionFavId);
    await toggleFav('session', sessionFavId);
    toast({
      title: wasSaved ? 'Sesión retirada' : 'Sesión agregada al Organismo',
      description: wasSaved ? '' : `"${song?.title || 'PolyFauna Radio'}" vive ahora en tu Organismo.`,
    });
  };

  const handleAskHost = () => {
    if (!currentUser) {
      toast({ title: 'Inicia sesión', description: 'Necesitas una cuenta para preguntar al host.' });
      return;
    }
    setShowAskHost(true);
  };

  const handleSendQuestion = async (e) => {
    e.preventDefault();
    if (!hostQuestion.trim()) return;
    setSendingQuestion(true);
    const { error } = await supabase.from('show_questions').insert({
      user_id: currentUser.id,
      user_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuario',
      show_name: song?.title || 'Live Session',
      question: hostQuestion.trim(),
    });
    setSendingQuestion(false);
    if (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '¡Pregunta enviada!', description: 'El host podrá verla en su dashboard.' });
      setHostQuestion('');
      setShowAskHost(false);
    }
  };

  const handleOpenRoom = () => {
    const roomUrl = song?.room_url || null;
    if (roomUrl) {
      window.open(roomUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast({ title: 'Sin sala activa', description: 'No hay sala en vivo disponible en este momento.' });
    }
  };

  const { data: shows, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('radio_shows').select('*').order('schedule', { ascending: true }).limit(8),
    []
  );

  return (
    <div className="p-5 space-y-6">

      {/* ── Now Playing card — forest-dark glass ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="holo-border rounded-2xl overflow-hidden p-4 md:p-6 relative"
        style={{
          background: 'rgba(13, 20, 19, 0.54)',
          backdropFilter: 'blur(40px) saturate(190%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(40px) saturate(190%) brightness(1.06)',
          border: '1px solid rgba(184,207,166,0.09)',
          boxShadow:
            '0 16px 56px rgba(0,0,0,0.65), ' +
            'inset 0 1px 0 rgba(255,255,255,0.06), ' +
            'inset 0 -1px 0 rgba(0,0,0,0.20)',
        }}
      >
        {/* Background glow behind album art */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop'})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.06,
            filter: 'blur(50px)',
            transform: 'scale(1.3)',
          }}
        />

        {/* Fractal wave texture */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 900 320"
          fill="none"
          aria-hidden="true"
        >
          <path d="M -60 180 C 80 100 260 260 460 160 S 700 60 960 180 L 960 240 C 720 130 480 300 280 200 S 60 120 -60 240 Z"
            fill="rgba(189,207,170,0.055)" />
          <path d="M -60 100 C 120 40 320 180 540 90 S 780 10 960 110 L 960 155 C 770 55 570 195 350 110 S 110 50 -60 145 Z"
            fill="rgba(142,158,131,0.042)" />
          <path d="M -60 240 C 100 170 300 320 520 220 S 760 130 960 250 L 960 320 L -60 320 Z"
            fill="rgba(106,140,92,0.032)" />
          <path d="M -60 55 C 150 10 370 130 580 50 S 800 -20 960 65 L 960 100 C 760 -5 540 120 330 55 S 100 20 -60 90 Z"
            fill="rgba(189,207,170,0.030)" />
          <path d="M 200 0 C 360 80 500 -30 680 60 S 860 160 960 80 L 960 0 L 200 0 Z"
            fill="rgba(142,158,131,0.025)" />
        </svg>

        {/* ── Main row: compact on mobile ── */}
        <div className="relative flex items-center gap-3 md:gap-5">
          {/* Album art */}
          <div className="relative shrink-0">
            <motion.div
              animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
              transition={isPlaying ? { duration: 12, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden"
              style={{
                border: '2px solid rgba(32,199,232,0.22)',
                boxShadow: isPlaying
                  ? '0 0 24px rgba(255,255,255,0.14), 0 6px 24px rgba(0,0,0,0.5)'
                  : '0 0 12px rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.4)',
              }}
            >
              <img
                src={song?.art || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop'}
                alt="Now playing"
                className="w-full h-full object-cover"
              />
            </motion.div>
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full z-10"
              style={{ background: 'linear-gradient(135deg, #20C7E8, #7C5CFF)', boxShadow: '0 0 6px rgba(32,199,232,0.8)' }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="relative inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full overflow-hidden"
                style={{
                  background: isOnline ? 'rgba(255,112,67,0.12)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${isOnline ? 'rgba(255,112,67,0.40)' : 'rgba(255,255,255,0.1)'}`,
                  color: isOnline ? '#FF8A1F' : 'rgba(255,255,255,0.4)',
                }}
              >
                {isOnline && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full"
                      style={{ background: '#FF8A1F' }}
                      animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#FF8A1F' }} />
                  </span>
                )}
                {isLive ? `🎙 ${streamerName || 'En vivo'}` : isOnline ? 'Live Channel' : 'Offline'}
              </span>
            </div>

            <h1 className="text-base md:text-xl font-black text-white leading-tight truncate">
              {song?.title || 'PolyFauna Radio'}
            </h1>
            <p className="text-white/50 text-xs md:text-sm mt-0.5 truncate">
              {song?.artist || (isOnline ? 'Transmisión en vivo · 24/7' : 'Estación offline')}
            </p>

            <div className="hidden md:flex items-center gap-1.5 text-white/35 text-xs mt-1.5">
              <Users className="w-3 h-3" />
              <span>{listeners > 0 ? `${listeners} oyente${listeners !== 1 ? 's' : ''}` : 'En vivo'}</span>
            </div>

            {/* Spectrum — desktop inline */}
            <div className="hidden md:block mt-4">
              <HoloSpectrum isPlaying={isPlaying} height={56} />
            </div>
          </div>

          {/* Play button */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 text-white/35 text-[10px] md:hidden mb-1">
              <Users className="w-2.5 h-2.5" />
              <span>{listeners > 0 ? listeners : '—'}</span>
            </div>

            <div className="relative flex items-center justify-center">
              {isPlaying && (
                <>
                  <motion.span
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -6, border: '1.5px solid rgba(32,199,232,0.30)' }}
                    animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.span
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -3, border: '1px solid rgba(255,255,255,0.10)' }}
                    animate={{ scale: [1, 1.25], opacity: [0.4, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pausar radio' : 'Reproducir radio'}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-transform hover:scale-105 relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #20C7E8, #00AADD)',
                  boxShadow: isPlaying
                    ? '0 0 24px rgba(32,199,232,0.55), 0 4px 14px rgba(0,0,0,0.4)'
                    : '0 0 16px rgba(255,255,255,0.16), 0 4px 10px rgba(0,0,0,0.3)',
                }}
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 fill-current" style={{ color: '#080B14' }} />
                  : <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: '#080B14' }} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Spectrum — mobile (below main row) */}
        <div className="mt-3 md:hidden">
          <HoloSpectrum isPlaying={isPlaying} height={40} />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 mt-4 md:mt-6 relative">
          {[
            { id: 'room',  label: 'Abrir sala en vivo', icon: Tv2,           accent: 'rgba(32,199,232,{a})',  glow: 'rgba(32,199,232,0.18)',  onClick: handleOpenRoom,    active: false },
            { id: 'ask',   label: 'Preguntar al host',  icon: MessageCircle, accent: 'rgba(167,139,250,{a})', glow: 'rgba(167,139,250,0.18)', onClick: handleAskHost,     active: false },
            { id: 'share', label: 'Compartir',          icon: Share2,        accent: 'rgba(52,211,153,{a})',  glow: 'rgba(52,211,153,0.18)',  onClick: handleShare,       active: false },
            { id: 'save',  label: 'Guardar sesión',     icon: Bookmark,      accent: 'rgba(251,191,36,{a})',  glow: 'rgba(251,191,36,0.18)', onClick: handleSaveSession, active: isSessionSaved },
          ].map(({ id, label, icon: Icon, accent, glow, onClick, active }) => (
            <motion.button
              key={id}
              type="button"
              onClick={onClick}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl"
              style={{
                background: active ? accent.replace('{a}', '0.15') : 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${active ? accent.replace('{a}', '0.40') : 'rgba(255,255,255,0.08)'}`,
                color: active ? accent.replace('{a}', '1)') : 'rgba(255,255,255,0.45)',
                boxShadow: active
                  ? `0 8px 24px rgba(0,0,0,0.30), 0 0 16px ${glow}, 0 1px 0 rgba(255,255,255,0.06) inset`
                  : '0 4px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset',
              }}
              whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
              whileTap={{ y: 0, scale: 0.97, transition: { duration: 0.1 } }}
              onMouseEnter={(e) => {
                const c = e.currentTarget;
                c.style.background = accent.replace('{a}', '0.10');
                c.style.borderColor = accent.replace('{a}', '0.35');
                c.style.color = accent.replace('{a}', '1)');
                c.style.boxShadow = `0 8px 24px rgba(0,0,0,0.30), 0 0 16px ${glow}, 0 1px 0 rgba(255,255,255,0.06) inset`;
              }}
              onMouseLeave={(e) => {
                const c = e.currentTarget;
                c.style.background = active ? accent.replace('{a}', '0.15') : 'rgba(255,255,255,0.04)';
                c.style.borderColor = active ? accent.replace('{a}', '0.40') : 'rgba(255,255,255,0.08)';
                c.style.color = active ? accent.replace('{a}', '1)') : 'rgba(255,255,255,0.45)';
                c.style.boxShadow = active
                  ? `0 8px 24px rgba(0,0,0,0.30), 0 0 16px ${glow}, 0 1px 0 rgba(255,255,255,0.06) inset`
                  : '0 4px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset';
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" style={active ? { fill: 'currentColor' } : {}} />
              {id === 'save' && isSessionSaved ? 'Guardado ✓' : label}
            </motion.button>
          ))}
        </div>

        {/* Banner para no logueados */}
        {!currentUser && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5 flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.11)' }}
          >
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <User className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.9)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight">Únete a la comunidad</p>
              <p className="text-[11px] text-white/40 mt-0.5">Guarda sesiones, sigue artistas y accede a contenido exclusivo.</p>
            </div>
            <a
              href="/signup"
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
            >
              Crear cuenta
            </a>
          </motion.div>
        )}
      </motion.div>

      {/* ── Upcoming Shows ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
      >
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Próximos Programas</h2>

        {loading && <LoadingSkeleton rows={4} />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && (!shows || shows.length === 0) && (
          <EmptyState label="No hay programas programados" icon={Radio} />
        )}

        {!loading && !error && shows && shows.length > 0 && (
          <div className="space-y-2">
            {shows.map((show, i) => (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer group"
                style={{ borderRadius: '12px' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
              >
                <span className="text-sm font-mono font-bold shrink-0 w-14 truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {show.schedule || '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate group-hover:text-white transition-colors">{show.name}</p>
                  <p className="text-xs text-white/35 truncate">{show.dj}</p>
                </div>
                {show.genre && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {show.genre}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Preguntar al host modal ── */}
      <AnimatePresence>
        {showAskHost && (
          <FormModal
            title="Preguntar al host"
            subtitle={`Transmisión: ${song?.title || 'En vivo'}`}
            onClose={() => { setShowAskHost(false); setHostQuestion(''); }}
          >
            <form onSubmit={handleSendQuestion} className="grid grid-cols-1 gap-4">
              <FField label="Tu pregunta" required>
                <FTextarea
                  value={hostQuestion}
                  onChange={(e) => setHostQuestion(e.target.value)}
                  placeholder="Escribe tu pregunta para el host…"
                  rows={4}
                />
              </FField>
              <FSubmit loading={sendingQuestion} disabled={!hostQuestion.trim()}>
                Enviar pregunta
              </FSubmit>
            </form>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}
