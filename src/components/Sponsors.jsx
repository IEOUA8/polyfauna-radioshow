import React from 'react';
import { motion } from 'framer-motion';

const Sponsors = () => {
  const sponsors = [
    { id: 1, name: 'Sponsor 1' },
    { id: 2, name: 'Sponsor 2' },
    { id: 3, name: 'Sponsor 3' },
    { id: 4, name: 'Sponsor 4' },
    { id: 5, name: 'Sponsor 5' },
    { id: 6, name: 'Sponsor 6' },
  ];

  return (
    <section className="py-20 px-4 bg-black/20">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent mb-3">Partners</p>
          <h2 className="text-3xl md:text-4xl font-black mb-4 text-white">Our Sponsors</h2>
          <p className="text-muted-foreground">Supporting the electronic music scene</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {sponsors.map((sponsor, index) => (
            <motion.div
              key={sponsor.id}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="backdrop-blur-xl bg-white/5 rounded-lg p-6 border border-white/10 hover:border-secondary/50 transition-all flex items-center justify-center aspect-square"
            >
              <span className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">{sponsor.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Sponsors;
