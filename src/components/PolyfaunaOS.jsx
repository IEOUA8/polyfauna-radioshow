import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import RightPanel from '@/components/RightPanel';
import GlobalPlayer from '@/components/GlobalPlayer';
import EventTerminal from '@/components/EventTerminal';
import RadioConsolePage from '@/components/RadioConsolePage';
import PodcastsPage from '@/components/PodcastsPage';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderSection = () => {
    switch (currentSection) {
      case 'radio-console': return <RadioConsolePage isPlaying={isPlaying} setIsPlaying={setIsPlaying} />;
      case 'podcasts':      return <PodcastsPage />;
      case 'events':        return <EventTerminal />;
      case 'community':     return <CommunityGrid />;
      case 'inbox':         return <SignalInbox />;
      case 'artists':       return <ArtistsPage />;
      case 'blog':          return <BlogSection />;
      case 'interviews':    return <InterviewsSection />;
      case 'tickets':       return <TicketVault />;
      case 'settings':      return <ControlCenter />;
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
          <main className="flex-1 overflow-y-auto pb-20">
            {renderSection()}
          </main>
        </div>

        <div className="hidden xl:block">
          <RightPanel />
        </div>
      </div>

      <GlobalPlayer isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      <Toaster />
    </div>
  );
}

export default PolyfaunaOS;
