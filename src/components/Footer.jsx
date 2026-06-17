import React from 'react';
import { Radio, Instagram, Facebook, Twitter, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
const Footer = ({
  setCurrentSection
}) => {
  const {
    toast
  } = useToast();
  const handleSocialClick = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };
  const handleNavClick = section => {
    setCurrentSection(section);
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  return <footer className="bg-black/40 border-t border-white/10 py-12 px-4 mb-20">
      <div className="container mx-auto max-w-7xl">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-6 h-6 text-accent" />
              <span className="text-xl font-bold text-white">POLYFAUNA</span>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Broadcasting the pulse of Colombia's electronic music scene from the coffee region.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleSocialClick} className="text-muted-foreground hover:text-accent">
                <Instagram className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSocialClick} className="text-muted-foreground hover:text-accent">
                <Facebook className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSocialClick} className="text-muted-foreground hover:text-accent">
                <Twitter className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSocialClick} className="text-muted-foreground hover:text-accent">
                <Youtube className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div>
            <p className="font-bold text-white mb-4">Navigate</p>
            <div className="space-y-2">
              <button onClick={() => handleNavClick('home')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Home
              </button>
              <button onClick={() => handleNavClick('live')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Live 24/7
              </button>
              <button onClick={() => handleNavClick('schedule')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Schedule
              </button>
              <button onClick={() => handleNavClick('events')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Events
              </button>
            </div>
          </div>

          <div>
            <p className="font-bold text-white mb-4">Content</p>
            <div className="space-y-2">
              <button onClick={() => handleNavClick('podcasts')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Podcasts
              </button>
              <button onClick={() => handleNavClick('interviews')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Interviews
              </button>
              <button onClick={() => handleNavClick('blog')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Blog
              </button>
              <button onClick={() => handleNavClick('directory')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Directory
              </button>
            </div>
          </div>

          <div>
            <p className="font-bold text-white mb-4">Company</p>
            <div className="space-y-2">
              <button onClick={() => handleNavClick('about')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                About Us
              </button>
              <button onClick={() => handleNavClick('advertising')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Advertising
              </button>
              <button onClick={() => handleNavClick('contact')} className="block text-muted-foreground hover:text-accent text-sm transition-colors">
                Contact
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-muted-foreground text-sm">
            © 2026 POLYFAUNA. All rights reserved. Broadcasting from Colombia's Coffee Region.
          </p>
        </div>
      </div>
    </footer>;
};
export default Footer;
