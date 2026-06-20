import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Loader2, X } from 'lucide-react';

const PLAYER_H = 98;

/* ── Tokens glassmorphism — dark botanical ── */
const glass = {
  panel: {
    background: 'rgba(13,20,19,0.54)',
    backdropFilter: 'blur(48px) saturate(200%) brightness(1.04)',
    WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.04)',
    border: '1px solid rgba(184,207,166,0.10)',
    boxShadow: [
      '0 48px 120px rgba(0,0,0,0.72)',
      '0 0 0 1px rgba(184,207,166,0.05)',
      'inset 0 1px 0 rgba(255,255,255,0.06)',
      'inset 0 -1px 0 rgba(0,0,0,0.28)',
    ].join(', '),
  },
  input: {
    background: 'rgba(255,255,255,0.045)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'white',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  header: {
    background: 'rgba(255,255,255,0.025)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
};

/* ── Sub-componentes ── */

export function FField({ label, required, span = 1, children }) {
  return (
    <div className={span === 2 ? 'col-span-2' : 'col-span-1'}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          {label}{required && <span className="ml-0.5" style={{ color: '#ff6b6b' }}>*</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export function FInput({ value, onChange, placeholder, type = 'text', min, step, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      step={step}
      {...rest}
      className="w-full text-sm px-3 py-2.5 rounded-xl placeholder:text-white/20"
      style={{
        ...glass.input,
        borderColor: focused ? 'rgba(32,199,232,0.6)' : 'rgba(255,255,255,0.1)',
        boxShadow: focused
          ? '0 0 0 3px rgba(32,199,232,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

export function FTextarea({ value, onChange, placeholder, rows = 3 }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm px-3 py-2.5 rounded-xl resize-none placeholder:text-white/20"
      style={{
        ...glass.input,
        borderColor: focused ? 'rgba(32,199,232,0.6)' : 'rgba(255,255,255,0.1)',
        boxShadow: focused
          ? '0 0 0 3px rgba(32,199,232,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

export function FSelect({ value, onChange, children, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full text-sm px-3 py-2.5 rounded-xl appearance-none"
      style={{
        ...glass.input,
        borderColor: focused ? 'rgba(32,199,232,0.6)' : 'rgba(255,255,255,0.1)',
        boxShadow: focused
          ? '0 0 0 3px rgba(32,199,232,0.08)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export function FImageZone({ file, onFile, previewUrl, label = 'Subir portada', hint = 'JPG, PNG, WEBP · máx 10 MB', aspect = 'aspect-video' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  const preview = file ? URL.createObjectURL(file) : previewUrl;

  return (
    <div
      className={`relative ${aspect} w-full rounded-2xl overflow-hidden cursor-pointer transition-all duration-200`}
      style={{
        border: `2px dashed ${dragging ? 'rgba(32,199,232,0.8)' : preview ? 'rgba(32,199,232,0.3)' : 'rgba(255,255,255,0.13)'}`,
        background: dragging
          ? 'rgba(32,199,232,0.07)'
          : preview
          ? 'transparent'
          : 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: dragging ? '0 0 0 4px rgba(32,199,232,0.1)' : 'none',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {preview && (
        <img src={preview} alt="portada" className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center transition-opacity duration-200 ${preview ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        style={{ background: preview ? 'rgba(0,0,0,0.6)' : 'transparent', backdropFilter: preview ? 'blur(4px)' : 'none' }}
      >
        <div className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(32,199,232,0.12)', border: '1px solid rgba(32,199,232,0.2)' }}>
          <ImageIcon className="w-5 h-5" style={{ color: '#20C7E8' }} />
        </div>
        <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {preview ? 'Cambiar imagen' : label}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>
      </div>
    </div>
  );
}

export function FSubmit({ children, loading, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 col-span-2 transition-all duration-200"
      style={{
        background: disabled || loading
          ? 'rgba(255,255,255,0.07)'
          : 'linear-gradient(135deg, rgba(32,199,232,0.9) 0%, rgba(0,180,221,0.9) 100%)',
        color: disabled || loading ? 'rgba(255,255,255,0.25)' : '#080B14',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(32,199,232,0.2)',
        boxShadow: disabled || loading ? 'none' : '0 4px 20px rgba(32,199,232,0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

/* ── Modal contenedor ── */
export default function FormModal({ title, subtitle, onClose, children, maxWidth = 'max-w-xl', closeable = true }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-6"
        style={{ paddingBottom: PLAYER_H }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: 'rgba(4,7,7,0.65)',
            backdropFilter: 'blur(24px) saturate(140%)',
            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          }}
          onClick={closeable ? onClose : undefined}
        />

        {/* Panel glassmorphism */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className={`relative w-full ${maxWidth} rounded-3xl flex flex-col`}
          style={{
            ...glass.panel,
            maxHeight: `calc(100vh - ${PLAYER_H + 32}px)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Línea superior de brillo */}
          <div className="absolute top-0 left-8 right-8 h-px rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0 rounded-t-3xl" style={glass.header}>
            <div>
              <h2 className="text-sm font-black text-white">{title}</h2>
              {subtitle && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>{subtitle}</p>}
            </div>
            {closeable && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.4)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Body scrollable */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {children}
          </div>

          {/* Línea inferior de sombra interior */}
          <div className="absolute bottom-0 left-0 right-0 h-16 rounded-b-3xl pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
