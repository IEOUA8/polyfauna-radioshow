import React, { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ChevronLeft, Music, Upload, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const GENRES = [
  'Techno', 'House', 'Tech House', 'Deep House', 'Trance', 'Psy Trance',
  'Disco', 'Nu Disco', 'Downtempo', 'Ambient', 'IDM', 'Experimental',
  'Drum and Bass', 'Breaks', 'Breakbeat', 'Garage', 'UK Garage', 'Grime',
  'Hip Hop', 'Trip Hop', 'Industrial', 'EBM', 'Hardcore', 'Mixed',
];

const GENRE_COLORS = {
  techno: '#FF8C00', house: '#00CFFF', 'tech house': '#00CFFF', 'deep house': '#00B4DD',
  trance: '#4CAF50', 'psy trance': '#81C784', disco: '#E879A0', 'nu disco': '#FF69B4',
  downtempo: '#9C27B0', ambient: '#7B5CF0', idm: '#4527A0', experimental: '#7C4DFF',
  'drum and bass': '#0277BD', breaks: '#4FC3F7', breakbeat: '#29B6F6',
  garage: '#00BCD4', 'uk garage': '#00ACC1', grime: '#00838F',
  'hip hop': '#F44336', 'trip hop': '#EF5350', industrial: '#FFD700',
  ebm: '#FF8F00', hardcore: '#FF1493', mixed: '#94A3B8',
};

function getGenreColor(g) {
  return GENRE_COLORS[g?.toLowerCase()] ?? '#00CFFF';
}

function uploadWithProgress(file, presignedUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); }
      else reject(new Error(`Upload falló: HTTP ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Error de red durante el upload')));
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(audio.duration)); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    audio.src = url;
  });
}

async function getPresignedUrl(token, filename, contentType, folder, fileSizeBytes) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-upload-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename, contentType, folder, fileSizeBytes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error obteniendo URL de upload');
  return data;
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ accept, label, hint, icon: Icon, file, onFile, color = '#00CFFF' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const preview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

  return (
    <div
      className="relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden"
      style={{
        borderColor: dragging ? color : file ? `${color}60` : 'rgba(255,255,255,0.12)',
        background: dragging ? `${color}08` : file ? `${color}06` : 'rgba(255,255,255,0.03)',
        minHeight: 120,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {preview ? (
        <img src={preview} alt="cover" className="w-full h-full object-cover absolute inset-0" />
      ) : null}

      <div className={`flex flex-col items-center justify-center gap-2 p-5 text-center ${preview ? 'relative z-10 bg-black/50' : ''}`}>
        {file ? (
          <>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-xs font-bold text-white truncate max-w-[180px]">{file.name}</p>
            <p className="text-[10px] text-white/40">{(file.size / 1024 / 1024).toFixed(1)} MB · Clic para cambiar</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Icon className="w-5 h-5 text-white/30" />
            </div>
            <p className="text-xs font-semibold text-white/60">{label}</p>
            <p className="text-[10px] text-white/30">{hint}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ label, pct, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/60">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ background: `linear-gradient(to right, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function UploadPodcastModal({ onClose, onSuccess }) {
  const { currentUser } = useAuth();
  const { profile } = useProfile();

  const [step, setStep] = useState('files'); // files | info | uploading | done
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [form, setForm]  = useState({ title: '', description: '', genre: '' });
  const [audioProgress, setAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [error, setError] = useState(null);
  const [resultPod, setResultPod] = useState(null);

  const canGoToInfo = audioFile && coverFile;

  const handleUpload = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio.'); return; }
    setError(null);
    setStep('uploading');
    setAudioProgress(0);
    setCoverProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sesión expirada. Inicia sesión de nuevo.');

      // Get presigned URLs in parallel
      const [audioMeta, coverMeta] = await Promise.all([
        getPresignedUrl(token, audioFile.name, audioFile.type, 'podcasts/audio', audioFile.size),
        getPresignedUrl(token, coverFile.name, coverFile.type, 'podcasts/covers', coverFile.size),
      ]);

      // Upload cover first (small, fast) then audio (large)
      await Promise.all([
        uploadWithProgress(coverFile, coverMeta.uploadUrl, setCoverProgress),
        uploadWithProgress(audioFile, audioMeta.uploadUrl, setAudioProgress),
      ]);

      // Get audio duration
      const duration = await getAudioDuration(audioFile);

      // Save to DB
      const { data: pod, error: dbError } = await supabase
        .from('podcasts')
        .insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          genre: form.genre || null,
          audio_url: audioMeta.publicUrl,
          cover_url: coverMeta.publicUrl,
          duration,
          uploaded_by: currentUser.id,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      setResultPod(pod);
      setStep('done');
      onSuccess?.();
    } catch (err) {
      setError(err.message);
      setStep('info');
    }
  };

  const gColor = form.genre ? getGenreColor(form.genre) : '#00CFFF';

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-[106px] sm:pb-[106px]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
        onClick={step !== 'uploading' ? onClose : undefined}
      />

      {/* Panel */}
      <motion.div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto"
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        style={{
          background: 'rgba(10,13,26,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          maxHeight: 'calc(100vh - 130px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            {step === 'info' && (
              <button type="button" onClick={() => setStep('files')} className="p-1 text-white/40 hover:text-white/70 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-black text-white">
                {step === 'files' && 'Subir Podcast'}
                {step === 'info'  && 'Información'}
                {step === 'uploading' && 'Subiendo...'}
                {step === 'done'  && '¡Listo!'}
              </h2>
              <p className="text-[10px] text-white/35 mt-0.5">
                {profile?.display_name || currentUser?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          {step !== 'uploading' && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-5 pt-4">
          {['files', 'info', 'uploading'].map((s, i) => (
            <div key={s} className="h-0.5 flex-1 rounded-full transition-all duration-300"
              style={{ background: ['files','info','uploading','done'].indexOf(step) >= i ? '#00CFFF' : 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Files ── */}
          {step === 'files' && (
            <motion.div key="files" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 space-y-4">
              <DropZone
                accept="audio/mpeg,audio/mp3,audio/wav,audio/flac,audio/aac,audio/ogg"
                label="Arrastra tu audio aquí"
                hint="MP3 · WAV · FLAC · AAC — máx. 500 MB"
                icon={Music}
                file={audioFile}
                onFile={setAudioFile}
                color="#00CFFF"
              />
              <DropZone
                accept="image/jpeg,image/png,image/webp"
                label="Cover art"
                hint="JPG · PNG · WEBP — máx. 10 MB · recomendado 1:1"
                icon={ImageIcon}
                file={coverFile}
                onFile={setCoverFile}
                color="#A78BFA"
              />
              <button
                type="button"
                disabled={!canGoToInfo}
                onClick={() => setStep('info')}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: canGoToInfo ? 'linear-gradient(135deg,#00CFFF,#7B5CF0)' : 'rgba(255,255,255,0.06)',
                  color: canGoToInfo ? '#080B14' : 'rgba(255,255,255,0.25)',
                  cursor: canGoToInfo ? 'pointer' : 'not-allowed',
                }}
              >
                Continuar
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Info ── */}
          {step === 'info' && (
            <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 space-y-4">
              {/* Cover preview */}
              {coverFile && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <img src={URL.createObjectURL(coverFile)} alt="cover"
                    className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{audioFile?.name}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{(audioFile?.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nombre del podcast o mix"
                  maxLength={120}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = gColor; e.target.style.boxShadow = `0 0 0 1px ${gColor}25`; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Genre */}
              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Género</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {GENRES.map((g) => {
                    const c = getGenreColor(g);
                    const active = form.genre === g;
                    return (
                      <button key={g} type="button" onClick={() => setForm(f => ({ ...f, genre: active ? '' : g }))}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
                        style={{
                          background: active ? `${c}22` : 'rgba(255,255,255,0.04)',
                          color: active ? c : 'rgba(255,255,255,0.4)',
                          border: active ? `1px solid ${c}50` : '1px solid rgba(255,255,255,0.08)',
                        }}>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Tracklist, notas del set, contexto..."
                  rows={3}
                  maxLength={1000}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none resize-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = gColor; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button type="button" onClick={handleUpload}
                disabled={!form.title.trim()}
                className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all"
                style={{
                  background: form.title.trim() ? `linear-gradient(135deg, ${gColor}, #7B5CF0)` : 'rgba(255,255,255,0.06)',
                  color: form.title.trim() ? '#080B14' : 'rgba(255,255,255,0.25)',
                  cursor: form.title.trim() ? 'pointer' : 'not-allowed',
                }}>
                <Upload className="w-4 h-4" />
                Subir Podcast
              </button>
            </motion.div>
          )}

          {/* ── Step 3: Uploading ── */}
          {step === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {coverFile && (
                  <img src={URL.createObjectURL(coverFile)} alt="cover"
                    className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div>
                  <p className="text-sm font-bold text-white">{form.title}</p>
                  {form.genre && <p className="text-[11px] mt-0.5" style={{ color: gColor }}>{form.genre}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <ProgressBar label="Audio" pct={audioProgress} color="#00CFFF" />
                <ProgressBar label="Cover" pct={coverProgress} color="#A78BFA" />
              </div>

              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                <p className="text-xs text-white/40">
                  {audioProgress < 100 ? 'Subiendo archivos...' : 'Guardando en la plataforma...'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 text-center space-y-5">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(0,207,255,0.12)', border: '2px solid rgba(0,207,255,0.3)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: '#00CFFF' }} />
              </motion.div>

              <div>
                <h3 className="text-lg font-black text-white">¡Podcast subido!</h3>
                <p className="text-sm text-white/45 mt-1">Ya está disponible en la plataforma para todos.</p>
              </div>

              {coverFile && (
                <div className="flex items-center gap-3 p-3 rounded-xl text-left mx-auto max-w-xs" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <img src={URL.createObjectURL(coverFile)} alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{form.title}</p>
                    {form.genre && <p className="text-[11px] mt-0.5" style={{ color: getGenreColor(form.genre) }}>{form.genre}</p>}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white/80 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  Cerrar
                </button>
                <button type="button"
                  onClick={() => { setStep('files'); setAudioFile(null); setCoverFile(null); setForm({ title: '', description: '', genre: '' }); setAudioProgress(0); setCoverProgress(0); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
                  style={{ background: 'linear-gradient(135deg,#00CFFF,#7B5CF0)', color: '#080B14' }}>
                  Subir otro
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
