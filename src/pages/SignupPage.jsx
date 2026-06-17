import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setFormError('Please fill in all fields');
      return;
    }

    if (formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    const { error } = await signup(formData.email, formData.password, formData.name);
    
    if (!error) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center poly-bg px-4 py-12 overflow-hidden">
      <div className="poly-texture" />
      <Helmet>
        <title>Sign Up - POLYFAUNA - Fractal Radio / Experimental Electronic Broadcast</title>
        <meta name="description" content="Create your POLYFAUNA account" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="poly-surface rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <Logo size="lg" />
          </div>

          <h1 className="text-3xl font-extrabold text-white text-center mb-3">Create Account</h1>
          <p className="text-muted-foreground text-center mb-10 text-lg">Join the POLYFAUNA community</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="confirmPassword" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading}
                />
              </div>
            </div>

            {formError && (
              <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">{formError}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold text-lg h-14 rounded-xl border-0 shadow-lg mt-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-white hover:text-primary font-bold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;