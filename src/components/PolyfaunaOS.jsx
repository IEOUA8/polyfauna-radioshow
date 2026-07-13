import React, { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import MobileMenu from '@/components/MobileMenu';
import InstallAppBanner from '@/components/InstallAppBanner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayback } from '@/contexts/PlaybackContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { lazyImport } from '@/lib/lazyImport';

const RightPanel            = lazy(lazyImport(() => import('@/components/RightPanel')));
const OnboardingModal       = lazy(lazyImport(() => import('@/components/OnboardingModal')));
const EmailVerifiedModal    = lazy(lazyImport(() => import('@/components/EmailVerifiedModal')));
const EventTerminal         = lazy(lazyImport(() => import('@/components/EventTerminal')));
const RadioConsolePage      = lazy(lazyImport(() => import('@/components/RadioConsolePage')));
const PodcastsPage          = lazy(lazyImport(() => import('@/components/PodcastsPage')));
const MusicPage             = lazy(lazyImport(() => import('@/components/MusicPage')));
const Organism              = lazy(lazyImport(() => import('@/components/Organism')));
const ArtistsPage           = lazy(lazyImport(() => import('@/components/ArtistsPage')));
const OrganizersPage        = lazy(lazyImport(() => import('@/components/OrganizersPage')));
const BlogInterviewsSection = lazy(lazyImport(() => import('@/components/BlogInterviewsSection')));
const SignalInbox           = lazy(lazyImport(() => import('@/components/SignalInbox')));
const TicketVault           = lazy(lazyImport(() => import('@/components/TicketVault')));
const ControlCenter         = lazy(lazyImport(() => import('@/components/ControlCenter')));

const PUBLIC_SECTIONS  = ['radio-console', 'podcasts', 'events', 'artists', 'organizers', 'blog'];
const VALID_SECTIONS   = new Set(['radio-console', 'podcasts', 'music', 'organism', 'events', 'artists', 'organizers', 'blog', 'inbox', 'tickets', 'settings']);

function SectionLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-col items-center gap-4 text-center"
        role="status"
        aria-label="Cargando sección"
      >
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.045)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(255,255,255,0.10)',
                '0 0 0 12px rgba(255,255,255,0)',
              ],
            }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
          />
          <div className="relative flex items-end gap-1 h-7">
            {[0, 1, 2, 3].map((index) => (
              <motion.span
                key={index}
                className="w-1.5 rounded-full"
                style={{ background: 'rgba(236,236,236,0.82)' }}
                animate={{ height: [8, 24, 12, 18, 8] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: index * 0.11,
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-black text-white">Sintonizando señal</p>
          <p
            className="mt-1 text-[10px] uppercase text-white/25"
            style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.22em' }}
          >
            Polyfauna bioma
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function GuestGate({ section, onClose }) {
  const labels = {
    music: 'Música', organism: 'Organismo', events: 'Event Terminal', artists: 'Artists & Labels',
    organizers: 'Colonia',
    inbox: 'Signal Inbox', blog: 'Blog & Entrevistas',
    tickets: 'Ticket Vault', settings: 'Control Center',
  };
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 text-center"
      style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center"
        style={{ background: 'rgba(11,16,15,0.98)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Lock className="w-6 h-6 text-white/30" />
        </div>
        <h2 className="text-lg font-black text-white mb-2">{labels[section] || 'Sección restringida'}</h2>
        <p className="text-sm text-white/40 max-w-xs mb-6 leading-relaxed">
          Crea una cuenta o inicia sesión para acceder a esta sección.
        </p>
        <div className="flex gap-3 w-full">
          <Link to="/login"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}>
            Iniciar sesión
          </Link>
          <Link to="/signup"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
            Crear cuenta
          </Link>
        </div>
        <button type="button" onClick={onClose} className="mt-4 text-xs text-white/30 hover:text-white/60">
          Cancelar
        </button>
      </div>
    </motion.div>,
    document.body
  );
}

function PolyfaunaOS() {
  const { currentUser } = useAuth();
  const { isPlaying, setIsPlaying, currentTrack, setCurrentTrack, registerSectionNavigator } = usePlayback();
  const [currentSection, setCurrentSection] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('section');
    return VALID_SECTIONS.has(requested) ? requested : 'radio-console';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showRightPanel = useMediaQuery('(min-width: 1280px)');
  const mainRef      = useRef(null);
  const touchStartX  = useRef(null);
  const touchStartY  = useRef(null);

  // GlobalPlayer ahora vive fuera de esta ruta (en App.jsx, para que el
  // audio no se detenga al navegar a /admin o /dashboard). Su botón "Ver
  // podcasts" necesita cambiar de sección instantáneamente cuando
  // PolyfaunaOS ya está montado — se registra esta función mientras dure.
  useEffect(() => {
    registerSectionNavigator(setCurrentSection);
    return () => registerSectionNavigator(null);
  }, [registerSectionNavigator]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    if (currentSection === 'radio-console') url.searchParams.delete('section');
    else url.searchParams.set('section', currentSection);
    if (currentSection !== 'artists') url.searchParams.delete('artist');
    if (currentSection !== 'organizers') url.searchParams.delete('organizer');
    if (currentSection !== 'music') url.searchParams.delete('album');
    if (currentSection !== 'podcasts') url.searchParams.delete('podcast');
    if (currentSection !== 'events') url.searchParams.delete('event');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [currentSection]);

  // Swipe right from left edge → open mobile menu
  useEffect(() => {
    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (dy > 60) return;
      if (dx > 60 && touchStartX.current < 40) setMobileMenuOpen(true);
      if (dx < -60) setMobileMenuOpen(false);
      touchStartX.current = null;
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  const isGuestProtected = !currentUser && !PUBLIC_SECTIONS.includes(currentSection);

  const renderSection = () => {
    if (isGuestProtected) return <GuestGate section={currentSection} onClose={() => setCurrentSection('radio-console')} />;

    switch (currentSection) {
      case 'radio-console': return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} setCurrentSection={setCurrentSection} />;
      case 'podcasts':      return <PodcastsPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} isPlaying={isPlaying} />;
      case 'music':         return <MusicPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} />;
      case 'organism':      return <Organism currentTrack={currentTrack} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />;
      case 'events':        return <EventTerminal setCurrentSection={setCurrentSection} />;
      case 'artists':       return (
                              <ArtistsPage
                                setCurrentSection={setCurrentSection}
                              />
                            );
      case 'organizers':    return (
                              <OrganizersPage
                                setCurrentSection={setCurrentSection}
                              />
                            );
      case 'blog':          return <BlogInterviewsSection />;
      case 'inbox':         return <SignalInbox />;
      case 'tickets':       return <TicketVault />;
      case 'settings':      return <ControlCenter setCurrentSection={setCurrentSection} />;
      default:              return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} setCurrentSection={setCurrentSection} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden poly-bg text-foreground font-sans" style={{ height: '100dvh' }}>
      <Helmet>
        <title>POLYFAUNA | Radio online, podcasts y eventos electrónicos</title>
        <meta name="description" content="Radio online 24/7, podcasts, artistas y eventos de música electrónica en Colombia. Descubre techno, experimental, tickets y cultura underground." />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href="https://www.polyfauna.com/" />
        <meta property="og:title" content="POLYFAUNA | Radio online, podcasts y eventos electrónicos" />
        <meta property="og:description" content="Un bioma sonoro de radio 24/7, podcasts, artistas y eventos de música electrónica en Colombia." />
        <meta property="og:url" content="https://www.polyfauna.com/" />
        <meta property="og:image" content="https://www.polyfauna.com/icons/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.polyfauna.com/icons/og-cover.png" />
      </Helmet>

      <div className="flex h-full">
        {/* Desktop sidebar */}
        <Sidebar
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
        />

        <div className="flex flex-col flex-1 min-w-0 h-full">
          <TopBar
            setCurrentSection={setCurrentSection}
            setMobileMenuOpen={setMobileMenuOpen}
          />
          <main ref={mainRef} className="flex-1 overflow-y-auto pb-48 lg:pb-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ willChange: 'opacity, transform, filter' }}
              >
                <Suspense fallback={<SectionLoader />}>
                  {renderSection()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {showRightPanel && (
          <div className="hidden xl:block">
            <Suspense fallback={null}>
              <RightPanel setCurrentSection={setCurrentSection} />
            </Suspense>
          </div>
        )}
      </div>

      <BottomNav currentSection={currentSection} setCurrentSection={setCurrentSection} />

      {/* Mobile fullscreen menu */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentSection={currentSection}
        setCurrentSection={(s) => { setCurrentSection(s); setMobileMenuOpen(false); }}
      />

      <Suspense fallback={null}>
        <OnboardingModal />
      </Suspense>
      <Suspense fallback={null}>
        <EmailVerifiedModal />
      </Suspense>
      <InstallAppBanner />
      <Toaster />
    </div>
  );
}

export default PolyfaunaOS;
