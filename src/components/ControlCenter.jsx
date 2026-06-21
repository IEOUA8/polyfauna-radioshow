import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, ChevronRight, Edit3, Loader2, LogOut, Mail, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/customSupabaseClient';
import { LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import EditProfile from '@/components/EditProfile';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const ROLE_META = {
  citizen:  { label: 'Wave Citizen'       },
  artist:   { label: 'Artista'            },
  promoter: { label: 'Promotor'           },
  club:     { label: 'Club / Venue'       },
  sello:    { label: 'Sello Discográfico' },
  admin:    { label: 'Admin'              },
};

function SettingsTile({ icon: Icon, label, description, onClick, badge, delay = 0, danger = false }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ x: 4 }}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left group transition-colors"
      style={{
        background: danger ? 'rgba(239,68,68,0.05)' : 'rgba(11,16,15,0.90)',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)'}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.18)';
        e.currentTarget.style.background  = danger ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)';
        e.currentTarget.style.background  = danger ? 'rgba(239,68,68,0.05)' : 'rgba(11,16,15,0.90)';
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)' }}>
        <Icon className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-white/70'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {description && <p className={`text-xs mt-0.5 truncate ${danger ? 'text-red-400/40' : 'text-white/35'}`}>{description}</p>}
      </div>
      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
          {badge}
        </span>
      )}
      <ChevronRight className={`w-4 h-4 transition-colors shrink-0 ${danger ? 'text-red-400/30 group-hover:text-red-400/60' : 'text-white/15 group-hover:text-white/40'}`} />
    </motion.button>
  );
}

const QUALITY_KEY = 'pf_stream_quality';

const QUALITY_OPTIONS = [
  { id: 'auto',   label: 'Auto',           desc: 'Se ajusta según tu conexión' },
  { id: 'high',   label: 'Alta calidad',   desc: '320 kbps — mejor sonido' },
  { id: 'medium', label: 'Estándar',       desc: '128 kbps — balance óptimo' },
  { id: 'low',    label: 'Baja calidad',   desc: '64 kbps — ahorra datos' },
];

