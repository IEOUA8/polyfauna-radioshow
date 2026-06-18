import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Heart, ListMusic, Shield, Upload, User } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { LoginRequired } from '@/components/SectionStates';
import EditProfile from '@/components/EditProfile';
import MyFavorites from '@/components/MyFavorites';
import MyPlaylists from '@/components/MyPlaylists';
import UploadPodcastModal from '@/components/UploadPodcastModal';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

const ROLE_LABEL = {
  citizen:  { label: 'Wave Citizen',  color: '#00CFFF' },
  artist:   { label: 'Artista',       color: '#A78BFA' },
  promoter: { label: 'Promotor',      color: '#F59E0B' },
  club:     { label: 'Club / Venue',  color: '#34D399' },
  admin:    { label: 'Admin',         color: '#F87171' },
};

const CREATOR_ROLES = ['artist', 'club', 'promoter', 'admin'];

const TABS = [
  { id: 'favoritos', label: 'Favoritos',  icon: Heart,     roles: null           },
  { id: 'playlists', label: 'Playlists',  icon: ListMusic, roles: null           },
  { id: 'subir',     label: 'Subir',      icon: Upload,    roles: CREATOR_ROLES  },
];

export default function MyPanel({ setCurrentSection }) {
  const { currentUser } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const [activeTab, setActiveTab] = useState('favoritos');
  const [showEdit, setShowEdit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  if (!currentUser) {
    return (
      <div className="p-5">
        <LoginRequired message="Inicia sesión para acceder a tu panel personal." />
      </div>
    );
  }

  const role = ROLE_LABEL[profile?.role] || ROLE_LABEL.citizen;
  const isPromoter = profile?.role === 'promoter' || profile?.role === 'club';
  const isCreator  = CREATOR_ROLES.includes(profile?.role);
  const visibleTabs = TABS.filter(t => !t.roles || t.roles.includes(profile?.role));

  return (
    <div className="p-5 space-y-6 max-w-4xl">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Background gradient decoration */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(circle at 80% 50%, ${role.color}40, transparent 60%)` }} />

        <div className="relative flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {loading ? (
              <div className="w-20 h-20 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
            ) : (
              <img
                src={profile?.avatar_url || FALLBACK}
                alt={profile?.display_name}
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: `2px solid ${role.color}40` }}
              />
            )}
            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2"
              style={{ background: '#22c55e', borderColor: '#0F1322' }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-5 w-40 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-white leading-tight">
                    {profile?.display_name || currentUser.email?.split('@')[0]}
                  </h1>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded"
                    style={{ background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}30` }}>
                    {role.label}
                  </span>
                </div>
                {profile?.username && (
                  <p className="text-sm text-white/40 mt-0.5">@{profile.username}</p>
                )}
                {profile?.bio && (
                  <p className="text-xs text-white/50 mt-2 max-w-md leading-relaxed">{profile.bio}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-white/30">
                  {profile?.city && <span>{profile.city}</span>}
                  {profile?.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer"
                      className="hover:text-white/60 transition-colors">{profile.website.replace(/^https?:\/\//, '')}</a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <button type="button" onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Edit3 className="w-3.5 h-3.5" />
              Editar
            </button>
            {isPromoter && (
              <button type="button" onClick={() => setCurrentSection('promoter')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                style={{ background: `${role.color}15`, color: role.color, border: `1px solid ${role.color}30` }}>
                <Shield className="w-3.5 h-3.5" />
                Dashboard
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {visibleTabs.map(({ id, label, icon: Icon, roles }) => {
          const isUpload = id === 'subir';
          const accentColor = isUpload ? '#A78BFA' : '#00CFFF';
          return (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 text-sm font-semibold pb-3 px-1 relative transition-colors"
              style={{ color: activeTab === id ? accentColor : 'rgba(255,255,255,0.35)' }}>
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === id && (
                <motion.div layoutId="panel-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: accentColor }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {activeTab === 'favoritos' && <MyFavorites />}
          {activeTab === 'playlists' && <MyPlaylists />}
          {activeTab === 'subir' && isCreator && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-white/50">Sube tus mixes, sesiones y podcasts directamente a la plataforma.</p>
              <button type="button" onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#A78BFA,#7B5CF0)', color: '#fff', boxShadow: '0 0 24px rgba(167,139,250,0.3)' }}>
                <Upload className="w-4 h-4" />
                Subir Podcast / Mix
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Edit profile modal */}
      <AnimatePresence>
        {showEdit && (
          <EditProfile
            profile={profile}
            onClose={() => setShowEdit(false)}
            onSave={() => { setShowEdit(false); refetch(); }}
          />
        )}
      </AnimatePresence>

      {/* Upload modal */}
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
