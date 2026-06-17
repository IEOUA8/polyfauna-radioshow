import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Ticket, Filter, Users, Heart, Share2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Events = () => {
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState('all');
  const [favorites, setFavorites] = useState({});
  
  const cities = ['All', 'Global', 'Virtual', 'London', 'Berlin'];

  const events = [
    {
      id: 1,
      title: 'Synthesis Festival 2025',
      date: 'Dec 21',
      fullDate: 'Saturday, Dec 21, 2025',
      time: '9:00 PM',
      venue: 'The Void',
      city: 'Virtual',
      lineup: ['DJ Fractal', 'Polymath', 'Avant-Garde Audio'],
      price: '$ 50.00',
      genres: ['Experimental', 'IDM'],
      image: 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop'
    },
    {
      id: 2,
      title: 'Deep Structures Live',
      date: 'Dec 27',
      fullDate: 'Friday, Dec 27, 2025',
      time: '11:00 PM',
      venue: 'Underground Signal',
      city: 'Virtual',
      lineup: ['Vector', 'Sofia Luna', 'Carlos Mesa'],
      price: '$ 40.00',
      genres: ['Techno', 'Minimal'],
      image: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?q=80&w=2070&auto=format&fit=crop'
    },
  ];

  const filteredEvents = selectedCity === 'all' 
    ? events 
    : events.filter(e => e.city.toLowerCase() === selectedCity);

  const [selectedEvent, setSelectedEvent] = useState(filteredEvents[0]);

  useEffect(() => {
    if (filteredEvents.length > 0) {
      const exists = filteredEvents.find(e => e.id === selectedEvent?.id);
      if (!exists) setSelectedEvent(filteredEvents[0]);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedCity, selectedEvent]);

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      toast({
         title: newState[id] ? "Event saved" : "Event removed",
         description: newState[id] ? "You'll be notified of updates." : "Removed from your saved events."
      });
      return newState;
    });
  };

  const handleTicketClick = (e) => {
    e.stopPropagation();
    toast({
      title: "Opening ticket vendor...",
    });
  };

  return (
    <div className="relative poly-bg min-h-screen pt-4 px-4 overflow-hidden rounded-[2.5rem] m-2 md:m-4 border border-white/5">
      <div className="poly-texture" />
      <div className="relative z-10 space-y-8 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Events & Tickets</h2>
            <p className="text-muted-foreground">Upcoming experimental electronic music events.</p>
          </div>
          
          <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-2 md:pb-0">
            {cities.map(city => (
                <Button
                  key={city}
                  variant="outline"
                  onClick={() => setSelectedCity(city.toLowerCase())}
                  className={`rounded-full border-0 px-6 whitespace-nowrap font-bold ${
                    selectedCity === city.toLowerCase()
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-[#222222] text-muted-foreground hover:text-white hover:bg-[#2A2A2A]'
                  }`}
                >
                  {city}
                </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8">
          {/* Left Column - Event List */}
          <div className="lg:col-span-5 space-y-4">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedEvent(event)}
                className={`group cursor-pointer relative overflow-hidden transition-all duration-300 rounded-3xl p-6 ${
                  selectedEvent?.id === event.id 
                    ? 'poly-surface-elevated border-primary/50 shadow-xl shadow-primary/10 scale-[1.02]' 
                    : 'poly-surface border-white/5 hover:border-primary/30'
                }`}
              >
                {selectedEvent?.id === event.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary to-secondary" />
                )}

                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 pl-2">
                    <span className="text-secondary font-bold text-xs tracking-widest uppercase mb-2 block">
                      {event.date} • {event.time}
                    </span>
                    <h3 className={`text-2xl font-bold mb-2 transition-colors ${
                      selectedEvent?.id === event.id ? 'text-white' : 'text-foreground group-hover:text-primary'
                    }`}>
                      {event.title}
                    </h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <MapPin className="w-4 h-4 text-primary" />
                        {event.venue}, {event.city}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className={`h-10 w-10 rounded-full hover:bg-white/10 ${favorites[event.id] ? 'text-accent' : 'text-muted-foreground'}`}
                        onClick={(e) => toggleFavorite(e, event.id)}
                      >
                        <Heart className={`w-5 h-5 ${favorites[event.id] ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                    <span className="font-bold text-white bg-[#222222] px-4 py-1.5 rounded-full text-sm border border-white/10 shadow-sm">
                      {event.price}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-7">
            <div className="sticky top-32">
              <div className="relative aspect-[3/4] md:aspect-[16/9] lg:aspect-[4/5] xl:aspect-[4/3] w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-[#121212]">
                <AnimatePresence mode="wait">
                  {selectedEvent ? (
                    <motion.div
                      key={selectedEvent.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0"
                    >
                      <img 
                        src={selectedEvent.image}
                        alt={selectedEvent.title}
                        className="w-full h-full object-cover opacity-80 mix-blend-overlay"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#121212]/60 to-transparent" />
                      
                      <div className="absolute top-6 right-6 flex gap-3">
                        <Button size="icon" className="rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white border border-white/20">
                            <Share2 className="w-5 h-5" />
                        </Button>
                        <Button 
                          size="icon" 
                          onClick={(e) => toggleFavorite(e, selectedEvent.id)}
                          className={`rounded-full backdrop-blur-md border border-white/20 ${
                              favorites[selectedEvent.id] 
                                ? 'bg-accent text-white border-accent' 
                                : 'bg-black/40 hover:bg-black/60 text-white'
                          }`}
                        >
                            <Heart className={`w-5 h-5 ${favorites[selectedEvent.id] ? 'fill-current' : ''}`} />
                        </Button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <div className="flex items-center gap-3 mb-6">
                            {selectedEvent.genres.map(genre => (
                              <span key={genre} className="px-4 py-1.5 bg-primary/90 backdrop-blur-sm text-white text-xs font-bold rounded-full shadow-lg border border-primary/50">
                                {genre}
                              </span>
                            ))}
                          </div>
                          
                          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight drop-shadow-xl">
                            {selectedEvent.title}
                          </h2>
                          
                          <div className="grid grid-cols-2 gap-6 text-white mb-10 max-w-lg bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">Date</p>
                              <div className="flex items-center gap-2 font-medium">
                                <Calendar className="w-5 h-5 text-secondary" />
                                <span>{selectedEvent.fullDate}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">Location</p>
                              <div className="flex items-center gap-2 font-medium">
                                <MapPin className="w-5 h-5 text-secondary" />
                                <span>{selectedEvent.venue}</span>
                              </div>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-bold">Lineup</p>
                              <div className="flex items-center gap-2 font-medium">
                                <Users className="w-5 h-5 text-secondary" />
                                <span>{selectedEvent.lineup.join(', ')}</span>
                              </div>
                            </div>
                          </div>

                          <Button 
                            size="lg"
                            onClick={handleTicketClick}
                            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold h-16 rounded-2xl text-lg shadow-[0_0_30px_rgba(139,58,139,0.4)] border-0"
                          >
                            <Ticket className="w-6 h-6 mr-3" />
                            Get Tickets — {selectedEvent.price}
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>Select an event to view details</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Events;