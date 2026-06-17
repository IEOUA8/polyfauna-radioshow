import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Music, Building2, Instagram, Facebook, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Directory = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('collectives');

  const collectives = [
    {
      id: 1,
      name: 'Avant-Garde Audio',
      city: 'Global',
      description: 'Promoting underground electronic music and boundary-pushing talent.',
      genres: ['Experimental', 'IDM', 'Glitch'],
    },
    {
      id: 2,
      name: 'Fractal Beats',
      city: 'Global',
      description: 'Experimental sounds and cutting-edge electronic music collective.',
      genres: ['Breakbeat', 'Ambient', 'Bass'],
    },
    {
      id: 3,
      name: 'Deep Structures',
      city: 'Global',
      description: 'Dedicated to preserving and evolving the deep techno scene.',
      genres: ['Techno', 'Minimal'],
    },
  ];

  const clubs = [
    {
      id: 1,
      name: 'The Void',
      city: 'Virtual',
      description: 'Premier online electronic music venue with immersive audio.',
      capacity: 'Unlimited',
    },
    {
      id: 2,
      name: 'Underground Signal',
      city: 'Virtual',
      description: 'Intimate digital space specializing in techno and minimal.',
      capacity: 'Unlimited',
    },
  ];

  const artists = [
    {
      id: 1,
      name: 'DJ Fractal',
      city: 'Global',
      genres: ['Experimental', 'Minimal'],
      bio: 'Pioneering DJ and producer working with algorithmic sequences.',
    },
    {
      id: 2,
      name: 'Polymath',
      city: 'Global',
      genres: ['IDM', 'Deep House'],
      bio: 'Multi-genre specialist known for complex melodic sets.',
    },
    {
      id: 3,
      name: 'Vector',
      city: 'Global',
      genres: ['Techno', 'Progressive'],
      bio: 'Technical DJ focused on deep, math-inspired techno sounds.',
    },
  ];

  const handleSocialClick = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const renderContent = () => {
    if (activeTab === 'collectives') {
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {collectives.map((collective, index) => (
            <motion.div
              key={collective.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="poly-surface rounded-3xl p-6 hover:border-secondary/50 transition-all duration-300"
            >
              <div className="w-full h-48 bg-gradient-to-br from-primary/80 to-secondary/80 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[#121212]/40" />
                <Users className="w-20 h-20 text-white/50 relative z-10" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{collective.name}</h3>
              <p className="text-primary font-bold text-sm uppercase tracking-wider mb-4">{collective.city}</p>
              <p className="text-muted-foreground text-base mb-6">{collective.description}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {collective.genres.map(genre => (
                  <span key={genre} className="px-3 py-1 bg-white/5 text-white border border-white/10 rounded-full text-xs font-bold">
                    {genre}
                  </span>
                ))}
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-primary/20 hover:text-white text-muted-foreground">
                  <Instagram className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-primary/20 hover:text-white text-muted-foreground">
                  <Facebook className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-primary/20 hover:text-white text-muted-foreground">
                  <Globe className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    if (activeTab === 'clubs') {
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {clubs.map((club, index) => (
            <motion.div
              key={club.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="poly-surface rounded-3xl p-6 hover:border-primary/50 transition-all duration-300"
            >
              <div className="w-full h-48 bg-gradient-to-br from-secondary/80 to-accent/80 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[#121212]/40" />
                <Building2 className="w-20 h-20 text-white/50 relative z-10" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{club.name}</h3>
              <p className="text-accent font-bold text-sm uppercase tracking-wider mb-4">{club.city}</p>
              <p className="text-muted-foreground text-base mb-4">{club.description}</p>
              <p className="text-white font-medium mb-6 bg-white/5 inline-block px-3 py-1 rounded-lg border border-white/10">Capacity: {club.capacity}</p>
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-secondary/20 hover:text-white text-muted-foreground">
                  <Instagram className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-secondary/20 hover:text-white text-muted-foreground">
                  <Globe className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {artists.map((artist, index) => (
          <motion.div
            key={artist.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -8 }}
            className="poly-surface rounded-3xl p-6 hover:border-accent/50 transition-all duration-300"
          >
            <div className="w-full h-48 bg-gradient-to-br from-primary/60 via-secondary/60 to-accent/60 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[#121212]/40" />
              <Music className="w-20 h-20 text-white/50 relative z-10" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{artist.name}</h3>
            <p className="text-primary font-bold text-sm uppercase tracking-wider mb-4">{artist.city}</p>
            <p className="text-muted-foreground text-base mb-6">{artist.bio}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {artist.genres.map(genre => (
                <span key={genre} className="px-3 py-1 bg-white/5 text-white border border-white/10 rounded-full text-xs font-bold">
                  {genre}
                </span>
              ))}
            </div>
            <div className="flex gap-3 pt-4 border-t border-white/5">
              <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-accent/20 hover:text-white text-muted-foreground">
                <Instagram className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleSocialClick} className="border-white/10 bg-[#222222] hover:bg-accent/20 hover:text-white text-muted-foreground">
                <Facebook className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 poly-bg overflow-hidden">
      <div className="poly-texture" />
      <div className="container mx-auto max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Directory
          </h1>
          <p className="text-xl text-muted-foreground">Discover collectives, clubs, and artists</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4 mb-14"
        >
          <Button
            onClick={() => setActiveTab('collectives')}
            className={`h-12 px-8 rounded-full font-bold transition-all ${activeTab === 'collectives' ? 'bg-primary text-white border-0 shadow-lg shadow-primary/20' : 'bg-[#222222] border border-white/10 text-muted-foreground hover:text-white'}`}
          >
            <Users className="w-5 h-5 mr-2" />
            Collectives
          </Button>
          <Button
            onClick={() => setActiveTab('clubs')}
            className={`h-12 px-8 rounded-full font-bold transition-all ${activeTab === 'clubs' ? 'bg-secondary text-white border-0 shadow-lg shadow-secondary/20' : 'bg-[#222222] border border-white/10 text-muted-foreground hover:text-white'}`}
          >
            <Building2 className="w-5 h-5 mr-2" />
            Clubs
          </Button>
          <Button
            onClick={() => setActiveTab('artists')}
            className={`h-12 px-8 rounded-full font-bold transition-all ${activeTab === 'artists' ? 'bg-accent text-white border-0 shadow-lg shadow-accent/20' : 'bg-[#222222] border border-white/10 text-muted-foreground hover:text-white'}`}
          >
            <Music className="w-5 h-5 mr-2" />
            Artists
          </Button>
        </motion.div>

        {renderContent()}
      </div>
    </section>
  );
};

export default Directory;