import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2, Check } from 'lucide-react';
import Logo from '@/components/Logo';

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Seguridad: <span style={{ color: strength >= 3 ? '#4ade80' : strength >= 2 ? '#facc15' : '#f87171' }}>
          {labels[strength]}
        </span>
      </p>
    </div>
  );
}

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, isLoading } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setFormError('Por favor completa todos los campos.');
      return;
    }
    if (formData.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }

    const { error } = await signup(formData.email, formData.password, formData.name);
    if (!error) navigate('/');
  };

  const passwordsMatch = formData.confirmPassword && formData.password === formData.confirmPassword;

  return (
    <div className="relative min-h-screen flex items-center justify-center poly-bg px-4 py-12 overflow-hidden">
      <div className="poly-texture" />
      <Helmet>
        <title>Crear Cuenta - POLYFAUNA</title>
        <meta name="description" content="Únete a la comunidad POLYFAUNA" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="poly-surface rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-10">
            <Logo size="lg" />
          </div>

          <h1 className="text-3xl font-extrabold text-white text-center mb-3">Crear Cuenta</h1>
          <p className="text-muted-foreground text-center mb-10 text-lg">Únete a la comunidad POLYFAUNA</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">
                Nombre
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="name" name="name" type="text" placeholder="Tu nombre"
                  value={formData.name} onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading} />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="email" name="email" type="email" placeholder="tu@correo.com"
                  value={formData.email} onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading} />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres"
                  value={formData.password} onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading} />
              </div>
              <StrengthBar password={formData.password} />
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground font-bold uppercase tracking-wider text-xs">
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repite tu contraseña"
                  value={formData.confirmPassword} onChange={handleChange}
                  className="pl-12 h-14 bg-[#121212] border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base"
                  disabled={isLoading} />
                {passwordsMatch && (
                  <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                )}
              </div>
            </div>

            {formError && (
              <p className="text-destructive text-sm font-bold text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {formError}
              </p>
            )}

            <Button type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold text-lg h-14 rounded-xl border-0 shadow-lg mt-4"
              disabled={isLoading}>
              {isLoading
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creando cuenta…</>
                : 'Crear cuenta'
              }
            </Button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <p className="text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-white hover:text-primary font-bold transition-colors">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
