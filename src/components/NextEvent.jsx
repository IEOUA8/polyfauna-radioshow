import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const NextEvent = () => {
  const { toast } = useToast();

  const handleTicketClick = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto poly-surface-elevated rounded-lg overflow-hidden border-white/10"
        >
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative h-64 md:h-auto">
              <img 
                alt="Electronic music festival with vibrant lights and crowd"
                className="w-full h-full object-cover"
               src="https://images.unsplash.com/photo-1648999599621-2cb444c49236" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
            </div>
            
            <div className="p-8 md:p-10">
              <span className="inline-block px-4 py-1 bg-accent/15 border border-accent/30 text-accent text-xs font-bold rounded-full mb-4 tracking-[0.18em]">
                NEXT EVENT
              </span>
              
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
                Frequencies Festival 2026
              </h2>
              
              <p className="text-foreground/76 mb-6 leading-relaxed">
                Join us for an unforgettable night featuring the best electronic music collectives from Pereira, Manizales, and Armenia.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-foreground/80">
                  <Calendar className="w-5 h-5 text-accent" />
                  <span>Saturday, December 21, 2026 - 9:00 PM</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/80">
                  <MapPin className="w-5 h-5 text-accent" />
                  <span>Club Sonido, Pereira</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 bg-primary/20 text-foreground border border-primary/30 rounded-full text-sm">Techno</span>
                <span className="px-3 py-1 bg-secondary/20 text-foreground border border-secondary/30 rounded-full text-sm">House</span>
                <span className="px-3 py-1 bg-accent/15 text-foreground border border-accent/30 rounded-full text-sm">Minimal</span>
              </div>
              
              <Button 
                onClick={handleTicketClick}
                className="w-full rounded-md bg-white text-black hover:bg-accent hover:text-white font-semibold"
              >
                <Ticket className="w-5 h-5 mr-2" />
                Get Tickets
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NextEvent;
