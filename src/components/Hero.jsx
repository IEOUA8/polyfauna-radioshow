import React from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Pause, Play, Radio, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';

const Hero = ({ isPlaying, setIsPlaying }) => {
  return (
    <section className="relative min-h-[calc(100vh-6rem)] overflow-hidden">
      <img
        src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2200&auto=format&fit=crop"
        alt="Live electronic music broadcast with stage lights"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.96)_0%,rgba(18,18,18,0.82)_44%,rgba(18,18,18,0.34)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(20,184,166,0.2),transparent_34%),radial-gradient(circle_at_76%_64%,rgba(192,38,211,0.2),transparent_32%)]" />

      <div className="container mx-auto px-4 relative z-10 min-h-[calc(100vh-6rem)] flex items-center">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-16 items-center w-full py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl"
          >
            <div className="mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
              >
                <Logo size="xl" className="drop-shadow-2xl filter" />
              </motion.div>
              <div className="flex flex-wrap items-center gap-3 mb-6 text-xs font-bold uppercase tracking-[0.22em] text-accent">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
                  <Radio className="h-4 w-4" />
                  Live 24/7
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-4 py-2 text-secondary">
                  <Sparkles className="h-4 w-4" />
                  Fractal radio
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="max-w-3xl text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] text-white drop-shadow-2xl"
              >
                Experimental electronic broadcast from the coffee region.
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 max-w-2xl text-base md:text-xl text-foreground/78 leading-relaxed"
              >
                Sesiones curadas, entrevistas, podcasts y eventos para una comunidad que escucha con detalle.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-14 rounded-md bg-white px-7 text-base font-bold text-black hover:bg-white/90"
              >
                {isPlaying ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
                {isPlaying ? 'Pause Live' : 'Listen Live'}
              </Button>
              <Button variant="outline" className="h-14 rounded-md border-white/20 bg-white/5 px-7 text-base font-semibold text-white hover:bg-white/10">
                <CalendarDays className="mr-2 h-5 w-5" />
                View Schedule
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="poly-surface-elevated rounded-lg p-5 md:p-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-secondary uppercase">Now Playing</p>
                <h2 className="mt-2 text-2xl md:text-3xl font-black text-white">Polyphonic Structures</h2>
                <p className="mt-1 text-sm text-muted-foreground">with DJ Fractal</p>
              </div>
              <Button
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-primary via-secondary to-accent text-white hover:opacity-95"
              >
                {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7 fill-current" />}
              </Button>
            </div>

            <div className="py-6">
              <div className="flex items-end gap-1 h-24" aria-hidden="true">
                {[52, 78, 36, 88, 62, 44, 92, 58, 74, 40, 82, 66, 48, 90, 56, 70, 38, 84].map((height, index) => (
                  <motion.div
                    key={index}
                    initial={{ height: 12 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.9, delay: index * 0.025, repeat: Infinity, repeatType: 'reverse' }}
                    className="flex-1 rounded-t-sm bg-gradient-to-t from-primary via-secondary to-accent opacity-80"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '45%' }}
                    className="h-full bg-gradient-to-r from-primary via-secondary to-accent"
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground w-20 text-right">45 / 120</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="w-3/4 h-full bg-foreground/70" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
