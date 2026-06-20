import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import RightPanel from '@/components/RightPanel';
import GlobalPlayer from '@/components/GlobalPlayer';
import EventTerminal from '@/components/EventTerminal';
import RadioConsolePage from '@/components/RadioConsolePage';
import PodcastsPage from '@/components/PodcastsPage';
import MusicPage from '@/components/MusicPage';
import ArtistsPage from '@/components/ArtistsPage';
import CommunityGrid from '@/components/CommunityGrid';
import BlogSection from '@/components/BlogSection';
import InterviewsSection from '@/components/InterviewsSection';
import SignalInbox from '@/components/SignalInbox';
import TicketVault from '@/components/TicketVault';
import ControlCenter from '@/components/ControlCenter';
import MyPanel from '@/components/MyPanel';
import PromoterDashboard from '@/components/PromoterDashboard';

function PolyfaunaOS() {
  const [currentSection, setCurrentSection] = useState('radio-console');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSection]);

  // Swipe to open/close sidebar on mobile
  useEffect(() => {
    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (dy > 60) return; // vertical scroll — ignore
      if (dx > 60 && touchStartX.current < 40) setMobileMenuOpen(true);
      if (dx < -60) setMobileMenuOpen(false);
      touchStartX.current = null;
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const renderSection = () => {
    switch (currentSection) {
      case 'radio-console': return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} />;
      case 'podcasts':      return <PodcastsPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} isPlaying={isPlaying} />;
      case 'music':         return <MusicPage setCurrentTrack={setCurrentTrack} setIsPlaying={setIsPlaying} currentTrack={currentTrack} />;
      case 'events':        return <EventTerminal />;
      case 'community':     return <CommunityGrid />;
      case 'inbox':         return <SignalInbox />;
      case 'artists':       return <ArtistsPage />;
      case 'blog':          return <BlogSection />;
      case 'interviews':    return <InterviewsSection />;
      case 'tickets':       return <TicketVault />;
      case 'settings':      return <ControlCenter setCurrentSection={setCurrentSection} />;
      case 'mi-panel':      return <MyPanel setCurrentSection={setCurrentSection} />;
      case 'promoter':      return <PromoterDashboard />;
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
        <Sidebar
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />

        <div className="flex flex-col flex-1 min-w-0 h-full">
          <TopBar setCurrentSection={setCurrentSection} setMobileMenuOpen={setMobileMenuOpen} />
          <main ref={mainRef} className="flex-1 overflow-y-auto pb-32">
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
      <Toaster />
    </div>
  );
}

export default PolyfaunaOS;