function AudioQualityPanel({ onClose }) {
  const [selected, setSelected] = useState(
    () => localStorage.getItem(QUALITY_KEY) || 'auto'
  );

  const handleSelect = (id) => {
    setSelected(id);
    localStorage.setItem(QUALITY_KEY, id);
    window.dispatchEvent(new CustomEvent('pf:quality-change', { detail: { quality: id } }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="mt-2 rounded-xl overflow-hidden"
      style={{ background: 'rgba(7,12,11,0.98)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
    >
      <div className="px-4 pt-3 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Calidad del stream
        </p>
      </div>
      {QUALITY_OPTIONS.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => handleSelect(opt.id)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
          style={{
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            background: selected === opt.id ? 'rgba(255,255,255,0.05)' : 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = selected === opt.id ? 'rgba(255,255,255,0.05)' : 'transparent'; }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{opt.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{opt.desc}</p>
          </div>
          {selected === opt.id && (
            <Check className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.75)' }} />
          )}
        </button>
      ))}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
          El cambio aplica al reiniciar el stream de radio.
        </p>
      </div>
    </motion.div>
  );
}

export default function ControlCenter({ setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editOpen, setEditOpen]         = useState(false);
  const [qualityOpen, setQualityOpen]   = useState(false);
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, toggle: togglePush, permission: pushPerm } = usePushNotifications(currentUser?.id);

  if (!currentUser) {
    return <div className="p-5"><LoginRequired message="Inicia sesión para acceder al Control Center." /></div>;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Sesión cerrada', description: 'Hasta pronto.' });
    navigate('/login');
  };

  const role = profile?.role || 'citizen';
  const roleMeta = ROLE_META[role] || ROLE_META.citizen;
  const isAdmin = role === 'admin';
  const displayName = profile?.display_name || currentUser.email?.split('@')[0] || 'Usuario';
  const avatar = profile?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {editOpen && (
        <EditProfile
          profile={profile}
          onSave={() => setEditOpen(false)}
          onClose={() => setEditOpen(false)}
        />
      )}

      <div className="p-5 space-y-6">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(11,16,15,0.90)',
            border: '1px solid rgba(255,255,255,0.09)',
            minHeight: 160,
          }}
        >
          <div
            className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.03), transparent 70%)',
              transform: 'translate(35%, -35%)',
            }}
          />

          <div className="relative z-10 p-6 flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-black text-white/70"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {avatar
                  ? <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                  : initials
                }
              </div>
              {isAdmin && (
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid #080E09' }}
                >
                  <Shield className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
              >
                {roleMeta.label}
              </span>
              <h1 className="text-xl font-black text-white leading-tight truncate">{displayName}</h1>
              {profile?.username && (
                <p className="text-xs text-white/35 mt-0.5">@{profile.username}</p>
              )}
              {profile?.city && (
                <p className="text-xs text-white/25 mt-0.5">{profile.city}</p>
              )}
            </div>
          </div>

          <div className="relative z-10 px-6 pb-5 flex items-center gap-4 text-xs text-white/25">
            <span className="flex items-center gap-1.5 truncate">
              <Mail className="w-3 h-3 shrink-0" />
              {currentUser.email}
            </span>
            {currentUser.created_at && (
              <span className="shrink-0">
                Desde {new Date(currentUser.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </motion.div>

        {/* Account */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Cuenta</p>
          <div className="space-y-2">
            <SettingsTile icon={Edit3} label="Editar Perfil" description="Nombre, bio, avatar y redes sociales"
              onClick={() => setEditOpen(true)} delay={0.05} />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Preferencias</p>
          <div className="space-y-2">

            {/* Push notifications toggle */}
            {pushSupported && pushPerm !== 'denied' && (
              <motion.button
                type="button"
                onClick={pushLoading ? undefined : togglePush}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22, type: 'spring', stiffness: 300, damping: 28 }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-colors"
                style={{
                  background: 'rgba(11,16,15,0.90)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  cursor: pushLoading ? 'wait' : 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(11,16,15,0.90)'; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: pushSubscribed ? 'rgba(32,199,232,0.12)' : 'rgba(255,255,255,0.06)' }}>
                  {pushLoading
                    ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                    : pushSubscribed
                      ? <Bell  className="w-4 h-4" style={{ color: '#20C7E8' }} />
                      : <BellOff className="w-4 h-4 text-white/40" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Notificaciones Push</p>
                  <p className="text-xs mt-0.5 text-white/35">
                    {pushLoading ? 'Procesando…' : pushSubscribed ? 'Activas — toca para desactivar' : 'Desactivadas — toca para activar'}
                  </p>
                </div>
                {/* Toggle pill */}
                <div className="shrink-0 w-10 h-5.5 rounded-full transition-all relative"
                  style={{
                    background: pushSubscribed ? 'rgba(32,199,232,0.65)' : 'rgba(255,255,255,0.10)',
                    width: 40, height: 22,
                  }}>
                  <div className="absolute top-[3px] rounded-full transition-all"
                    style={{
                      width: 16, height: 16, background: 'white',
                      left: pushSubscribed ? 21 : 3,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }} />
                </div>
              </motion.button>
            )}

            <div>
              <SettingsTile
                icon={Zap}
                label="Calidad de Audio"
                description={`Stream · ${QUALITY_OPTIONS.find(o => o.id === (localStorage.getItem(QUALITY_KEY) || 'auto'))?.label || 'Auto'}`}
                onClick={() => setQualityOpen(q => !q)}
                delay={0.25}
              />
              <AnimatePresence>
                {qualityOpen && <AudioQualityPanel onClose={() => setQualityOpen(false)} />}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Sesión</p>
          <SettingsTile icon={LogOut} label="Cerrar sesión" description={currentUser.email}
            onClick={handleLogout} delay={0.35} danger />
        </div>
      </div>
    </>
  );
}
