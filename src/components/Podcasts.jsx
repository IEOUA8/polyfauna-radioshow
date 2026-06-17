import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Heart, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Podcasts = () => {
  const { toast } = useToast();
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [likedPodcasts, setLikedPodcasts] = useState({});

  const toggleLike = (id, e) => {
    e.stopPropagation();
    setLikedPodcasts(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      toast({
        title: newState[id] ? "Added to favorites" : "Removed from favorites",
        description: newState[id] ? "Podcast saved to your library" : "Podcast removed from your library"
      });
      return newState;
    });
  };

  const genres = ['All', 'Techno', 'Experimental', 'Ambient', 'Minimal', 'IDM'];

  const podcasts = [
    {
      id: 1,
      title: 'Deep Tech Explorations',
      host: 'DJ Fractal',
      duration: '58 min',
      genre: 'Experimental',
      date: 'Dec 10',
      image: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2000&auto=format&fit=crop',
      description: 'A journey through the deepest corners of experimental music.',
    },
    {
      id: 2,
      title: 'Algorithmic Beats',
      host: 'Polymath',
      duration: '45 min',
      genre: 'IDM',
      date: 'Dec 8',
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2000&auto=format&fit=crop',
      description: 'Celebrating the electronic music scene.',
    },
    {
      id: 3,
      title: 'Ambient Journey',
      host: 'Sofia Luna',
      duration: '62 min',
      genre: 'Ambient',
      date: 'Dec 6',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2000&auto=format&fit=crop',
      description: 'Atmospheric soundscapes for mindful listening.',
    },
    {
      id: 4,
      title: 'Minimal Mornings',
      host: 'Laura Mendez',
      duration: '52 min',
      genre: 'Minimal',
      date: 'Dec 5',
      image: 'https://images.unsplash.com/photo-1594623930572-300a3011d9ae?q=80&w=2000&auto=format&fit=crop',
      description: 'Start your day with minimalist grooves and subtle rhythms.',
    },
  ];

  const filteredPodcasts = selectedGenre === 'all' 
    ? podcasts 
    : podcasts.filter(p => p.genre.toLowerCase() === selectedGenre.toLowerCase());

  const handleAction = (e) => {
    e.stopPropagation();
    toast({
      title: "Opening podcast...",
    });
  };

  return (
    <div className="relative min-h-screen pt-4 px-4 poly-bg overflow-hidden rounded-[2.5rem] m-2 md:m-4 border border-white/5">
      <div className="poly-texture" />
      <div className="relative z-10 space-y-8 p-4 md:p-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Podcasts</h2>
            <p className="text-muted-foreground">Curated sets and shows from our resident DJs.</p>
          </div>
          
          {/* Genre Filters */}
          <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 scrollbar-hide">
            {genres.map(genre => (
                <Button
                  key={genre}
                  variant="outline"
                  onClick={() => setSelectedGenre(genre)}
                  className={`rounded-full border-0 px-6 ${
                    selectedGenre === genre 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'bg-[#222222] text-muted-foreground hover:text-white hover:bg-[#2A2A2A]'
                  }`}
                >
                  {genre}
                </Button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPodcasts.map((podcast, index) => (
            <motion.div
              key={podcast.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative poly-surface rounded-3xl p-4 transition-all duration-300 hover:-translate-y-2 hover:border-primary/50"
            >
              {/* Image Container */}
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl border border-white/5">
                <img 
                  src={podcast.image} 
                  alt={podcast.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors duration-300" />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                    <Button 
                      size="icon" 
                      onClick={handleAction}
                      className="w-16 h-16 rounded-full bg-primary text-white hover:bg-primary/90 hover:scale-110 transition-transform shadow-[0_0_30px_rgba(15,76,58,0.6)] border-0"
                    >
                      <Play className="w-8 h-8 fill-current ml-1" />
                    </Button>
                </div>

                {/* Genre Tag */}
                <span className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-white border border-white/10">
                    {podcast.genre}
                </span>
              </div>
              
              {/* Content */}
              <div className="space-y-1 mb-2 px-1">
                <h3 className="text-xl font-bold text-white truncate pr-2">{podcast.title}</h3>
                <p className="text-sm text-primary font-medium hover:underline cursor-pointer">{podcast.host}</p>
              </div>

              {/* Metadata & Actions */}
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 px-1 pt-4 border-t border-white/5">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-4 h-4 text-secondary" /> {podcast.duration}
                    </span>
                    <span className="font-medium">{podcast.date}</span>
                </div>
                
                <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-8 w-8 hover:bg-white/5 rounded-full ${likedPodcasts[podcast.id] ? 'text-accent' : 'text-muted-foreground hover:text-white'}`}
                      onClick={(e) => toggleLike(podcast.id, e)}
                    >
                      <Heart className={`w-4 h-4 ${likedPodcasts[podcast.id] ? 'fill-current' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-white hover:bg-white/5">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Podcasts;