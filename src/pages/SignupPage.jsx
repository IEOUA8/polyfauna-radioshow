import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2, Check, ChevronLeft, ChevronRight, Headphones, Mic2, Megaphone, Building2, Disc } from 'lucide-react';
import Logo from '@/components/Logo';

const ROLES = [
  {
    id: 'citizen',
    label: 'Raver / Oyente',
    icon: Headphones,
    description: 'Escucha radio, podcasts y asiste a eventos.',
    approval: false,
    color: '#20C7E8',
  },
  {
    id: 'artist',
    label: 'Artista',
    icon: Mic2,
    description: 'Comparte tu música y conecta con la comunidad.',
    approval: true,
    color: '#A855F7',
  },
  {
    id: 'promoter',
    label: 'Promotor',
    icon: Megaphone,
    description: 'Organiza eventos y vende tickets en la plataforma.',
    approval: true,
    color: '#F97316',
  },
  {
    id: 'club',
    label: 'Club / Venue',
    icon: Building2,
    description: 'Gestiona tu espacio y programa tus eventos.',
    approval: true,
    color: '#EF4444',
  },
  {
    id: 'sello',
    label: 'Sello Discográfico',
    icon: Disc,
    description: 'Administra artistas y lanza contenido desde tu sello.',
    approval: true,
    color: '#10B981',
  },
];

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
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : 'bg-white/10'}`} />
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

// ── Step 1: Role selector ─────────────────────────────────────────────────────

function RoleStep({ selected, onSelect, onNext }) {
  return (
    <motion.div
      key="role-step"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-white mb-1">¿Cómo quieres participar?</h1>
        <p className="text-sm text-white/40">Elige tu rol en la comunidad POLYFAUNA</p>
      </div>

      <div className="space-y-2.5">
        {ROLES.map(role => {
          const Icon = role.icon;
          const isSelected = selected === role.id;
          return (
            <motion.button
              key={role.id}
              type="button"
              onClick={() => onSelect(role.id)}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
              style={{
                background: isSelected ? `${role.color}12` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isSelected ? role.color + '55' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: isSelected ? `${role.color}22` : 'rgba(255,255,255,0.06)' }}
              >
                <Icon className="w-5 h-5" style={{ color: isSelected ? role.color : 'rgba(255,255,255,0.35)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold" style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.7)' }}>
                    {role.label}
                  </p>
                  {role.approval && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                      Requiere aprobación
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{role.description}</p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: role.color }}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={onNext}
        disabled={!selected}
        className="w-full h-13 rounded-xl font-bold text-base flex items-center justify-center gap-2 border-0 disabled:opacity-40"
        style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
      >
        Continuar
        <ChevronRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

// ── Step 2: Account details ───────────────────────────────────────────────────

function DetailsStep({ formData, onChange, onBack, onSubmit, isLoading, formError, selectedRole }) {
  const role = ROLES.find(r => r.id === selectedRole);
  const passwordsMatch = formData.confirmPassword && formData.password === formData.confirmPassword;

  return (
    <motion.div
      key="details-step"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-white">Crear cuenta</h1>
          {role && (
            <p className="text-xs mt-0.5" style={{ color: role.color }}>
              {role.label}
              {role.approval && ' · sujeto a aprobación'}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nombre */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-white/40 font-bold uppercase tracking-wider text-[10px]">Nombre</Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input id="name" name="name" type="text" placeholder="Tu nombre"
              value={formData.name} onChange={onChange}
              className="pl-11 h-12 bg-white/5 border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-white/30 text-sm"
              disabled={isLoading} />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-white/40 font-bold uppercase tracking-wider text-[10px]">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input id="email" name="email" type="email" placeholder="tu@correo.com"
              value={formData.email} onChange={onChange}
              className="pl-11 h-12 bg-white/5 border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-white/30 text-sm"
              disabled={isLoading} />
          </div>
        </div>

        {/* Contraseña */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-white/40 font-bold uppercase tracking-wider text-[10px]">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres"
              value={formData.password} onChange={onChange}
              className="pl-11 h-12 bg-white/5 border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-white/30 text-sm"
              disabled={isLoading} />
          </div>
          <StrengthBar password={formData.password} />
        </div>

        {/* Confirmar */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-white/40 font-bold uppercase tracking-wider text-[10px]">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repite tu contraseña"
              value={formData.confirmPassword} onChange={onChange}
              className="pl-11 h-12 bg-white/5 border-white/10 text-white rounded-xl placeholder:text-white/20 focus:border-white/30 text-sm"
              disabled={isLoading} />
            {passwordsMatch && (
              <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
            )}
          </div>
        </div>

        {formError && (
          <p className="text-sm font-bold text-center bg-red-500/10 text-red-400 p-3 rounded-xl border border-red-500/20">
            {formError}
          </p>
        )}

        <Button type="submit"
          className="w-full h-13 rounded-xl font-bold text-base border-0 flex items-center justify-center gap-2 mt-2"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
          disabled={isLoading}>
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Creando cuenta…</>
            : 'Crear cuenta'
          }
        </Button>
      </form>
    </motion.div>
  );
}

// ── Success / pending view ────────────────────────────────────────────────────

function PendingView({ role }) {
  const roleInfo = ROLES.find(r => r.id === role);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-5 py-4"
    >
      <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
        style={{ background: roleInfo ? `${roleInfo.color}18` : 'rgba(255,255,255,0.07)' }}>
        <Check className="w-8 h-8" style={{ color: roleInfo?.color || 'white' }} />
      </div>
      <div>
        <h2 className="text-xl font-black text-white">¡Cuenta creada!</h2>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          Tu solicitud como <strong className="text-white">{roleInfo?.label}</strong> está en revisión.
          Mientras tanto puedes explorar la plataforma como oyente.
        </p>
      </div>
      <Link
        to="/"
        className="block w-full py-3 rounded-xl font-bold text-sm text-center transition-all"
        style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
      >
        Ir a la plataforma →
      </Link>
    </motion.div>
  );
}

// ── Main SignupPage ───────────────────────────────────────────────────────────

const SignupPage = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [step, setStep] = useState('role');   // 'role' | 'details' | 'pending'
  const [selectedRole, setSelectedRole] = useState('citizen');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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

    setIsLoading(true);
    const { data, error } = await signup(formData.email, formData.password, formData.name, selectedRole);
    setIsLoading(false);

    if (error) return;

    if (selectedRole === 'citizen') {
      navigate('/');
    } else {
      setStep('pending');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center poly-bg px-4 py-12 overflow-hidden">
      <div className="poly-texture" />
      <Helmet>
        <title>Crear Cuenta - POLYFAUNA</title>
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="poly-surface rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Logo size="lg" />
          </div>

          <AnimatePresence mode="wait">
            {step === 'role' && (
              <RoleStep
                key="role"
                selected={selectedRole}
                onSelect={setSelectedRole}
                onNext={() => setStep('details')}
              />
            )}
            {step === 'details' && (
              <DetailsStep
                key="details"
                formData={formData}
                onChange={handleChange}
                onBack={() => setStep('role')}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                formError={formError}
                selectedRole={selectedRole}
              />
            )}
            {step === 'pending' && (
              <PendingView key="pending" role={selectedRole} />
            )}
          </AnimatePresence>

          {step !== 'pending' && (
            <div className="mt-6 text-center pt-5 border-t border-white/5">
              <p className="text-sm text-white/40">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-white/80 hover:text-white font-bold transition-colors">
                  Iniciar sesión
                </Link>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
