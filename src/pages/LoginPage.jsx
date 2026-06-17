import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    const { error } = await login(email, password);
    
    if (!error) {
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center poly-bg px-4 py-12 overflow-hidden">
      <div className="poly-texture" />
      <Helmet>
        <title>Login - POLYFAUNA - Fractal Radio / Experimental Electronic Broadcast</title>
        <meta name="description" content="Login to your POLYFAUNA account" />
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

          <h1 className="text-3xl font-extrabold text-white text-center mb-3">Welcome Back</h1>
          <p className="text-muted-foreground text-center mb-10 text-lg">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-white hover:text-primary font-bold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;