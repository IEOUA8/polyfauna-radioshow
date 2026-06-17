import React from 'react';
import { motion } from 'framer-motion';
import { Radio, Heart, Target, Users } from 'lucide-react';

const About = () => {
  const values = [
    {
      icon: Radio,
      title: 'Community First',
      description: 'We believe in building and nurturing the experimental electronic music community.',
    },
    {
      icon: Heart,
      title: 'Sonic Passion',
      description: 'Our love for fractal, deep, and experimental structures drives everything we do.',
    },
    {
      icon: Target,
      title: 'Quality Curation',
      description: 'We carefully select every show, podcast, and event to ensure a cerebral experience.',
    },
    {
      icon: Users,
      title: 'Artist Support',
      description: 'Supporting local DJs, producers, and collectives is at the heart of our mission.',
    },
  ];

  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 poly-bg overflow-hidden">
      <div className="poly-texture" />
      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            About POLYFAUNA
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Broadcasting the pulse of the experimental electronic music scene
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="poly-surface rounded-[2.5rem] p-8 md:p-14 mb-16"
        >
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4 inline-block">Our Story</h2>
          <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
            <p>
              POLYFAUNA was born from a simple idea: to create a platform that celebrates and amplifies the vibrant experimental electronic music scene. What started as an underground community project has grown into a comprehensive platform connecting avant-garde DJs, producers, collectives, and music lovers.
            </p>
            <p>
              Our 24/7 streaming service brings you the best in techno, house, ambient, and experimental electronic music, curated by passionate DJs who understand the scene intimately. Beyond the airwaves, we organize events, produce podcasts, conduct interviews, and maintain an active editorial presence documenting the evolution of our electronic culture.
            </p>
            <p>
              We're more than just a radio station – we're a community hub, a cultural platform, and a launching pad for emerging talent. Every show, every event, and every piece of content we produce is guided by our commitment to quality, authenticity, and the belief that music has the power to shift consciousness.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Our Mission & Vision</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="poly-surface-elevated rounded-3xl p-10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-3xl font-extrabold text-primary mb-6 relative z-10">Mission</h3>
              <p className="text-muted-foreground text-lg leading-relaxed relative z-10">
                To provide a professional platform that showcases, supports, and elevates electronic music culture, creating opportunities for local artists while building a passionate and engaged community of music lovers.
              </p>
            </div>
            <div className="poly-surface-elevated rounded-3xl p-10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-3xl font-extrabold text-secondary mb-6 relative z-10">Vision</h3>
              <p className="text-muted-foreground text-lg leading-relaxed relative z-10">
                To become a leading experimental platform, recognized internationally for our quality curation, artist development, and contribution to the cultural landscape of underground music.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="poly-surface rounded-3xl p-8 hover:border-primary/50 transition-all duration-300"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-inner">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{value.title}</h3>
                <p className="text-muted-foreground text-lg">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;