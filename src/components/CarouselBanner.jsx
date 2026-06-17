import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Ticket, Play, BookOpen, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CarouselBanner = () => {
  const { toast } = useToast();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBannerContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRes, podcastRes, interviewRes] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('podcasts').select('*, artists(name)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('interviews').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const slides = [];

      if (eventRes.error) {
        console.error('Error fetching event:', eventRes.error);
      } else if (eventRes.data) {
        slides.push({
          id: 'event',
          type: 'Latest Event',
          title: eventRes.data.title,
          subtitle: `${eventRes.data.venue || 'TBA'} • ${new Date(eventRes.data.date).toLocaleDateString()}`,
          image: eventRes.data.image_url || 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop',
          cta: 'Buy Tickets',
          icon: Ticket,
        });
      }

      if (podcastRes.error) {
        console.error('Error fetching podcast:', podcastRes.error);
      } else if (podcastRes.data) {
        slides.push({
          id: 'podcast',
          type: 'Latest Podcast',
          title: podcastRes.data.title,
          subtitle: `by ${podcastRes.data.artists?.name || 'Unknown Artist'}`,
          image: podcastRes.data.cover_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2000&auto=format&fit=crop',
          cta: 'Listen Now',
          icon: Play,
        });
      }

      if (interviewRes.error) {
        console.error('Error fetching interview:', interviewRes.error);
      } else if (interviewRes.data) {
        slides.push({
          id: 'interview',
          type: 'Latest Interview',
          title: interviewRes.data.title,
          subtitle: `Interview with ${interviewRes.data.subject}`,
          image: interviewRes.data.image_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2000&auto=format&fit=crop',
          cta: 'Read More',
          icon: BookOpen,
        });
      }

      if (slides.length === 0) {
        setError("No content available right now.");
      } else {
        setBanners(slides);
      }
    } catch (err) {
      console.error('Error fetching banner content:', err);
      setError("Failed to load banners. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBannerContent();
  }, [fetchBannerContent]);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length]);

  const handleAction = () => {
    toast({
      title: "Opening content...",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  if (loading) {
    return (
      <div className="w-full h-[360px] md:h-[460px] rounded-lg flex items-center justify-center bg-primary/10 backdrop-blur-md border border-primary/20 shadow-lg">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    );
  }

  if (error || banners.length === 0) {
    return (
      <div className="w-full h-[360px] md:h-[460px] rounded-lg flex flex-col items-center justify-center bg-primary/10 backdrop-blur-md border border-primary/20 p-6 text-center shadow-lg">
        <p className="text-secondary mb-4 text-lg font-medium">{error || "No content to display at the moment."}</p>
        <Button onClick={fetchBannerContent} className="rounded-md bg-secondary hover:bg-secondary/80 text-white border-0">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const ActiveIcon = banners[currentSlide].icon;

  return (
    <div className="relative w-full h-[420px] md:h-[520px] overflow-hidden rounded-lg border border-white/10 shadow-2xl group bg-black/40 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={banners[currentSlide].image}
            alt={banners[currentSlide].title}
            className="w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          
          <div className="absolute inset-y-0 left-0 flex items-end md:items-center p-6 md:p-12 z-10">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="px-4 py-1.5 bg-white/10 border border-white/10 text-accent text-xs font-bold rounded-full uppercase tracking-wider shadow-lg backdrop-blur-sm">
                  {banners[currentSlide].type}
                </span>
              </div>
              
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight drop-shadow-lg max-w-3xl">
                {banners[currentSlide].title}
              </h2>
              
              <p className="text-base md:text-xl text-foreground/80 mb-8 font-medium drop-shadow-md">
                {banners[currentSlide].subtitle}
              </p>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                <Button
                  onClick={handleAction}
                  className="bg-white text-black hover:bg-accent hover:text-white font-bold px-7 h-14 text-base shadow-xl transition-colors duration-300 rounded-md"
                >
                  <ActiveIcon className="w-5 h-5 mr-2" />
                  {banners[currentSlide].cta}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <Button
            onClick={prevSlide}
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md hover:bg-primary/60 text-white rounded-full h-12 w-12 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <Button
            onClick={nextSlide}
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-md hover:bg-primary/60 text-white rounded-full h-12 w-12 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Dots Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'w-10 bg-accent' 
                    : 'w-2.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CarouselBanner;
