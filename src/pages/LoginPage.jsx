import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/Logo';
import supabase from '@/lib/customSupabaseClient';

function getLoginErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos. Verifica los datos e intenta nuevamente.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Debes confirmar tu correo antes de iniciar sesión. Revisa también la carpeta de spam.';
  }
  if (code.includes('rate') || code.includes('over_request') || message.includes('too many requests')) {
    return 'Has realizado varios intentos. Espera unos minutos antes de volver a probar.';
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('tardó demasiado')) {
    return 'No pudimos conectar con PolyFauna. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No pudimos iniciar sesión. Revisa tus datos e intenta nuevamente.';
}

// ── Reset Password view (PASSWORD_RECOVERY session) ──────────────────────────

function ResetPasswordView() {
  const { updatePassword, exitRecoveryMode } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);
  // Estado propio en vez del isLoading global de AuthContext: ese flag
  // tambien lo usan consumePendingOAuthRole/fetchUserProfile de fondo, sin
  // relacion con este formulario — si algo ahi se colgaba, este boton
  // quedaba en "Guardando..." para siempre aunque updatePassword() ya
  // hubiera terminado.
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setSubmitting(true);
    const { error: err } = await updatePassword(password);
    setSubmitting(false);
    if (err) { setError(err.message); }
    else {
      setDone(true);
      // La sesión de recuperación ya es válida (probó ser el dueño de la
      // cuenta al abrir el enlace), así que en vez de mandarlo de vuelta a
      // /login para que inicie sesión otra vez, se lo lleva ya logueado a
      // la plataforma — recién ahora se apaga recoveryMode, después de que
      // ya vio la confirmación (apagarlo antes salta directo a la
      // plataforma sin mostrar este mensaje).
      setTimeout(() => { exitRecoveryMode(); navigate('/', { replace: true }); }, 1800);
    }
  };

  if (done) {
    return (
      <motion.div key="reset-done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 py-4">
        <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }} />
        <div>
          <h2 className="text-xl font-black text-white mb-2">¡Tu contraseña ha sido actualizada exitosamente!</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Te estamos llevando a la plataforma…</p>
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
            <PasswordInput placeholder="Mínimo 8 caracteres" value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              disabled={submitting} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <PasswordInput placeholder="Repite la contraseña" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
              disabled={submitting} />
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>
        )}

        <Button type="submit" disabled={submitting || !password || !confirm}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold text-lg h-14 rounded-xl border-0 shadow-lg">
          {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando…</> : 'Guardar contraseña'}
        </Button>
      </form>
    </motion.div>
  );
}

// ── Forgot Password view ──────────────────────────────────────────────────────
function ForgotPasswordView({ onBack, initialError }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');
  const [linkError, setLinkError] = useState(initialError || '');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email) { setError('Ingresa tu correo electrónico.'); return; }
    setLoading(true);
    setError('');
    setLinkError('');
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
            Puede tardar unos minutos. Si no lo ves, revisa tu carpeta de spam o correo no deseado.
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

      {linkError && (
        <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20 mb-6">
          {linkError}
        </p>
      )}

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
  const [searchParams] = useSearchParams();
  const { currentUser, login, isLoading, recoveryMode } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [mode, setMode]         = useState('login'); // 'login' | 'forgot'
  const [recoveryLinkError, setRecoveryLinkError] = useState('');

  // PASSWORD_RECOVERY session detected → show reset form
  const effectiveMode = recoveryMode ? 'reset' : mode;
  const requestedNext = searchParams.get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/';

  useEffect(() => {
    if (currentUser && !recoveryMode) navigate(nextPath, { replace: true });
  }, [currentUser, navigate, nextPath, recoveryMode]);

  // Un enlace de recuperación vencido o ya usado (p.ej. abierto dos veces, o
  // "previsualizado" por un escáner de seguridad del correo) hace que Supabase
  // redirija con el error en el hash en vez de iniciar sesión de recuperación.
  // Sin esto, el usuario solo veía el formulario de login normal, sin ninguna
  // pista de qué pasó con su enlace.
  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const hashParams = new URLSearchParams(hash);
    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    if (!errorCode) return;
    setRecoveryLinkError(
      errorCode === 'otp_expired'
        ? 'Ese enlace de recuperación ya expiró o ya fue usado. Solicita uno nuevo.'
        : 'Ese enlace de recuperación no es válido. Solicita uno nuevo.'
    );
    setMode('forgot');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email || !password) { setFormError('Por favor completa todos los campos.'); return; }
    const { error } = await login(email, password);
    if (error) {
      setFormError(getLoginErrorMessage(error));
      return;
    }
    navigate(nextPath);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center poly-bg px-4 py-8 sm:py-12 overflow-hidden">
      <div className="poly-texture" />
      <Helmet>
        <title>Iniciar sesión — POLYFAUNA</title>
        <meta name="description" content="Inicia sesión en POLYFAUNA para guardar música, gestionar tickets y participar en la comunidad." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://www.polyfauna.com/login" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="poly-surface rounded-[2rem] sm:rounded-[2.5rem] p-7 sm:p-10 md:p-12 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-7 sm:mb-9">
            <div className="w-[210px] sm:w-[250px]">
              <Logo variant="header" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {effectiveMode === 'reset' ? (
              <ResetPasswordView key="reset" />
            ) : effectiveMode === 'forgot' ? (
              <ForgotPasswordView key="forgot" onBack={() => setMode('login')} initialError={recoveryLinkError} />
            ) : (
              <motion.div key="login" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>

                <div className="text-center mb-8">
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
                    style={{ color: 'rgba(184,207,166,0.55)', fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Acceso al bioma
                  </p>
                  <h1 className="font-display text-3xl sm:text-4xl font-medium text-white mb-3">Bienvenido</h1>
                  <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'rgba(184,207,166,0.62)' }}>
                    Entra a tu organismo: música guardada, tickets, comunidad y señales del ecosistema Polyfauna.
                  </p>
                </div>

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
                        onChange={(e) => { setEmail(e.target.value); if (formError) setFormError(''); }}
                        autoComplete="email"
                        aria-invalid={Boolean(formError)}
                        aria-describedby={formError ? 'login-error' : undefined}
                        className={`pl-12 h-14 bg-[#121212] text-white rounded-xl placeholder:text-white/20 focus:ring-1 transition-all text-base ${formError ? 'border-red-400/70 focus:border-red-400 focus:ring-red-400/25' : 'border-white/10 focus:border-primary focus:ring-primary'}`}
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
                      <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (formError) setFormError(''); }}
                        autoComplete="current-password"
                        aria-invalid={Boolean(formError)}
                        aria-describedby={formError ? 'login-error' : undefined}
                        className={`pl-12 h-14 bg-[#121212] text-white rounded-xl placeholder:text-white/20 focus:ring-1 transition-all text-base ${formError ? 'border-red-400/70 focus:border-red-400 focus:ring-red-400/25' : 'border-white/10 focus:border-primary focus:ring-primary'}`}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {formError && (
                    <div
                      id="login-error"
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start gap-2.5 text-red-200 text-sm font-semibold bg-red-500/10 p-3 rounded-xl border border-red-400/25"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
                      <p>{formError}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full hover:opacity-90 font-bold text-lg h-14 rounded-xl border-0 shadow-lg mt-4"
                    style={{ background: 'rgba(236,236,236,0.92)', color: '#080D0B' }}
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
                    <Link to={`/signup?next=${encodeURIComponent(nextPath)}`} className="text-white hover:text-primary font-bold transition-colors">
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
