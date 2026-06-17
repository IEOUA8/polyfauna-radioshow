import React from 'react';
import { motion } from 'framer-motion';
import { Megaphone, TrendingUp, Users, Radio, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Advertising = () => {
  const { toast } = useToast();

  const packages = [
    {
      id: 1,
      title: 'Banner Advertising',
      description: 'Display your brand across our website with strategic banner placements.',
      features: ['Homepage placement', 'Targeted page ads', 'Mobile optimized', 'Monthly analytics'],
      icon: TrendingUp,
    },
    {
      id: 2,
      title: 'Sponsored Shows',
      description: 'Partner with our DJs for sponsored show segments and brand integration.',
      features: ['Brand mentions', 'Custom segments', 'Social media promotion', 'Audience engagement'],
      icon: Radio,
    },
    {
      id: 3,
      title: 'Event Partnership',
      description: 'Become an official sponsor of our events and festivals.',
      features: ['Logo placement', 'On-site activation', 'VIP access', 'Content collaboration'],
      icon: Users,
    },
  ];

  const stats = [
    { value: '50K+', label: 'Monthly Listeners' },
    { value: '15K+', label: 'Social Media Followers' },
    { value: '100+', label: 'Events Per Year' },
    { value: '25+', label: 'Active DJs & Collectives' },
  ];

  const handleContact = () => {
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
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border border-primary/20 mb-6 shadow-[0_0_30px_rgba(15,76,58,0.3)]">
            <Megaphone className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Advertising & Partnership
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Connect with an engaged experimental electronic music community
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-20"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="poly-surface rounded-3xl p-6 md:p-8 text-center"
            >
              <p className="text-4xl md:text-5xl font-extrabold text-secondary mb-2 drop-shadow-md">{stat.value}</p>
              <p className="text-sm md:text-base text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-20"
        >
          <h2 className="text-3xl font-bold text-white mb-10 text-center">Advertising Options</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ y: -10 }}
                className="poly-surface rounded-[2.5rem] p-10 flex flex-col hover:border-primary/50 transition-all duration-300 shadow-xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#121212] border border-white/5 flex items-center justify-center mb-6">
                  <pkg.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{pkg.title}</h3>
                <p className="text-muted-foreground text-lg mb-8 flex-1">{pkg.description}</p>
                <ul className="space-y-4 mb-10">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-white font-medium">
                      <span className="w-2 h-2 bg-secondary rounded-full shadow-[0_0_8px_rgba(139,58,139,0.8)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button onClick={handleContact} className="w-full bg-[#222222] border border-white/10 hover:border-primary hover:bg-primary/20 hover:text-white text-muted-foreground font-bold h-14 rounded-xl text-lg transition-all duration-300">
                  Learn More
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="poly-surface-elevated rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 pointer-events-none" />
          <div className="relative z-10">
            <Mail className="w-16 h-16 text-white mx-auto mb-6 drop-shadow-lg" />
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              Ready to Reach Our Audience?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Let's discuss how we can create a custom advertising solution for your brand that resonates with our unique listener base.
            </p>
            <Button 
              onClick={handleContact}
              size="lg" 
              className="bg-white text-black hover:bg-gray-200 font-extrabold text-lg px-12 h-16 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)] border-0"
            >
              Contact Us Today
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Advertising;