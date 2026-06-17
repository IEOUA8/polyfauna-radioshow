import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Video, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const LatestContent = () => {
  const { toast } = useToast();

  const podcasts = [
    { id: 1, title: 'Deep Tech Explorations', host: 'DJ Marco', duration: '58 min' },
    { id: 2, title: 'Coffee Region Beats', host: 'Colectivo Local', duration: '45 min' },
    { id: 3, title: 'Ambient Journey', host: 'Sofia Luna', duration: '62 min' },
  ];

  const interviews = [
    { id: 1, title: 'Interview: Rising Stars of Manizales', type: 'Video', duration: '32 min' },
    { id: 2, title: 'In Conversation with DJ Paula', type: 'Audio', duration: '28 min' },
  ];

  const blog = [
    { id: 1, title: 'The Evolution of Techno in Colombia', date: 'Dec 8, 2025' },
    { id: 2, title: 'Event Review: Nocturnal Frequencies', date: 'Dec 5, 2025' },
  ];

  const handleClick = () => {
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
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent mb-3">Archive</p>
            <h2 className="text-3xl md:text-5xl font-black text-white">Latest Content</h2>
          </div>
          <p className="max-w-xl text-muted-foreground text-base md:text-lg">Podcasts, interviews and notes from the artists shaping the sound.</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="poly-surface-elevated rounded-lg p-6 border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Headphones className="w-6 h-6 text-accent" />
              <h3 className="text-2xl font-bold text-white">Podcasts</h3>
            </div>
            <div className="space-y-4">
              {podcasts.map((podcast) => (
                <motion.div
                  key={podcast.id}
                  whileHover={{ x: 5 }}
                  onClick={handleClick}
                  className="cursor-pointer p-4 bg-black/30 rounded-md border border-white/10 hover:border-secondary/50 transition-all"
                >
                  <h4 className="text-white font-semibold mb-1">{podcast.title}</h4>
                  <p className="text-sm text-muted-foreground">{podcast.host} • {podcast.duration}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="poly-surface-elevated rounded-lg p-6 border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Video className="w-6 h-6 text-accent" />
              <h3 className="text-2xl font-bold text-white">Interviews</h3>
            </div>
            <div className="space-y-4">
              {interviews.map((interview) => (
                <motion.div
                  key={interview.id}
                  whileHover={{ x: 5 }}
                  onClick={handleClick}
                  className="cursor-pointer p-4 bg-black/30 rounded-md border border-white/10 hover:border-secondary/50 transition-all"
                >
                  <h4 className="text-white font-semibold mb-1">{interview.title}</h4>
                  <p className="text-sm text-muted-foreground">{interview.type} • {interview.duration}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="poly-surface-elevated rounded-lg p-6 border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-accent" />
              <h3 className="text-2xl font-bold text-white">Blog</h3>
            </div>
            <div className="space-y-4">
              {blog.map((post) => (
                <motion.div
                  key={post.id}
                  whileHover={{ x: 5 }}
                  onClick={handleClick}
                  className="cursor-pointer p-4 bg-black/30 rounded-md border border-white/10 hover:border-secondary/50 transition-all"
                >
                  <h4 className="text-white font-semibold mb-1">{post.title}</h4>
                  <p className="text-sm text-muted-foreground">{post.date}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LatestContent;
