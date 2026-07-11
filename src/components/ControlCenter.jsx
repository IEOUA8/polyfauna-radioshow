import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bell, BellOff, Building2, CalendarDays, Check, ChevronRight, Disc3, Dna, Edit3, FileText, Headphones, Info, Loader2, LogOut, Mail, Mic2, Shield, UserX, Users, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import supabase from '@/lib/customSupabaseClient';
import { LoginRequired, PulseLoader } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import EditProfile from '@/components/EditProfile';
import RoleRequestsPanel from '@/components/RoleRequestsPanel';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import pkg from '../../package.json';

const ROLE_META = {
  citizen:  { label: 'Oyente',             description: 'Explora, escucha y alimenta tu Organismo.', color: '#B8CFA6', icon: Headphones },
  artist:   { label: 'Artista',            description: 'Publica mixes, sesiones y presencia sonora.', color: '#A78BFA', icon: Mic2 },
  promoter: { label: 'Promotor',           description: 'Activa eventos, comunidad y convocatorias.', color: '#FF8A1F', icon: CalendarDays },
  club:     { label: 'Club / Venue',       description: 'Conecta programación, espacio y escena.', color: '#34D399', icon: Building2 },
  sello:    { label: 'Sello Discográfico', description: 'Gestiona catálogo, artistas y lanzamientos.', color: '#10B981', icon: Disc3 },
  admin:    { label: 'Admin',              description: 'Acceso operativo exclusivo de plataforma.', color: '#F87171', icon: Shield },
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
  { id: 'auto',   label: 'Auto',           desc: '128 kbps · baja a 64 si detecta cortes' },
  { id: 'high',   label: 'Alta calidad',   desc: '192 kbps — mejor sonido' },
  { id: 'medium', label: 'Estándar',       desc: '128 kbps — balance óptimo' },
  { id: 'low',    label: 'Baja calidad',   desc: '64 kbps — ahorra datos' },
];

function TextModal({ title, onClose, children }) {
  // createPortal a document.body: sin esto, el modal hereda el transform
  // del motion.div que anima el cambio de sección en PolyfaunaOS.jsx (le
  // pasa y/opacity/filter en cada render) — cualquier transform en un
  // ancestro convierte a ese ancestro en el "containing block" de un
  // position:fixed, así que el modal terminaba posicionado relativo a esa
  // caja larga en vez del viewport, apareciendo "muy abajo" en la página.
  return createPortal(
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
    </div>,
    document.body
  );
}

const REPORT_CATEGORIES = [
  { value: 'payment',   label: 'Pago' },
  { value: 'ticket',    label: 'Ticket / QR' },
  { value: 'refund',    label: 'Devolución' },
  { value: 'account',   label: 'Cuenta' },
  { value: 'technical', label: 'Falla técnica' },
  { value: 'general',   label: 'Otro' },
];

function ReportIssueModal({ onClose, currentUser }) {
  const { toast } = useToast();
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.from('support_cases').insert({
        user_id: currentUser.id,
        category,
        subject: subject.trim(),
        description: description.trim() || null,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo enviar el reporte', description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <TextModal title="Reportar un problema" onClose={onClose}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <Check className="w-6 h-6" style={{ color: '#22c55e' }} />
          </div>
          <p className="text-sm font-bold text-white">Reporte enviado</p>
          <p className="text-xs text-white/40 leading-relaxed max-w-xs">
            Nuestro equipo lo revisará pronto. Si necesitas seguimiento inmediato, escribe a info@polyfauna.com.
          </p>
          <button type="button" onClick={onClose}
            className="mt-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-white/40 leading-relaxed">
            Cuéntanos qué pasó. Tu reporte queda asociado a tu cuenta ({currentUser.email}) para que podamos darle seguimiento.
          </p>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {REPORT_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value} style={{ background: '#0B1110' }}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Asunto</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={180}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej. No recibí el ticket después de pagar"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/35">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Fecha, evento, número de ticket o cualquier detalle que ayude"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
              style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
          <button
            type="submit"
            disabled={sending || subject.trim().length < 3}
            className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#20C7E8', color: '#031014' }}
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Enviar reporte
          </button>
        </form>
      )}
    </TextModal>
  );
}

