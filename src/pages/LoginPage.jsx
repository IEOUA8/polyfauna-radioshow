import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/customSupabaseClient';

// ── Reset Password view (PASSWORD_RECOVERY session) ──────────────────────────

function ResetPasswordView() {
  const { updatePassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    const { error: err } = await updatePassword(password);
    if (err) { setError(err.message); }
    else { setDone(true); setTimeout(() => navigate('/login'), 2200); }
  };

  if (done) {
    return (
      <motion.div key="reset-done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 py-4">
        <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }} />
        <div>
          <h2 className="text-xl font-black text-white mb-2">¡Contraseña actualizada!</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Redirigiendo al inicio de sesión…</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="reset" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-extrabold text-white text-center mb-2">Nueva contraseña</h1>
      <p className="text-center text-sm mb-8" style={{ color: 'rgba(255,255,255,0.40)' }}>
        Elige una contraseña segura para tu cuenta.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input type="password" placeholder="Mínimo 8 caracteres" value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              disabled={isLoading} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input type="password" placeholder="Repite la contraseña" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              disabled={isLoading} />
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>
        )}

        <Button type="submit" disabled={isLoading || !password || !confirm}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold text-lg h-14 rounded-xl border-0 shadow-lg">
          {isLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando…</> : 'Guardar contraseña'}
        </Button>
      </form>
    </motion.div>
  );
}

// ── Forgot Password view ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email) { setError('Ingresa tu correo electrónico.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (err) { setError(err.message); }
    else { setSent(true); }
  };

  if (sent) {
    return (
      <motion.div
        key="sent"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-5 py-4"
      >
        <div className="flex justify-center">
          <CheckCircle2 className="w-14 h-14" style={{ color: 'rgba(255,255,255,0.75)' }} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white mb-2">Revisa tu correo</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Enviamos un enlace de recuperación a{' '}
            <span className="text-white font-bold">{email}</span>.<br />
            Puede tardar unos minutos.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold transition-colors"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
        >
          ← Volver al inicio de sesión
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div key="forgot" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-8 transition-colors"
        style={{ color: 'rgba(255,255,255,0.40)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; }}
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h1 className="text-2xl font-extrabold text-white text-center mb-2">Recuperar contraseña</h1>
      <p className="text-center text-sm mb-8" style={{ color: 'rgba(255,255,255,0.40)' }}>
        Te enviaremos un enlace para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSend} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="reset-email" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold text-lg h-14 rounded-xl border-0 shadow-lg"
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enviando…</>
          ) : (
            'Enviar enlace'
          )}
        </Button>
      </form>
    </motion.div>
  );
}

// ── Login view ────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isLoading, recoveryMode } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [mode, setMode]         = useState('login'); // 'login' | 'forgot'

  // PASSWORD_RECOVERY session detected → show reset form
  const effectiveMode = recoveryMode ? 'reset' : mode;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email || !password) { setFormError('Por favor completa todos los campos.'); return; }
    const { error } = await login(email, password);
    if (!error) { navigate('/'); }
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

          <AnimatePresence mode="wait">
            {effectiveMode === 'reset' ? (
              <ResetPasswordView key="reset" />
            ) : effectiveMode === 'forgot' ? (
              <ForgotPasswordView key="forgot" onBack={() => setMode('login')} />
            ) : (
              <motion.div key="login" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>

                <h1 className="text-3xl font-extrabold text-white text-center mb-3">Bienvenido</h1>
                <p className="text-muted-foreground text-center mb-10 text-lg">Inicia sesión en tu cuenta</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Contraseña</Label>
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-xs font-bold transition-colors"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
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
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Ingresando…</>
                    ) : (
                      'Ingresar'
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-white/5">
                  <p className="text-muted-foreground">
                    ¿No tienes cuenta?{' '}
                    <Link to="/signup" className="text-white hover:text-primary font-bold transition-colors">
                      Regístrate
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;