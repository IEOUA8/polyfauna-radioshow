import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import RightPanel from '@/components/RightPanel';
import GlobalPlayer from '@/components/GlobalPlayer';
import BottomNav from '@/components/BottomNav';
import MobileMenu from '@/components/MobileMenu';
import OnboardingModal from '@/components/OnboardingModal';
import EventTerminal from '@/components/EventTerminal';
import RadioConsolePage from '@/components/RadioConsolePage';
import PodcastsPage from '@/components/PodcastsPage';
import MusicPage from '@/components/MusicPage';
import ArtistsPage from '@/components/ArtistsPage';
import BlogInterviewsSection from '@/components/BlogInterviewsSection';
import SignalInbox from '@/components/SignalInbox';
import TicketVault from '@/components/TicketVault';
import ControlCenter from '@/components/ControlCenter';
import MyPanel from '@/components/MyPanel';
import EventManagerPanel from '@/components/EventManagerPanel';
import { useAuth } from '@/contexts/AuthContext';

const PUBLIC_SECTIONS  = ['radio-console', 'podcasts'];
const CREATOR_ROLES    = ['artist', 'club', 'promoter', 'sello', 'admin'];

function GuestGate({ section }) {
  const labels = {
    music: 'Música', events: 'Event Terminal', artists: 'Artists & Labels',
    inbox: 'Signal Inbox', blog: 'Blog & Entrevistas',
    tickets: 'Ticket Vault', settings: 'Control Center',
    'mi-panel': 'Mi Panel', promoter: 'Gestor de Eventos',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8 text-center"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <Lock className="w-6 h-6 text-white/30" />
      </div>
      <h2 className="text-lg font-black text-white mb-2">{labels[section] || 'Sección restringida'}</h2>
      <p className="text-sm text-white/40 max-w-xs mb-6 leading-relaxed">
        Crea una cuenta o inicia sesión para acceder a esta sección.
      </p>
      <div className="flex gap-3">
        <Link to="/login"
          className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}>
          Iniciar sesión
        </Link>
        <Link to="/signup"
          className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
          Crear cuenta
        </Link>
      </div>
    </motion.div>
  );
}

function PolyfaunaOS() {
  const { currentUser, userRole } = useAuth();
  const [currentSection, setCurrentSection] = useState('radio-console');
  const [isPlaying, setIsPlaying]           = useState(false);
  const [currentTrack, setCurrentTrack]     = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef      = useRef(null);
  const touchStartX  = useRef(null);
  const touchStartY  = useRef(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (isGuestProtected) return <GuestGate section={currentSection} />;

    switch (currentSection) {
      case 'radio-console': return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} />;
      case 'podcasts':      return <PodcastsPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} isPlaying={isPlaying} />;
      case 'music':         return <MusicPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} />;
      case 'events':        return <EventTerminal />;
      case 'artists':       return <ArtistsPage />;
      case 'blog':          return <BlogInterviewsSection />;
      case 'inbox':         return <SignalInbox />;
      case 'tickets':       return <TicketVault />;
      case 'settings':      return <ControlCenter setCurrentSection={setCurrentSection} />;
      case 'mi-panel':      return CREATOR_ROLES.includes(userRole) || userRole === 'citizen'
                              ? <MyPanel setCurrentSection={setCurrentSection} />
                              : <GuestGate section="mi-panel" />;
      case 'promoter':      return (userRole === 'promoter' || userRole === 'club' || userRole === 'admin')
                              ? <EventManagerPanel />
                              : <GuestGate section="promoter" />;
      default:              return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden poly-bg text-foreground font-sans">
      <Helmet>
        <title>POLYFAUNA — Radio · Podcasts · Events</title>
        <meta name="description" content="Plataforma de stream, podcast y eventos de POLYFAUNA." />
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
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <div className="hidden xl:block">
          <RightPanel setCurrentSection={setCurrentSection} />
        </div>
      </div>

      <GlobalPlayer
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        currentTrack={currentTrack}
        setCurrentTrack={setCurrentTrack}
        setCurrentSection={setCurrentSection}
      />

      <BottomNav currentSection={currentSection} setCurrentSection={setCurrentSection} />

      {/* Mobile fullscreen menu */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentSection={currentSection}
        setCurrentSection={(s) => { setCurrentSection(s); setMobileMenuOpen(false); }}
      />

      <OnboardingModal />
      <Toaster />
    </div>
  );
}

export default PolyfaunaOS;
