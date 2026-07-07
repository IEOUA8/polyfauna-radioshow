import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, IdCard, Loader2, Save, X } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

const ARTIST_LIKE_ROLES = ['artist', 'sello'];

export default function EditProfile({ profile, onSave, onClose }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [identity, setIdentity] = useState({ full_name: '', document_type: 'CC', document_number: '' });
  const [genres, setGenres] = useState('');
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    username:     profile?.username || '',
    bio:          profile?.bio || '',
    city:         profile?.city || '',
    website:      profile?.website || '',
    social_links: profile?.social_links || { instagram: '', bandcamp: '', soundcloud: '', twitter: '' },
  });

  const isArtistLike = ARTIST_LIKE_ROLES.includes(currentUser.role)
    || (currentUser.role === 'promoter' && currentUser.organizer_type === 'collective');

  useEffect(() => {
    supabase
      .from('user_identity')
      .select('full_name, document_type, document_number')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIdentity(data);
        else setIdentity(current => ({ ...current, full_name: profile?.display_name || '' }));
      });
  }, [currentUser.id, profile?.display_name]);

  useEffect(() => {
    if (!isArtistLike) return;
    supabase
      .from('artists')
      .select('genres')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.genres)) setGenres(data.genres.join(', '));
      });
  }, [currentUser.id, isArtistLike]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

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
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    // upsert:true dispara un rechazo RLS falso en el storage-api de Supabase
    // para esta politica (probado: el mismo insert sin upsert funciona). Se
    // usa un nombre unico por subida y se borra el archivo anterior aparte.
    const { error } = await supabase.storage.from('avatars').upload(path, file);
    if (error) {
      toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
    } else {
      const prevMarker = '/object/public/avatars/';
      const previousPath = avatarPreview?.includes(prevMarker) ? avatarPreview.split(prevMarker)[1] : null;
      if (previousPath) supabase.storage.from('avatars').remove([previousPath]);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarPreview(publicUrl);
      set('avatar_url', publicUrl);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!identity.full_name.trim() || !identity.document_number.trim()) {
      toast({
        title: 'Completa tu identidad',
        description: 'Nombre completo y número de documento son necesarios para validar tickets.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const updates = { ...form };
    if (avatarPreview && avatarPreview !== profile?.avatar_url) {
      updates.avatar_url = avatarPreview.split('?')[0];
    }
    const { error } = await supabase.from('profiles')
      .upsert({ id: currentUser.id, ...updates })
      .select().single();

    const { error: identityError } = error ? { error: null } : await supabase
      .from('user_identity')
      .upsert({
        user_id: currentUser.id,
        full_name: identity.full_name.trim(),
        document_type: identity.document_type,
        document_number: identity.document_number.trim(),
      });

    // Tu ficha publica en Artists & Labels se mantiene sincronizada con este
    // mismo formulario (no hay un editor separado): mismo nombre, bio, foto,
    // redes y ahora el genero/estilo.
    let artistSyncError = null;
    if (!error && isArtistLike) {
      const genresArray = genres.split(',').map(g => g.trim()).filter(Boolean);
      const { error: syncError } = await supabase
        .from('artists')
        .update({
          name: updates.display_name || undefined,
          bio: updates.bio,
          image_url: updates.avatar_url,
          genres: genresArray,
          social_links: updates.social_links,
        })
        .eq('user_id', currentUser.id);
      artistSyncError = syncError;
    }

    if (error || identityError || artistSyncError) {
      toast({ title: 'Error al guardar', description: error?.message || identityError?.message || artistSyncError?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Perfil actualizado', description: 'Tus cambios se guardaron correctamente.' });
      onSave?.();
    }
    setSaving(false);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6"
      style={{
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(18px) saturate(120%)',
        WebkitBackdropFilter: 'blur(18px) saturate(120%)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar perfil"
        className="w-full max-w-lg max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)] rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(11,16,15,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 30px 100px rgba(0,0,0,0.72)',
        }}
        onClick={event => event.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,16,15,0.98)' }}>
          <h2 className="text-base font-black text-white">Editar Perfil</h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.16) transparent' }}>
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

          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(32,199,232,0.05)', border: '1px solid rgba(32,199,232,0.16)' }}>
            <div className="flex items-center gap-2">
              <IdCard className="w-4 h-4 text-cyan-300" />
              <div>
                <p className="text-xs font-black text-white">Identidad para acceso a eventos</p>
                <p className="text-[10px] text-white/35">Solo tú y el personal autorizado del evento pueden verla.</p>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Nombre completo *</label>
              <input
                value={identity.full_name}
                onChange={event => setIdentity(current => ({ ...current, full_name: event.target.value }))}
                placeholder="Como aparece en tu documento"
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
              />
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <div>
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Tipo *</label>
                <select
                  value={identity.document_type}
                  onChange={event => setIdentity(current => ({ ...current, document_type: event.target.value }))}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none [color-scheme:dark]"
                  style={{ background: '#111817', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                >
                  {['CC', 'CE', 'TI', 'PP', 'PEP', 'NIT'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Número de documento *</label>
                <input
                  value={identity.document_number}
                  onChange={event => setIdentity(current => ({ ...current, document_number: event.target.value }))}
                  placeholder="Número sin puntos"
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                />
              </div>
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

          {/* Género / estilo (solo artist, sello o colectivo) */}
          {isArtistLike && (
            <div>
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Género / Estilo</label>
              <input
                value={genres}
                onChange={e => setGenres(e.target.value)}
                placeholder="Techno, Ambient…"
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(32,199,232,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              <p className="text-[10px] text-white/30 mt-1">Se muestra en tu ficha pública de Artists &amp; Labels.</p>
            </div>
          )}

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

        </div>

        {/* Save footer */}
        <div className="shrink-0 px-5 sm:px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(11,16,15,0.99)' }}>
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
