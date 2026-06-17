import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, Share2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const LiveRadio = ({ isPlaying, setIsPlaying }) => {
  const { toast } = useToast();

  const upcomingShows = [
    { time: '11:00 PM', title: 'Fractal Frequencies', host: 'DJ Fractal', genre: 'Experimental' },
    { time: '6:00 AM', title: 'Algorithmic Dawn', host: 'Polymath', genre: 'IDM' },
    { time: '2:00 PM', title: 'Deep Structures', host: 'Vector', genre: 'Techno' },
    { time: '8:00 PM', title: 'Sonic Pulse', host: 'Avant-Garde Audio', genre: 'Breakbeat' },
  ];

  const handleAction = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 poly-bg overflow-hidden">
      <div className="poly-texture" />
      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="poly-surface rounded-3xl p-8 md:p-12"
        >
          <div className="text-center mb-8">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block mb-4"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-full text-sm font-bold shadow-lg shadow-destructive/20">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE NOW
              </span>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              24/7 Live Stream
            </h1>
            <p className="text-xl text-muted-foreground">Experience non-stop experimental electronic music</p>
          </div>

          <div className="bg-[#121212]/80 rounded-2xl p-8 mb-8 border border-white/5 shadow-inner">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <p className="text-sm text-secondary font-bold tracking-widest uppercase mb-2">Currently Playing</p>
                <h2 className="text-3xl font-bold text-white mb-1">Polyphonic Structures</h2>
                <p className="text-lg text-primary">with DJ Fractal</p>
                <p className="text-sm text-muted-foreground mt-2">Techno • Experimental • IDM</p>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="icon"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all shadow-[0_0_30px_rgba(139,58,139,0.3)] hover:shadow-[0_0_40px_rgba(15,76,58,0.5)] border-0"
                >
                  {isPlaying ? <Pause className="w-10 h-10 text-white" /> : <Play className="w-10 h-10 ml-1 text-white" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-medium">45:32</span>
                <div className="flex-1 bg-[#222222] rounded-full h-2 overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '38%' }}
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                  />
                </div>
                <span className="text-sm text-muted-foreground font-medium">120:00</span>
              </div>
              
              <div className="flex items-center gap-4">
                <Volume2 className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 max-w-xs bg-[#222222] rounded-full h-2 overflow-hidden shadow-inner">
                  <div className="w-3/4 h-full bg-gradient-to-r from-primary to-secondary" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Button 
                variant="outline" 
                onClick={handleAction}
                className="border-white/10 text-foreground hover:bg-white/5 bg-[#1A1A1A]"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button 
                variant="outline" 
                onClick={handleAction}
                className="border-white/10 text-foreground hover:bg-white/5 bg-[#1A1A1A]"
              >
                <Heart className="w-4 h-4 mr-2" />
                Favorite
              </Button>
            </div>
          </div>

          <div className="poly-surface-elevated rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-white mb-6">Upcoming Shows Today</h3>
            <div className="space-y-3">
              {upcomingShows.map((show, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-[#1A1A1A] rounded-xl border border-white/5 hover:border-primary/50 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-secondary font-bold text-lg min-w-[80px] group-hover:text-primary transition-colors">{show.time}</span>
                    <div>
                      <h4 className="text-white font-semibold">{show.title}</h4>
                      <p className="text-sm text-muted-foreground">{show.host}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-bold border border-primary/20">
                    {show.genre}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LiveRadio;