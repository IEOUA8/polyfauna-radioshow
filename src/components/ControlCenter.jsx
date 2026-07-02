import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, BellOff, Building2, CalendarDays, Check, ChevronRight, Disc3, Dna, Edit3, FileText, Gauge, Headphones, Info, Loader2, LogOut, Mail, Mic2, Shield, Upload, UserX, Users, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import supabase from '@/lib/customSupabaseClient';
import { LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import EditProfile from '@/components/EditProfile';
import UploadPodcastModal from '@/components/UploadPodcastModal';
import RoleRequestsPanel from '@/components/RoleRequestsPanel';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const ROLE_META = {
  citizen:  { label: 'Oyente',             description: 'Explora, escucha y alimenta tu Organismo.', color: '#B8CFA6', icon: Headphones },
  artist:   { label: 'Artista',            description: 'Publica mixes, sesiones y presencia sonora.', color: '#A78BFA', icon: Mic2 },
  promoter: { label: 'Promotor',           description: 'Activa eventos, comunidad y convocatorias.', color: '#FF8A1F', icon: CalendarDays },
  club:     { label: 'Club / Venue',       description: 'Conecta programación, espacio y escena.', color: '#34D399', icon: Building2 },
  sello:    { label: 'Sello Discográfico', description: 'Gestiona catálogo, artistas y lanzamientos.', color: '#10B981', icon: Disc3 },
  admin:    { label: 'Admin',              description: 'Acceso operativo exclusivo de plataforma.', color: '#F87171', icon: Shield },
};

const CREATOR_ROLES = ['artist', 'club', 'promoter', 'sello', 'admin'];

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

function TextModal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(7,12,11,0.99)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          maxHeight: '82vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-base font-black text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4" style={{ maxHeight: 'calc(82vh - 64px)' }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function DeactivateModal({ onClose, onConfirm, email }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(7,12,11,0.99)',
          border: '1px solid rgba(239,68,68,0.25)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}>
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-base font-black text-white mb-2">¿Desactivar tu cuenta?</h2>
          <p className="text-sm text-white/50 leading-relaxed mb-1">
            Tu cuenta <span className="text-white/70 font-semibold">{email}</span> quedará inactiva.
          </p>
          <p className="text-xs text-white/35 leading-relaxed mb-6">
            Tu sesión se cerrará. Para reactivar tu cuenta o eliminar tus datos permanentemente, escribe a{' '}
            <a href="mailto:info@polyfauna.com" className="text-white/50 hover:text-white/70 underline">info@polyfauna.com</a>.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.30)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
            >
              Desactivar cuenta
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

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
  const [termsOpen, setTermsOpen]       = useState(false);
  const [privacyOpen, setPrivacyOpen]   = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, toggle: togglePush, permission: pushPerm } = usePushNotifications(currentUser?.id);
  const currentRole = profile?.role || 'citizen';
  const currentIsCreator = CREATOR_ROLES.includes(currentRole);

  if (!currentUser) {
    return <div className="p-5"><LoginRequired message="Inicia sesión para acceder al Control Center." /></div>;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: 'Sesión cerrada', description: 'Hasta pronto.' });
    navigate('/login');
  };

  const handleDeactivate = async () => {
    setDeactivateOpen(false);
    await supabase.auth.signOut();
    toast({ title: 'Cuenta desactivada', description: 'Escribe a info@polyfauna.com para reactivarla o eliminar tus datos.' });
    navigate('/login');
  };

  const role = currentRole;
  const roleMeta = role === 'promoter' && profile?.organizer_type === 'collective'
    ? { ...ROLE_META.promoter, label: 'Colectivo', description: 'Construye comunidad y gestiona eventos con permisos de promotor.' }
    : ROLE_META[role] || ROLE_META.citizen;
  const RoleIcon = roleMeta.icon || Headphones;
  const isAdmin = role === 'admin';
  const displayName = profile?.display_name || currentUser.email?.split('@')[0] || 'Usuario';
  const avatar = profile?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();
  const isCreator = currentIsCreator;
  const hasPromoterHub = role === 'promoter' || role === 'club' || role === 'admin';

  return (
    <>
      {editOpen && (
        <EditProfile
          profile={profile}
          onSave={() => setEditOpen(false)}
          onClose={() => setEditOpen(false)}
        />
      )}

      <AnimatePresence>
        {termsOpen && (
          <TextModal title="Términos y Condiciones" onClose={() => setTermsOpen(false)}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Última actualización: Junio 2026</p>
            <p className="text-sm text-white/60 leading-relaxed">
              POLYFAUNA es una plataforma de streaming de radio en vivo, podcasts y contenido musical. Al usar este servicio aceptas las condiciones descritas a continuación.
            </p>
            <div className="space-y-4 mt-2">
              {[
                { h: 'Uso aceptable', b: 'Debes utilizar la plataforma de forma legal y respetuosa. Está prohibido distribuir contenido sin los derechos correspondientes, realizar ingeniería inversa del sistema, interferir con el servicio o suplantar la identidad de otros usuarios.' },
                { h: 'Contenido de usuarios', b: 'El contenido subido por artistas, promotores y sellos es responsabilidad exclusiva de quien lo publica. POLYFAUNA actúa como proveedor técnico sin editorial. Nos reservamos el derecho de retirar contenido que infrinja derechos de terceros o viole estas condiciones.' },
                { h: 'Propiedad intelectual', b: 'El diseño, marca, código y contenido propio de POLYFAUNA están protegidos por derechos de autor. El contenido de los artistas registrados pertenece a sus respectivos titulares.' },
                { h: 'Modificaciones', b: 'Nos reservamos el derecho de modificar estos términos con un aviso previo de 15 días. El uso continuado de la plataforma tras los cambios implica aceptación de los nuevos términos.' },
                { h: 'Contacto', b: 'Para consultas legales escribe a legal@polyfauna.com.' },
              ].map(({ h, b }) => (
                <div key={h}>
                  <p className="text-xs font-bold text-white/80 mb-1">{h}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{b}</p>
                </div>
              ))}
            </div>
          </TextModal>
        )}
        {privacyOpen && (
          <TextModal title="Política de Privacidad" onClose={() => setPrivacyOpen(false)}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Última actualización: Junio 2026</p>
            <p className="text-sm text-white/60 leading-relaxed">
              En POLYFAUNA nos tomamos en serio la privacidad de nuestros usuarios. Esta política describe qué datos recopilamos y cómo los usamos.
            </p>
            <div className="space-y-4 mt-2">
              {[
                { h: 'Datos que recopilamos', b: 'Recopilamos tu dirección de correo electrónico para autenticación, nombre o alias de usuario, foto de perfil (opcional), y datos de actividad en la plataforma como likes, Organismo, tickets y preferencias.' },
                { h: 'Uso de los datos', b: 'Usamos tus datos para operar la plataforma, personalizar tu experiencia, enviarte notificaciones que hayas autorizado y gestionar tu cuenta. No vendemos ni compartimos información personal con terceros con fines comerciales.' },
                { h: 'Cookies', b: 'Usamos cookies de sesión necesarias para el funcionamiento de la plataforma. Puedes desactivar las cookies opcionales desde la configuración de tu navegador, aunque esto puede afectar algunas funcionalidades.' },
                { h: 'Tus derechos', b: 'Puedes solicitar acceso, corrección o eliminación de tus datos en cualquier momento escribiendo a info@polyfauna.com. Responderemos en un plazo máximo de 30 días.' },
                { h: 'Retención de datos', b: 'Conservamos tus datos mientras tu cuenta esté activa. Al desactivar tu cuenta, tus datos se eliminan de los servidores en un plazo de 90 días.' },
              ].map(({ h, b }) => (
                <div key={h}>
                  <p className="text-xs font-bold text-white/80 mb-1">{h}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{b}</p>
                </div>
              ))}
            </div>
          </TextModal>
        )}
        {deactivateOpen && (
          <DeactivateModal
            email={currentUser.email}
            onClose={() => setDeactivateOpen(false)}
            onConfirm={handleDeactivate}
          />
        )}
        {showUpload && (
          <UploadPodcastModal
            onClose={() => setShowUpload(false)}
            onSuccess={() => setShowUpload(false)}
          />
        )}
      </AnimatePresence>

      <div className="p-5 space-y-6">
        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, rgba(11,16,15,0.96), rgba(7,12,11,0.92)), radial-gradient(circle at 86% 8%, ${roleMeta.color}18, transparent 34%)`,
            border: `1px solid ${isAdmin ? 'rgba(248,113,113,0.26)' : 'rgba(255,255,255,0.09)'}`,
            minHeight: 184,
          }}
        >
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${roleMeta.color}12, transparent 68%)`,
              transform: 'translate(35%, -35%)',
            }}
          />

          <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative shrink-0 self-start">
              <div
                className="absolute rounded-[28px] pointer-events-none"
                style={{ inset: -4, border: `1px solid ${roleMeta.color}40`, boxShadow: `0 0 36px ${roleMeta.color}18` }}
              />
              <div
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[24px] overflow-hidden flex items-center justify-center text-3xl font-black text-white/70"
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
              {!isAdmin && (
                <div
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(7,12,11,0.95)', border: `1px solid ${roleMeta.color}45`, boxShadow: '0 8px 18px rgba(0,0,0,0.45)' }}
                >
                  <RoleIcon className="w-4 h-4" style={{ color: roleMeta.color }} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ background: `${roleMeta.color}14`, color: roleMeta.color, border: `1px solid ${roleMeta.color}30` }}
                >
                  <RoleIcon className="w-3 h-3" />
                  {roleMeta.label}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight truncate">{displayName}</h1>
              {profile?.username && (
                <p className="text-xs text-white/35 mt-0.5">@{profile.username}</p>
              )}
              <p className="text-sm text-white/45 mt-2 max-w-lg leading-relaxed">
                {roleMeta.description}
              </p>
              {profile?.city && (
                <p className="text-xs text-white/25 mt-2">{profile.city}</p>
              )}
            </div>
          </div>

          <div className="relative z-10 px-5 sm:px-6 pb-5 flex flex-wrap items-center gap-3 text-xs text-white/25">
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
            <SettingsTile icon={Dna} label="Abrir Organismo" description="Tu biblioteca viva creada con likes"
              onClick={() => setCurrentSection?.('organism')} delay={0.08} />
          </div>
        </div>

        {isCreator && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Identidad pública</p>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.18)' }}>
                    <Disc3 className="w-4 h-4" style={{ color: '#A78BFA' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">Perfil artístico separado de la cuenta</p>
                    <p className="text-xs text-white/38 leading-relaxed mt-1">
                      Tu rol operativo puede ser Admin, promotor o club; tu música y tus eventos viven en perfiles públicos de artista.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => isAdmin ? navigate('/admin') : setShowUpload(true)}
                className="w-full px-5 py-4 text-left flex items-center gap-3 transition-colors"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Edit3 className="w-4 h-4 text-white/55" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{isAdmin ? 'Gestionar perfiles de artista' : 'Gestionar identidad pública'}</p>
                  <p className="text-xs text-white/35 truncate">{isAdmin ? 'Crear y editar desde el panel operativo' : 'Subir contenido asociado a tu perfil'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/18 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {(isCreator || hasPromoterHub || isAdmin) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Herramientas</p>
            <div className="space-y-2">
              {isCreator && (
                <SettingsTile
                  icon={Upload}
                  label="Subir Podcast / Mix"
                  description="Publica contenido sonoro desde tu rol de creador"
                  onClick={() => setShowUpload(true)}
                  delay={0.12}
                />
              )}
              {hasPromoterHub && (
                <SettingsTile
                  icon={Gauge}
                  label="Gestor de Eventos"
                  description="Administra eventos, cupos y operación"
                  onClick={() => setCurrentSection?.('promoter')}
                  delay={0.15}
                />
              )}
              {hasPromoterHub && (
                <SettingsTile
                  icon={Shield}
                  label={isAdmin ? 'Panel Administrativo' : 'Panel Operativo'}
                  description={isAdmin ? 'Usuarios, contenido, eventos y administración' : 'Administra tus eventos, tickets, asistentes y accesos'}
                  onClick={() => navigate('/admin')}
                  delay={0.18}
                />
              )}
            </div>

            {isAdmin && (
              <div className="mt-4 rounded-2xl p-4"
                style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4" style={{ color: '#F59E0B' }} />
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#F59E0B' }}>
                    Solicitudes de rol
                  </p>
                </div>
                <RoleRequestsPanel />
              </div>
            )}
          </div>
        )}

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
                  <p className="text-xs mt-0.5 text-white/35 leading-relaxed">
                    {pushLoading
                      ? 'Procesando…'
                      : pushSubscribed
                        ? 'Activas para eventos, transmisiones, tickets, devoluciones y mensajes.'
                        : 'Recibe avisos de eventos, transmisiones especiales, tickets, devoluciones y mensajes directos.'}
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

        {/* Legal / Platform */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Plataforma</p>
          <div className="space-y-2">
            <SettingsTile icon={FileText} label="Términos y Condiciones"
              description="Condiciones de uso de la plataforma"
              onClick={() => setTermsOpen(true)} delay={0.28} />
            <SettingsTile icon={Info} label="Política de Privacidad"
              description="Cómo tratamos tus datos personales"
              onClick={() => setPrivacyOpen(true)} delay={0.30} />

            {/* Version info — non-interactive */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32, type: 'spring', stiffness: 300, damping: 28 }}
              className="flex items-center gap-4 px-5 py-4 rounded-xl"
              style={{
                background: 'rgba(11,16,15,0.90)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Shield className="w-4 h-4 text-white/25" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white/60">Versión de la plataforma</p>
                <p className="text-xs mt-0.5 text-white/28">v1.0 Beta — 2026</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Session */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Sesión</p>
          <SettingsTile icon={LogOut} label="Cerrar sesión" description={currentUser.email}
            onClick={handleLogout} delay={0.36} danger />
        </div>

        {/* Danger zone */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Zona de peligro</p>
          <SettingsTile
            icon={UserX}
            label="Desactivar cuenta"
            description="Cierra tu sesión y desactiva el acceso"
            onClick={() => setDeactivateOpen(true)}
            delay={0.40}
            danger
          />
        </div>
      </div>
    </>
  );
}
