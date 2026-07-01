import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Music, Briefcase, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    inquiryType: 'general',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const inquiryTypes = [
    { id: 'general', label: 'General Inquiry', icon: MessageSquare },
    { id: 'booking', label: 'DJ Booking', icon: Music },
    { id: 'press', label: 'Press & Media', icon: Briefcase },
    { id: 'collaboration', label: 'Collaboration', icon: Send },
  ];

  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 poly-bg overflow-hidden">
      <div className="poly-texture" />
      <div className="container mx-auto max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Get In Touch
          </h1>
          <p className="text-xl text-muted-foreground">We'd love to hear from you</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-14">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="poly-surface rounded-3xl p-8 text-center hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
              <Mail className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Email</h3>
            <a
              href="mailto:info@polyfauna.com"
              className="text-muted-foreground font-medium hover:text-primary transition-colors"
            >
              info@polyfauna.com
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="poly-surface rounded-3xl p-8 text-center hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-20 h-20 mx-auto bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 border border-secondary/20">
              <Phone className="w-10 h-10 text-secondary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Phone</h3>
            <p className="text-muted-foreground font-medium">+57 300 123 4567</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="poly-surface rounded-3xl p-8 text-center hover:-translate-y-2 transition-transform duration-300"
          >
            <div className="w-20 h-20 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20">
              <MapPin className="w-10 h-10 text-accent" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Location</h3>
            <p className="text-muted-foreground font-medium">Global Broadcast</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="poly-surface-elevated rounded-[2.5rem] p-8 md:p-14"
        >
          <h2 className="text-3xl font-bold text-white mb-10">Send Us a Message</h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                Inquiry Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inquiryTypes.map((type) => (
                  <Button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, inquiryType: type.id })}
                    className={`flex flex-col items-center gap-3 h-auto py-6 rounded-2xl border transition-all duration-300 ${
                      formData.inquiryType === type.id
                        ? 'bg-primary/20 text-primary border-primary hover:bg-primary/30'
                        : 'bg-[#1A1A1A] text-muted-foreground border-white/5 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <type.icon className="w-6 h-6" />
                    <span className="font-bold tracking-wide">{type.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-4 bg-[#121212] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/20"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-4 bg-[#121212] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/20"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Subject *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-5 py-4 bg-[#121212] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/20"
                placeholder="What is this regarding?"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Message *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-5 py-4 bg-[#121212] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/20 resize-none"
                placeholder="Tell us more about your inquiry..."
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white text-lg font-bold px-12 h-16 rounded-2xl border-0 shadow-[0_0_30px_rgba(15,76,58,0.3)]"
            >
              <Send className="w-5 h-5 mr-3" />
              Send Message
            </Button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
