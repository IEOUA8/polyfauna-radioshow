import React from 'react';
import { motion } from 'framer-motion';
import { Video, Headphones, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Interviews = () => {
  const { toast } = useToast();

  const interviews = [
    {
      id: 1,
      title: 'Interview: Rising Stars of the Underground',
      subject: 'DJ Collective',
      type: 'Video',
      duration: '32 min',
      date: 'Dec 9, 2025',
      description: 'Meet the emerging talents shaping the experimental electronic music scene.',
    },
    {
      id: 2,
      title: 'In Conversation with DJ Fractal',
      subject: 'DJ Fractal',
      type: 'Audio',
      duration: '28 min',
      date: 'Dec 7, 2025',
      description: 'An intimate discussion about algorithmic music production and the evolution of techno.',
    },
    {
      id: 3,
      title: 'The Sound of the Void',
      subject: 'Various Artists',
      type: 'Video',
      duration: '45 min',
      date: 'Dec 4, 2025',
      description: 'Exploring the unique electronic music culture of our digital era.',
    },
    {
      id: 4,
      title: 'Behind the Decks: Avant-Garde Audio',
      subject: 'Avant-Garde Audio',
      type: 'Audio',
      duration: '38 min',
      date: 'Nov 30, 2025',
      description: 'The collective shares their journey and vision for the global scene.',
    },
  ];

  const handlePlay = () => {
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
            Interviews
          </h1>
          <p className="text-xl text-muted-foreground">In-depth conversations with artists and collectives</p>
        </motion.div>

        <div className="grid gap-8">
          {interviews.map((interview, index) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 5 }}
              className="poly-surface rounded-3xl overflow-hidden hover:border-secondary/50 transition-all duration-300 shadow-xl"
            >
              <div className="md:flex">
                <div className="md:w-80 h-56 md:h-auto bg-[#121212] flex items-center justify-center relative border-r border-white/5 group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="text-8xl opacity-10 filter blur-sm">
                    {interview.type === 'Video' ? '🎥' : '🎙️'}
                  </span>
                  <Button
                    size="icon"
                    onClick={handlePlay}
                    className="absolute w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 shadow-2xl transition-transform hover:scale-110"
                  >
                    <Play className="w-10 h-10 text-white ml-1" />
                  </Button>
                  <div className="absolute top-4 left-4 p-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
                    {interview.type === 'Video' ? (
                      <Video className="w-6 h-6 text-white" />
                    ) : (
                      <Headphones className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>

                <div className="p-8 flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-4 py-1.5 bg-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-wider border border-secondary/20">
                      {interview.type}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">{interview.duration}</span>
                    <span className="text-sm text-white/20">•</span>
                    <span className="text-sm font-medium text-muted-foreground">{interview.date}</span>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{interview.title}</h3>
                  <p className="text-primary text-lg font-medium mb-4">{interview.subject}</p>
                  <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-3xl">{interview.description}</p>

                  <div>
                    <Button onClick={handlePlay} className="bg-primary hover:bg-primary/90 text-white px-8 h-12 rounded-xl shadow-lg border-0 font-bold tracking-wide">
                      <Play className="w-5 h-5 mr-2" />
                      Watch Now
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Interviews;