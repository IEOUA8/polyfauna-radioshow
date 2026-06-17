import React from 'react';
import Hero from '@/components/Hero';
import CarouselBanner from '@/components/CarouselBanner';
import UpcomingShows from '@/components/UpcomingShows';
import NextEvent from '@/components/NextEvent';
import LatestContent from '@/components/LatestContent';
import Sponsors from '@/components/Sponsors';

const HomePage = ({ isPlaying, setIsPlaying }) => {
  return (
    <div className="flex flex-col min-h-screen w-full poly-bg relative">
      <div className="poly-texture fixed inset-0 z-0" />
      
      <div className="relative z-10 w-full">
        <Hero isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
        <section className="px-4 py-12 md:py-16 w-full">
          <div className="container mx-auto max-w-7xl">
            <CarouselBanner />
          </div>
        </section>
        <UpcomingShows />
        <NextEvent />
        <LatestContent />
        <Sponsors />
      </div>
    </div>
  );
};

export default HomePage;