function DeactivateModal({ onClose, onConfirm, email }) {
  return createPortal(
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
    </div>,
    document.body
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
  const { currentUser, isLoading: authLoading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editOpen, setEditOpen]         = useState(false);
  const [qualityOpen, setQualityOpen]   = useState(false);
  const [termsOpen, setTermsOpen]       = useState(false);
  const [privacyOpen, setPrivacyOpen]   = useState(false);
  const [reportOpen, setReportOpen]     = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, toggle: togglePush, permission: pushPerm } = usePushNotifications(currentUser?.id);
  const currentRole = profile?.role || 'citizen';

  if (authLoading) {
    return <div className="p-5"><PulseLoader label="Verificando sesión..." /></div>;
  }

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
  const hasPromoterHub = ['promoter', 'club', 'artist', 'sello', 'admin'].includes(role);

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
              POLYFAUNA es una plataforma de streaming de radio en vivo, podcasts, contenido musical y venta de entradas para eventos de música electrónica en Colombia. Al usar este servicio aceptas las condiciones descritas a continuación.
            </p>
            <div className="space-y-4 mt-2">
              {[
                { h: 'Uso aceptable', b: 'Debes utilizar la plataforma de forma legal y respetuosa. Está prohibido distribuir contenido sin los derechos correspondientes, realizar ingeniería inversa del sistema, interferir con el servicio o suplantar la identidad de otros usuarios.' },
                { h: 'Contenido de usuarios', b: 'El contenido subido por artistas, promotores y sellos es responsabilidad exclusiva de quien lo publica. POLYFAUNA actúa como proveedor técnico sin editorial. Nos reservamos el derecho de retirar contenido que infrinja derechos de terceros o viole estas condiciones.' },
                { h: 'Propiedad intelectual', b: 'El diseño, marca, código y contenido propio de POLYFAUNA están protegidos por derechos de autor. El contenido de los artistas registrados pertenece a sus respectivos titulares.' },
                { h: 'Compra de tickets', b: 'Las entradas a eventos se venden a través de nuestro aliado de pagos Wompi, en pesos colombianos (COP). El precio mostrado incluye el valor total a pagar. Al completarse el pago recibes un ticket digital con código QR único, asociado a tu cuenta, válido exclusivamente para el evento y la fecha indicados. Es tu responsabilidad verificar los datos del evento antes de comprar; POLYFAUNA no se hace responsable por compras realizadas para la fecha o el evento equivocado.' },
                { h: 'Devoluciones y cancelaciones', b: 'Al tratarse de entradas para espectáculos con fecha y hora determinadas, las compras no admiten retracto una vez emitido el ticket, salvo en los siguientes casos: (1) cancelación del evento por parte del organizador — reembolso total en un plazo máximo de 15 días hábiles al medio de pago original; (2) reprogramación del evento — el ticket queda vigente para la nueva fecha, o puedes solicitar reembolso dentro de los 5 días hábiles siguientes al anuncio del cambio; (3) cobro duplicado o error verificado en el monto — reembolso del valor cobrado de más en un plazo máximo de 15 días hábiles; (4) uso fraudulento reportado en tu cuenta — el ticket puede anularse mientras se investiga. Toda solicitud de devolución debe enviarse a info@polyfauna.com indicando el número de ticket o referencia de pago. Gestionamos las devoluciones aprobadas conforme a la normativa de protección al consumidor vigente en Colombia (Ley 1480 de 2011) y a las políticas del procesador de pagos Wompi.' },
                { h: 'Modificaciones', b: 'Nos reservamos el derecho de modificar estos términos con un aviso previo de 15 días. El uso continuado de la plataforma tras los cambios implica aceptación de los nuevos términos.' },
                { h: 'Contacto', b: 'Para soporte, compras y devoluciones escribe a info@polyfauna.com. Para consultas legales escribe a legal@polyfauna.com.' },
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
        {reportOpen && (
          <ReportIssueModal currentUser={currentUser} onClose={() => setReportOpen(false)} />
        )}
        {deactivateOpen && (
          <DeactivateModal
            email={currentUser.email}
            onClose={() => setDeactivateOpen(false)}
            onConfirm={handleDeactivate}
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

        {hasPromoterHub && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Herramientas</p>
            <div className="space-y-2">
              <SettingsTile
                icon={Shield}
                label={isAdmin ? 'Panel Administrativo' : 'Panel Operativo'}
                description={isAdmin ? 'Usuarios, contenido, eventos y administración' : 'Administra tus eventos, podcasts, tickets y accesos'}
                onClick={() => navigate('/admin')}
                delay={0.18}
              />
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
            <SettingsTile icon={Mail} label="Soporte"
              description="info@polyfauna.com — dudas, pagos y reembolsos"
              onClick={() => { window.location.href = 'mailto:info@polyfauna.com'; }} delay={0.26} />
            <SettingsTile icon={AlertTriangle} label="Reportar un problema"
              description="Abre un caso de soporte con seguimiento en la plataforma"
              onClick={() => setReportOpen(true)} delay={0.27} />
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
                <p className="text-xs mt-0.5 text-white/28">v{pkg.version} · Beta</p>
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
