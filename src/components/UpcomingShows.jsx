import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Radio, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const UpcomingShows = () => {
  const { toast } = useToast();

  const shows = [
    {
      id: 1,
      title: 'Midnight Frequencies',
      host: 'DJ Santiago Rios',
      time: 'Today, 11:00 PM',
      genre: 'Techno',
      image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=900&auto=format&fit=crop',
    },
    {
      id: 2,
      title: 'Sunrise Sessions',
      host: 'Laura Mendez',
      time: 'Tomorrow, 6:00 AM',
      genre: 'House',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop',
    },
    {
      id: 3,
      title: 'Urban Pulse',
      host: 'Colectivo Beats',
      time: 'Tomorrow, 8:00 PM',
      genre: 'Breakbeat',
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=900&auto=format&fit=crop',
    },
    {
      id: 4,
      title: 'Ambient Dreams',
      host: 'Maria Valencia',
      time: 'Friday, 10:00 PM',
      genre: 'Ambient',
      image: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?q=80&w=900&auto=format&fit=crop',
    },
  ];

  const handleShowClick = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent mb-3">Programming</p>
            <h2 className="text-3xl md:text-5xl font-black text-white">Upcoming Shows</h2>
          </div>
          <p className="max-w-xl text-muted-foreground text-base md:text-lg">Curated sessions moving through techno, house, breakbeat and ambient textures.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {shows.map((show, index) => (
            <motion.div
              key={show.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              onClick={handleShowClick}
              className="group cursor-pointer poly-surface-elevated rounded-lg overflow-hidden border-white/10 transition-all hover:border-secondary/50"
            >
              <div className="relative h-44 overflow-hidden">
                <img src={show.image} alt={show.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                <div className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 backdrop-blur">
                  <Radio className="h-5 w-5 text-accent" />
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-3">{show.title}</h3>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="w-4 h-4 text-secondary" />
                  <span>{show.host}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-accent mb-4">
                  <Clock className="w-4 h-4" />
                  <span>{show.time}</span>
                </div>
                
                <span className="inline-block px-3 py-1 bg-primary/20 text-primary-foreground border border-primary/30 rounded-full text-xs font-semibold">
                  {show.genre}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UpcomingShows;
