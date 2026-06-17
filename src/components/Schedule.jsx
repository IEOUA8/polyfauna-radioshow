import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Schedule = () => {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const genres = ['All', 'Techno', 'Experimental', 'Ambient', 'Breakbeat', 'Minimal'];

  const schedule = [
    { day: 'Monday', time: '6:00 AM', title: 'Morning Waves', host: 'Polymath', genre: 'Experimental' },
    { day: 'Monday', time: '2:00 PM', title: 'Deep Structures', host: 'Vector', genre: 'Techno' },
    { day: 'Monday', time: '10:00 PM', title: 'Night Drive', host: 'Laura V.', genre: 'Minimal' },
    { day: 'Tuesday', time: '8:00 AM', title: 'Sunrise Beats', host: 'Sofia Luna', genre: 'Ambient' },
    { day: 'Tuesday', time: '6:00 PM', title: 'Evening Pulse', host: 'DJ Fractal', genre: 'Techno' },
    { day: 'Wednesday', time: '12:00 PM', title: 'Midday Mix', host: 'Ana Torres', genre: 'Experimental' },
    { day: 'Wednesday', time: '9:00 PM', title: 'Nocturnal Sounds', host: 'Avant-Garde Audio', genre: 'Breakbeat' },
  ];

  const filteredSchedule = schedule.filter(show => {
    const dayMatch = selectedDay === 'all' || show.day === selectedDay;
    const genreMatch = selectedGenre === 'all' || show.genre === selectedGenre;
    return dayMatch && genreMatch;
  });

  const handleShowClick = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 poly-bg overflow-hidden">
      <div className="poly-texture" />
      <div className="container mx-auto max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Programming Schedule
          </h1>
          <p className="text-xl text-muted-foreground">Your weekly guide to POLYFAUNA</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="poly-surface rounded-2xl p-6 md:p-8 mb-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-white">Filters</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Day</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setSelectedDay('all')}
                  className={selectedDay === 'all' ? 'bg-primary text-white border-0' : 'bg-white/5 hover:bg-white/10 text-foreground border border-white/5'}
                >
                  All
                </Button>
                {days.map(day => (
                  <Button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={selectedDay === day ? 'bg-primary text-white border-0' : 'bg-white/5 hover:bg-white/10 text-foreground border border-white/5'}
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Genre</p>
              <div className="flex flex-wrap gap-2">
                {genres.map(genre => (
                  <Button
                    key={genre}
                    onClick={() => setSelectedGenre(genre.toLowerCase())}
                    className={selectedGenre === genre.toLowerCase() ? 'bg-secondary text-white border-0' : 'bg-white/5 hover:bg-white/10 text-foreground border border-white/5'}
                  >
                    {genre}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4">
          {filteredSchedule.map((show, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 5, scale: 1.01 }}
              onClick={handleShowClick}
              className="cursor-pointer poly-surface rounded-xl p-6 hover:border-secondary/50 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="min-w-[100px] border-r border-white/10 pr-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{show.day}</p>
                    <p className="text-2xl font-bold text-primary">{show.time}</p>
                  </div>
                  
                  <div className="flex-1 pl-2">
                    <h3 className="text-xl font-bold text-white mb-1">{show.title}</h3>
                    <p className="text-muted-foreground">with {show.host}</p>
                  </div>
                </div>
                
                <span className="px-4 py-2 bg-secondary/20 text-secondary border border-secondary/20 rounded-full text-sm font-bold tracking-wide shadow-sm">
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

export default Schedule;