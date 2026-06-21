import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioWaveform, Check, Edit3, Heart, Instagram, Link as LinkIcon, ListMusic, Loader2, MapPin, Shield, ShoppingBag, Twitter, Upload, User, Users, X } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { supabase } from '@/lib/customSupabaseClient';
import { LoginRequired } from '@/components/SectionStates';
import EditProfile from '@/components/EditProfile';
import MyFavorites from '@/components/MyFavorites';
import MyPlaylists from '@/components/MyPlaylists';
import UploadPodcastModal from '@/components/UploadPodcastModal';
import RoleRequestsPanel from '@/components/RoleRequestsPanel';
import { useToast } from '@/components/ui/use-toast';

// ── BroadcastPanel ────────────────────────────────────────────────────────────

function BroadcastPanel() {
  const { toast } = useToast();
  const [form, setForm] = useState({ subject: '', title: '', body: '', ctaLabel: '', ctaUrl: '' });
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSend = useCallback(async () => {
    if (!form.subject.trim() || !form.title.trim() || !form.body.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-community-broadcast', {
        body: { ...form, adminSecret: import.meta.env.VITE_BROADCAST_SECRET },
      });
      if (error) throw new Error(error.message);
      toast({ title: 'Broadcast enviado', description: 'Emails en camino a toda la comunidad.' });
      setForm({ subject: '', title: '', body: '', ctaLabel: '', ctaUrl: '' });
      setOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  }, [form, toast]);

  const field = (key, placeholder, tag = 'input') => {
    const style = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'white', width: '100%', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', outline: 'none', resize: 'vertical' };
    return tag === 'textarea'
      ? <textarea rows={4} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={style} />
      : <input type="text" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={style} />;
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#F59E0B' }}>📢 Notificar comunidad</span>
        </div>
        <span className="text-xs text-white/30">{open ? '▲ cerrar' : '▼ abrir'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(245,158,11,0.12)' }}>
              <div className="pt-3 space-y-2.5">
                {field('subject',  'Asunto del email (ej. "Nuevo podcast disponible")')}
                {field('title',    'Título principal del email')}
                {field('body',     'Contenido del mensaje…', 'textarea')}
                {field('ctaLabel', 'Texto del botón (opcional, ej. "Escuchar ahora")')}
                {field('ctaUrl',   'URL del botón (opcional)')}
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !form.subject.trim() || !form.title.trim() || !form.body.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-black disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#F59E0B', color: '#080B14' }}
              >
                {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</> : '📨 Enviar a toda la comunidad'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

const ROLE_META = {
  citizen:  { label: 'Wave Citizen',        color: '#20C7E8', glow: 'rgba(32,199,232,0.30)'  },
  artist:   { label: 'Artista',             color: '#A78BFA', glow: 'rgba(167,139,250,0.30)' },
  promoter: { label: 'Promotor',            color: '#FF8A1F', glow: 'rgba(255,138,31,0.30)'  },
  club:     { label: 'Club / Venue',        color: '#34D399', glow: 'rgba(52,211,153,0.30)'  },
  sello:    { label: 'Sello Discográfico',  color: '#10B981', glow: 'rgba(16,185,129,0.30)'  },
  admin:    { label: 'Admin',               color: '#F87171', glow: 'rgba(248,113,113,0.30)' },
};

const CREATOR_ROLES = ['artist', 'club', 'promoter', 'sello', 'admin'];

const SOCIAL_PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: '#E1306C',
    gradient: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)',
    buildUrl: (h) => `https://instagram.com/${h}`,
  },
  {
    key: 'bandcamp',
    label: 'Bandcamp',
    icon: ShoppingBag,
    color: '#1DA0C3',
    gradient: 'linear-gradient(135deg, #1DA0C3, #0B6E8A)',
    buildUrl: (h) => h.includes('.') ? `https://${h}` : `https://${h}.bandcamp.com`,
  },
  {
    key: 'soundcloud',
    label: 'SoundCloud',
    icon: AudioWaveform,
    color: '#FF5500',
    gradient: 'linear-gradient(135deg, #FF5500, #FF8800)',
    buildUrl: (h) => `https://soundcloud.com/${h}`,
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    icon: Twitter,
    color: '#94A3B8',
    gradient: 'linear-gradient(135deg, #475569, #94A3B8)',
    buildUrl: (h) => `https://x.com/${h}`,
  },
];

