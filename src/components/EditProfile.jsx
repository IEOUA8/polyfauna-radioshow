import React, { useState, useRef } from 'react';
import { Camera, Loader2, Save, X } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  { value: 'citizen',  label: 'Wave Citizen',  desc: 'Fan y oyente de la comunidad' },
  { value: 'artist',   label: 'Artista',        desc: 'DJ, productor o live act' },
  { value: 'promoter', label: 'Promotor',       desc: 'Organizo eventos y shows' },
  { value: 'club',     label: 'Club / Venue',   desc: 'Espacio de música electrónica' },
];

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

export default function EditProfile({ profile, onSave, onClose }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    username:     profile?.username || '',
    bio:          profile?.bio || '',
    city:         profile?.city || '',
    website:      profile?.website || '',
    role:         profile?.role || 'citizen',
    social_links: profile?.social_links || { instagram: '', bandcamp: '', soundcloud: '', twitter: '' },
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const setSocial = (key, val) => setForm(prev => ({
    ...prev, social_links: { ...prev.social_links, [key]: val }
  }));

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Imagen muy grande', description: 'Máximo 2MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarPreview(publicUrl + '?t=' + Date.now());
      set('avatar_url', publicUrl);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = { ...form };
    if (avatarPreview && avatarPreview !== profile?.avatar_url) {
      updates.avatar_url = avatarPreview.split('?')[0];
    }
    const { error } = await supabase.from('profiles')
      .upsert({ id: currentUser.id, ...updates })
      .select().single();

    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil actualizado', description: 'Tus cambios se guardaron correctamente.' });
      onSave?.();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden overflow-y-auto max-h-[90vh]"
        style={{ background: 'rgba(11,16,15,0.96)', border: '1px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-base font-black text-white">Editar Perfil</h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0"
              style={{ border: '2px solid rgba(255,255,255,0.18)' }}>
              <img src={avatarPreview || FALLBACK} alt="avatar" className="w-full h-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Camera className="w-3.5 h-3.5" />
                {uploading ? 'Subiendo…' : 'Cambiar foto'}
              </button>
              <p className="text-[10px] text-white/30 mt-1.5">JPG, PNG o WebP · Máx 2MB</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-2">Tipo de cuenta</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: form.role === r.value ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.role === r.value ? 'rgba(32,199,232,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <p className="text-xs font-bold" style={{ color: form.role === r.value ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}>
                    {r.label}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Basic fields */}
          {[
            { key: 'display_name', label: 'Nombre para mostrar', placeholder: 'Tu nombre artístico o real' },
            { key: 'username',     label: 'Username',            placeholder: '@tuusuario' },
            { key: 'city',         label: 'Ciudad',              placeholder: 'Bogotá, Colombia' },
            { key: 'website',      label: 'Website',             placeholder: 'https://tu-sitio.com' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">{label}</label>
              <input
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(32,199,232,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>
          ))}

          {/* Bio */}
          <div>
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={e => set('bio', e.target.value)}
              placeholder="Cuéntanos quién eres..."
              rows={3}
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(32,199,232,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
            />
          </div>

          {/* Social links */}
          <div>
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-2">Redes sociales</label>
            <div className="space-y-2">
              {[
                { key: 'instagram',  prefix: 'instagram.com/',  placeholder: 'tu_usuario' },
                { key: 'bandcamp',   prefix: 'bandcamp.com/',   placeholder: 'tu-artista  (ej: artista.bandcamp.com)' },
                { key: 'soundcloud', prefix: 'soundcloud.com/', placeholder: 'tu_usuario' },
                { key: 'twitter',    prefix: 'x.com/',          placeholder: 'tu_usuario' },
              ].map(({ key, prefix, placeholder }) => (
                <div key={key} className="flex items-center rounded-lg overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[11px] text-white/30 px-3 py-2.5 shrink-0">{prefix}</span>
                  <input
                    value={form.social_links[key] || ''}
                    onChange={e => setSocial(key, e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 text-sm py-2.5 pr-3 bg-transparent outline-none text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
