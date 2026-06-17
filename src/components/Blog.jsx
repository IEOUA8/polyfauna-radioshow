import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Blog = () => {
  const { toast } = useToast();

  const articles = [
    {
      id: 1,
      title: 'The Evolution of Experimental Techno',
      author: 'Maria Valencia',
      date: 'Dec 8, 2025',
      category: 'Scene Chronicle',
      excerpt: 'Exploring how experimental techno music has transformed and shaped the underground scene over the past decade.',
    },
    {
      id: 2,
      title: 'Event Review: Fractal Frequencies',
      author: 'Carlos Mesa',
      date: 'Dec 5, 2025',
      category: 'Event Review',
      excerpt: "A recap of last weekend's incredible showcase featuring some of the region's finest electronic music talent.",
    },
    {
      id: 3,
      title: 'New Release: POLYFAUNA Compilation Vol. 2',
      author: 'Ana Torres',
      date: 'Dec 3, 2025',
      category: 'Music Release',
      excerpt: "Celebrating local producers with a fresh compilation of tracks that capture the essence of our avant-garde sound.",
    },
    {
      id: 4,
      title: 'The Rise of Ambient Music',
      author: 'Sofia Luna',
      date: 'Nov 30, 2025',
      category: 'Scene Chronicle',
      excerpt: "How ambient and experimental electronic music is finding a dedicated audience in underground circles.",
    },
    {
      id: 5,
      title: 'Interview Highlight: DJ Fractal',
      author: 'Laura Mendez',
      date: 'Nov 28, 2025',
      category: 'Artist Feature',
      excerpt: "Key takeaways from our in-depth conversation with one of the most influential experimental DJs.",
    },
    {
      id: 6,
      title: 'Event Preview: Synthesis Festival 2025',
      author: 'DJ Marco',
      date: 'Nov 25, 2025',
      category: 'Event Preview',
      excerpt: "Everything you need to know about the upcoming festival that will unite the electronic music community.",
    },
  ];

  const handleReadMore = () => {
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
          className="mb-14 text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Blog & Editorial
          </h1>
          <p className="text-xl text-muted-foreground">Stories from the electronic music scene</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article, index) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="poly-surface rounded-3xl overflow-hidden hover:border-secondary/50 transition-all shadow-xl flex flex-col"
            >
              <div className="h-48 bg-[#121212] relative flex items-center justify-center border-b border-white/5 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 group-hover:scale-110 transition-transform duration-700" />
                <span className="text-8xl opacity-10 filter blur-[2px] transform -rotate-12">📝</span>
              </div>

              <div className="p-8 flex-1 flex flex-col">
                <span className="inline-block self-start px-3 py-1 bg-secondary/20 border border-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-wide mb-4">
                  {article.category}
                </span>

                <h2 className="text-2xl font-bold text-white mb-3 line-clamp-2 leading-tight">
                  {article.title}
                </h2>

                <p className="text-muted-foreground text-base mb-6 line-clamp-3 flex-1">
                  {article.excerpt}
                </p>

                <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground mb-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span>{article.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span>{article.date}</span>
                  </div>
                </div>

                <Button 
                  onClick={handleReadMore}
                  variant="ghost" 
                  className="w-full justify-between text-white hover:text-white bg-[#222222] hover:bg-primary/20 h-12 rounded-xl"
                >
                  <span className="font-bold tracking-wide">Read More</span>
                  <ArrowRight className="w-5 h-5 text-primary" />
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Blog;