const TABS = [
  { id: 'favoritos',    label: 'Favoritos',   icon: Heart,     color: '#FF5C7A', roles: null          },
  { id: 'playlists',   label: 'Playlists',   icon: ListMusic, color: '#20C7E8', roles: null          },
  { id: 'subir',       label: 'Subir',       icon: Upload,    color: '#A78BFA', roles: CREATOR_ROLES },
  { id: 'solicitudes', label: 'Solicitudes', icon: Users,     color: '#F59E0B', roles: ['admin']     },
];

export default function MyPanel({ setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const { favorites } = useFavorites();
  const [activeTab, setActiveTab] = useState('favoritos');
  const [showEdit, setShowEdit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const { data: playlists } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('playlists').select('id').eq('user_id', currentUser.id)
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) {
    return (
      <div className="p-5">
        <LoginRequired message="Inicia sesión para acceder a tu panel personal." />
      </div>
    );
  }

  const role      = ROLE_META[profile?.role] || ROLE_META.citizen;
  const isPromoter = profile?.role === 'promoter' || profile?.role === 'club';
  const isCreator  = CREATOR_ROLES.includes(profile?.role);
  const visibleTabs = TABS.filter(t => !t.roles || t.roles.includes(profile?.role));
  const favCount  = favorites?.length ?? 0;
  const plCount   = playlists?.length ?? 0;
  const memberSince = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-0">

      {/* ── Hero / Cover ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden"
        style={{ minHeight: 220 }}
      >
        {/* Dark base */}
        <div className="absolute inset-0" style={{ background: 'rgba(5,9,10,1)' }} />

        {/* Subtle color accent — top-right only, very low opacity */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 80% -10%, ${role.color}14 0%, transparent 50%),
              radial-gradient(ellipse at 0% 110%, ${role.color}08 0%, transparent 45%)
            `,
          }}
        />

        {/* Thin accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${role.color}40, transparent)` }} />

        {/* Blurred avatar backdrop */}
        {(profile?.avatar_url) && (
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${profile.avatar_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              opacity: 0.05,
              filter: 'blur(48px)',
              transform: 'scale(1.4)',
            }}
          />
        )}

        {/* Content */}
        <div className="relative px-6 pt-8 pb-7">
          <div className="flex flex-col sm:flex-row items-start gap-5">

            {/* ── Avatar ── */}
            <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
              {loading ? (
                <div className="w-24 h-24 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              ) : (
                <>
                  {/* Pulsing outer ring */}
                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -5, border: `2px solid ${role.color}55` }}
                    animate={{ scale: [1, 1.10, 1], opacity: [0.6, 0.15, 0.6] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {/* Static ring */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{ inset: -2, background: `linear-gradient(135deg, ${role.color}80, ${role.color}22, transparent, ${role.color}44)` }}
                  />
                  {/* Avatar */}
                  <img
                    src={profile?.avatar_url || FALLBACK}
                    alt={profile?.display_name}
                    className="absolute inset-[2px] rounded-full object-cover z-10"
                    style={{ boxShadow: `0 0 24px ${role.glow}` }}
                  />
                  {/* Online dot */}
                  <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 z-20"
                    style={{ background: '#22c55e', borderColor: '#080E09', boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
                </>
              )}
            </div>

            {/* ── Identity ── */}
            <div className="flex-1 min-w-0 pt-1">
              {loading ? (
                <div className="space-y-2.5">
                  <div className="h-7 w-44 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-4 w-28 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  <div className="h-3 w-64 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-black text-white leading-tight">
                      {profile?.display_name || currentUser.email?.split('@')[0]}
                    </h1>
                    <span
                      className="text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider uppercase"
                      style={{
                        background: `${role.color}18`,
                        color: role.color,
                        border: `1px solid ${role.color}35`,
                        boxShadow: `0 0 10px ${role.color}20`,
                      }}
                    >
                      {role.label}
                    </span>
                  </div>

                  {profile?.username && (
                    <p className="text-sm font-mono mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      @{profile.username}
                    </p>
                  )}

                  {profile?.bio && (
                    <p className="text-sm mt-2.5 max-w-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>
                      {profile.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2.5">
                    {profile?.city && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        <MapPin className="w-3 h-3" />{profile.city}
                      </span>
                    )}
                    {profile?.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs transition-colors hover:text-white/60"
                        style={{ color: 'rgba(255,255,255,0.28)' }}>
                        <Link className="w-3 h-3" />
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {memberSince && (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        Miembro desde {memberSince}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Buttons ── */}
            <div className="flex items-center gap-2 shrink-0 sm:self-start">
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.11)',
                  backdropFilter: 'blur(12px)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar perfil
              </button>
              {isPromoter && (
                <button
                  type="button"
                  onClick={() => setCurrentSection('promoter')}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-150 hover:brightness-110"
                  style={{
                    background: `${role.color}18`,
                    color: role.color,
                    border: `1px solid ${role.color}30`,
                  }}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Dashboard
                </button>
              )}
            </div>
          </div>

          {/* ── Stats tiles ── */}
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {[
              { label: 'Favoritos', value: favCount, color: '#FF5C7A', icon: Heart },
              { label: 'Playlists', value: plCount,  color: '#20C7E8', icon: ListMusic },
            ].map(({ label, value, color, icon: Icon }) => (
              <motion.div
                key={label}
                whileHover={{ scale: 1.04 }}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-default"
                style={{
                  background: `${color}0C`,
                  border: `1px solid ${color}1E`,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color, fill: color }} />
                <span className="font-black text-sm" style={{ color }}>{value}</span>
                <span style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</span>
              </motion.div>
            ))}
          </div>
          {/* ── Social links ── */}
          {(() => {
            const links = SOCIAL_PLATFORMS.filter(p => profile?.social_links?.[p.key]);
            if (!links.length) return null;
            return (
              <div className="flex items-center gap-2 mt-3">
                {links.map(({ key, label, icon: Icon, color, gradient, buildUrl }) => {
                  const handle = profile.social_links[key];
                  const isBandcamp = key === 'bandcamp';
                  return (
                    <motion.a
                      key={key}
                      href={buildUrl(handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      whileHover={{ scale: 1.12, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
                      style={{
                        background: isBandcamp ? gradient : `${color}14`,
                        border: isBandcamp ? 'none' : `1px solid ${color}30`,
                        boxShadow: isBandcamp ? `0 4px 14px ${color}35` : `0 2px 8px ${color}15`,
                        color: isBandcamp ? '#fff' : color,
                        textDecoration: 'none',
                      }}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </motion.a>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Bottom gradient fade into content */}
        <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(5,9,10,0.6))' }} />
      </motion.div>

      {/* ── Divider line ── */}
      <div className="mx-6" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Tabs ── */}
      <div className="px-6 pt-5">
        <div
          className="inline-flex gap-1 p-1 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {visibleTabs.map(({ id, label, icon: Icon, color }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className="relative flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200"
                style={{
                  background: active ? `${color}18` : 'transparent',
                  color: active ? color : 'rgba(255,255,255,0.32)',
                  border: active ? `1px solid ${color}30` : '1px solid transparent',
                  boxShadow: active ? `0 0 12px ${color}15` : 'none',
                }}
              >
                <Icon className="w-3.5 h-3.5" style={active ? { fill: color, color } : {}} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-6 pt-5 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'favoritos' && <MyFavorites />}
            {activeTab === 'playlists' && <MyPlaylists />}
            {activeTab === 'solicitudes' && profile?.role === 'admin' && (
              <div className="space-y-6">
                <BroadcastPanel />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <RoleRequestsPanel />
              </div>
            )}
            {activeTab === 'subir' && isCreator && (
              <div className="py-4">
                <div className="rounded-2xl p-6"
                  style={{
                    background: 'rgba(167,139,250,0.05)',
                    border: '1px solid rgba(167,139,250,0.12)',
                  }}>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.50)' }}>
                    Sube tus mixes, sesiones y podcasts directamente a la plataforma PolyFauna.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg,#A78BFA,#7C5CFF)',
                      color: '#fff',
                      boxShadow: '0 0 24px rgba(167,139,250,0.3), 0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    Subir Podcast / Mix
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showEdit && (
          <EditProfile
            profile={profile}
            onClose={() => setShowEdit(false)}
            onSave={() => { setShowEdit(false); refetch(); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showUpload && (
          <UploadPodcastModal
            onClose={() => setShowUpload(false)}
            onSuccess={() => setShowUpload(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
