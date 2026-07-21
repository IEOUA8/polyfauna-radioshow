import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle, IdCard, Loader2, Save, X } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { optimizeImageForUpload } from '@/lib/imageOptimization';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop';

const ARTIST_LIKE_ROLES = ['artist', 'sello'];
const ORGANIZER_ROLES = ['promoter', 'club'];

export default function EditProfile({ profile, onSave, onClose }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null);
  const [identity, setIdentity] = useState({ full_name: '', document_type: 'CC', document_number: '' });
  const [genres, setGenres] = useState('');
  const [demographics, setDemographics] = useState({ gender_identity: '', age_range: '' });
  const [demographicsConsent, setDemographicsConsent] = useState(false);
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
  const isOrganizerLike = ORGANIZER_ROLES.includes(currentUser.role);

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
    supabase
      .from('user_demographics')
      .select('gender_identity, age_range, consented_at')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDemographics({
          gender_identity: data.gender_identity || '',
          age_range: data.age_range || '',
        });
        setDemographicsConsent(Boolean(data.consented_at));
      });
  }, [currentUser.id]);

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
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Imagen muy grande', description: 'Máximo 10MB antes de optimizar.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    setUploadProgress(5);
    let progressTimer = null;
    try {
      const optimizedFile = await optimizeImageForUpload(file, 'avatar');
      setUploadProgress(30);
      progressTimer = window.setInterval(() => {
        setUploadProgress(current => current < 90 ? Math.min(90, current + 4) : current);
      }, 250);
      const path = `${currentUser.id}/${crypto.randomUUID()}.webp`;
      // upsert:true dispara un rechazo RLS falso en el storage-api de Supabase
      // para esta politica (probado: el mismo insert sin upsert funciona). Se
      // usa un nombre unico por subida y se borra el archivo anterior aparte.
      const { error } = await supabase.storage.from('avatars').upload(path, optimizedFile, {
        cacheControl: '31536000',
        contentType: 'image/webp',
      });
      if (error) throw error;
      window.clearInterval(progressTimer);
      progressTimer = null;
      setUploadProgress(95);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarPreview(publicUrl);
      set('avatar_url', publicUrl);
      setUploadProgress(100);
    } catch (error) {
      setUploadProgress(0);
      toast({ title: 'Error al subir imagen', description: error.message, variant: 'destructive' });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (uploading) return;
    setSaving(true);
    const updates = { ...form };
    if (avatarPreview && avatarPreview !== profile?.avatar_url) {
      updates.avatar_url = avatarPreview.split('?')[0];
    }
    const { data: savedProfile, error } = await supabase.from('profiles')
      .upsert({ id: currentUser.id, ...updates })
      .select().single();

    // La identidad (nombre/documento) solo es obligatoria para comprar o
    // validar tickets (lo exige purchase_ticket en el servidor) — no debe
    // bloquear el guardado del resto del perfil si todavía no la completó.
    const hasIdentityInput = identity.full_name.trim() && identity.document_number.trim();
    const { error: identityError } = (error || !hasIdentityInput) ? { error: null } : await supabase
      .from('user_identity')
      .upsert({
        user_id: currentUser.id,
        full_name: identity.full_name.trim(),
        document_type: identity.document_type,
        document_number: identity.document_number.trim(),
      });

    const hasDemographicData = Boolean(demographics.gender_identity || demographics.age_range);
    const { error: demographicsError } = error ? { error: null } : await supabase.rpc('set_user_demographics', {
      p_gender_identity: demographicsConsent && demographics.gender_identity ? demographics.gender_identity : null,
      p_age_range: demographicsConsent && demographics.age_range ? demographics.age_range : null,
      p_consent: demographicsConsent && hasDemographicData,
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
          city: updates.city,
          social_links: updates.social_links,
        })
        .eq('user_id', currentUser.id);
      artistSyncError = syncError;
    }

    // Tu ficha publica en Colonia (organizers) se mantiene sincronizada con
    // este mismo formulario, igual que Artists & Labels arriba.
    let organizerSyncError = null;
    if (!error && isOrganizerLike) {
      const { error: syncError } = await supabase
        .from('organizers')
        .update({
          name: updates.display_name || undefined,
          bio: updates.bio,
          image_url: updates.avatar_url,
          city: updates.city,
          social_links: updates.social_links,
        })
        .eq('owner_id', currentUser.id);
      organizerSyncError = syncError;
    }

    if (error || identityError || demographicsError || artistSyncError || organizerSyncError) {
      toast({ title: 'Error al guardar', description: error?.message || identityError?.message || demographicsError?.message || artistSyncError?.message || organizerSyncError?.message, variant: 'destructive' });
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pf:profile-updated', { detail: savedProfile }));
      }

      const previousMarker = '/object/public/avatars/';
      const previousPath = profile?.avatar_url?.includes(previousMarker)
        ? profile.avatar_url.split(previousMarker)[1]
        : null;
      if (updates.avatar_url && previousPath && updates.avatar_url !== profile.avatar_url) {
        const { error: cleanupError } = await supabase.storage.from('avatars').remove([previousPath]);
        if (cleanupError) console.warn('Previous avatar could not be removed:', cleanupError);
      }

      toast(hasIdentityInput ? {
        title: 'Perfil actualizado',
        description: 'Tus cambios se guardaron correctamente.',
      } : {
        title: 'Perfil actualizado',
        description: 'Tus cambios se guardaron. Completa tu nombre y número de documento cuando quieras comprar o validar tickets.',
      });
      await onSave?.(savedProfile);
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
            <div className="flex-1 min-w-0">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Camera className="w-3.5 h-3.5" />
                {uploading ? `Subiendo… ${uploadProgress}%` : 'Cambiar foto'}
              </button>
              <p className="text-[10px] text-white/30 mt-1.5">JPG, PNG o WebP · se optimiza automáticamente</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatar} />
              {uploadProgress > 0 && (
                <div className="mt-2.5" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${uploadProgress === 100 ? 'text-emerald-300' : 'text-white/50'}`}>
                      {uploadProgress === 100 && <CheckCircle className="w-3 h-3" />}
                      {uploadProgress === 100 ? 'Imagen lista · ya puedes guardar' : 'Procesando y subiendo imagen'}
                    </span>
                    <span className={`text-[10px] font-black ${uploadProgress === 100 ? 'text-emerald-300' : 'text-white/70'}`}>
                      {uploadProgress}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progreso de carga de la imagen de perfil"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploadProgress}
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full transition-[width,background-color] duration-300"
                      style={{
                        width: `${uploadProgress}%`,
                        background: uploadProgress === 100 ? '#6EE7B7' : '#67E8F9',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(32,199,232,0.05)', border: '1px solid rgba(32,199,232,0.16)' }}>
            <div className="flex items-center gap-2">
              <IdCard className="w-4 h-4 text-cyan-300" />
              <div>
                <p className="text-xs font-black text-white">Identidad para acceso a eventos</p>
                <p className="text-[10px] text-white/35">Necesaria solo para comprar o validar tickets. Solo tú y el personal autorizado del evento pueden verla.</p>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Nombre completo</label>
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
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Tipo</label>
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
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Número de documento</label>
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

          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(93,224,163,0.045)', border: '1px solid rgba(93,224,163,0.16)' }}>
            <div>
              <p className="text-xs font-black text-white">Datos estadísticos opcionales</p>
              <p className="text-[10px] text-white/35 mt-0.5">
                Se usan únicamente de forma agregada para conocer la audiencia. No aparecen en tu perfil público.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Género</label>
                <select
                  value={demographics.gender_identity}
                  onChange={event => setDemographics(current => ({ ...current, gender_identity: event.target.value }))}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none [color-scheme:dark]"
                  style={{ background: '#111817', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                >
                  <option value="">Sin responder</option>
                  <option value="woman">Mujer</option>
                  <option value="man">Hombre</option>
                  <option value="non_binary">No binario</option>
                  <option value="prefer_not_to_say">Prefiero no responder</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">Rango de edad</label>
                <select
                  value={demographics.age_range}
                  onChange={event => setDemographics(current => ({ ...current, age_range: event.target.value }))}
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none [color-scheme:dark]"
                  style={{ background: '#111817', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                >
                  <option value="">Sin responder</option>
                  <option value="under_18">Menor de 18</option>
                  <option value="18_24">18–24</option>
                  <option value="25_34">25–34</option>
                  <option value="35_44">35–44</option>
                  <option value="45_54">45–54</option>
                  <option value="55_plus">55+</option>
                  <option value="prefer_not_to_say">Prefiero no responder</option>
                </select>
              </div>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={demographicsConsent}
                onChange={event => {
                  const checked = event.target.checked;
                  setDemographicsConsent(checked);
                  if (!checked) setDemographics({ gender_identity: '', age_range: '' });
                }}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <span className="text-[10px] leading-relaxed text-white/45">
                Autorizo el uso de estos datos para estadísticas agregadas de audiencia. Puedo retirar esta autorización desmarcando la casilla y guardando.
              </span>
            </label>
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
          <button type="button" onClick={handleSave} disabled={saving || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
            {saving || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : uploading ? `Espera a que termine la imagen · ${uploadProgress}%` : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
