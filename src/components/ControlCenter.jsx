import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, ChevronRight, Edit3, Heart, LogOut, Mail, Settings, Shield, Ticket, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/customSupabaseClient';
import { LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import EditProfile from '@/components/EditProfile';

const ROLE_META = {
  citizen:  { label: 'Wave Citizen',  color: 'rgba(255,255,255,0.9)', glow: 'rgba(255,255,255,0.12)'  },
  artist:   { label: 'Artista',       color: '#7C5CFF', glow: 'rgba(124,92,255,0.2)'  },
  promoter: { label: 'Promotor',      color: '#FF8A1F', glow: 'rgba(255,138,31,0.2)'  },
  club:     { label: 'Club / Venue',  color: '#5DE0A3', glow: 'rgba(93,224,163,0.2)'  },
  admin:    { label: 'Admin',         color: '#D946EF', glow: 'rgba(217,70,239,0.2)'  },
};

function SettingsTile({ icon: Icon, label, description, color = 'rgba(255,255,255,0.9)', onClick, badge, delay = 0 }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ x: 4 }}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left group"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${color}35`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{label}</p>
        {description && <p className="text-xs text-white/40 mt-0.5 truncate">{description}</p>}
      </div>
      {badge && (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: `${color}18`, color }}
        >
          {badge}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
    </motion.button>
  );
}

export default function ControlCenter({ setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

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
            background: `linear-gradient(135deg, ${roleMeta.color}14 0%, rgba(10,15,14,0.95) 60%)`,
            border: `1px solid ${roleMeta.color}22`,
            minHeight: 160,
          }}
        >
          {/* Background glow */}
          <div
            className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${roleMeta.color}25, transparent 70%)`,
              transform: 'translate(35%, -35%)',
            }}
          />

          <div className="relative z-10 p-6 flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-black"
                style={{
                  background: `${roleMeta.color}22`,
                  color: roleMeta.color,
                  border: `2px solid ${roleMeta.color}40`,
                  boxShadow: `0 0 24px ${roleMeta.glow}`,
                }}
              >
                {avatar ? (
                  <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {isAdmin && (
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#D946EF', border: '2px solid #080E09' }}
                >
                  <Shield className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-2"
                style={{ background: `${roleMeta.color}18`, color: roleMeta.color }}
              >
                {roleMeta.label}
              </span>
              <h1 className="text-xl font-black text-white leading-tight truncate">{displayName}</h1>
              {profile?.username && (
                <p className="text-xs text-white/40 mt-0.5">@{profile.username}</p>
              )}
              {profile?.city && (
                <p className="text-xs text-white/30 mt-0.5">{profile.city}</p>
              )}
            </div>
          </div>

          <div className="relative z-10 px-6 pb-5 flex items-center gap-4 text-xs text-white/30">
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Cuenta</p>
          <div className="space-y-2">
            <SettingsTile
              icon={Edit3}
              label="Editar Perfil"
              description="Nombre, bio, avatar y redes sociales"
              color="rgba(255,255,255,0.9)"
              onClick={() => setEditOpen(true)}
              delay={0.05}
            />
            <SettingsTile
              icon={Ticket}
              label="Ticket Vault"
              description="Tus entradas y eventos"
              color="#FFB020"
              onClick={() => setCurrentSection?.('tickets')}
              delay={0.1}
            />
            <SettingsTile
              icon={Heart}
              label="Mi Panel"
              description="Perfil público, favoritos y actividad"
              color="#F87171"
              onClick={() => setCurrentSection?.('my-panel')}
              delay={0.15}
            />
          </div>
        </div>

        {/* Preferences */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Preferencias</p>
          <div className="space-y-2">
            <SettingsTile
              icon={Bell}
              label="Notificaciones"
              description="Alertas de eventos y actividad"
              color="#5DE0A3"
              badge="Pronto"
              onClick={() => toast({ title: 'Próximamente', description: 'Estamos trabajando en las notificaciones.' })}
              delay={0.2}
            />
            <SettingsTile
              icon={Zap}
              label="Calidad de Audio"
              description="Ajustar bitrate del stream"
              color="#7C5CFF"
              badge="Pronto"
              onClick={() => toast({ title: 'Próximamente', description: 'Próxima actualización.' })}
              delay={0.25}
            />
          </div>
        </div>

        {/* Admin */}
        {isAdmin && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Administración</p>
            <SettingsTile
              icon={Shield}
              label="Panel de Administración"
              description="Gestionar usuarios, eventos y contenido"
              color="#D946EF"
              onClick={() => navigate('/admin')}
              delay={0.3}
            />
          </div>
        )}

        {/* Logout */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Sesión</p>
          <motion.button
            type="button"
            onClick={handleLogout}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 28 }}
            whileHover={{ x: 4 }}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left group"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-400">Cerrar sesión</p>
              <p className="text-xs text-red-400/50 mt-0.5 truncate">{currentUser.email}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400/30 group-hover:text-red-400/60 transition-colors shrink-0" />
          </motion.button>
        </div>
      </div>
    </>
  );
}
