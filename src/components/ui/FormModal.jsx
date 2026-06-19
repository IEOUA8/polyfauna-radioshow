/**
 * FormModal — Modal base para todos los formularios de creación/edición.
 *
 * Características:
 * - z-[60]: siempre encima del GlobalPlayer (z-50)
 * - max-height que respeta la altura del player (82px + margins)
 * - Header con imagen de portada drag-and-drop + preview
 * - Body scrollable con grid de 2 columnas
 * - Inputs y selects con diseño coherente
 */

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Loader2, X } from 'lucide-react';

/* ── Constantes ── */
const PLAYER_H = 98; // altura del player + margen de seguridad (px)

/* ── Sub-componentes reutilizables ── */

/** Input de texto / number / date */
export function FField({ label, required, span = 1, children }) {
  return (
    <div className={span === 2 ? 'col-span-2' : 'col-span-1'}>
      {label && (
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {label}{required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      {children}
    </div>
  );
}

const inputBase = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.09)',
  color: 'white',
  outline: 'none',
  transition: 'border-color 0.15s',
};

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
      className="w-full text-sm px-3 py-2.5 rounded-xl"
      style={{ ...inputBase, borderColor: focused ? '#00CFFF' : 'rgba(255,255,255,0.09)' }}
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
      className="w-full text-sm px-3 py-2.5 rounded-xl resize-none"
      style={{ ...inputBase, borderColor: focused ? '#00CFFF' : 'rgba(255,255,255,0.09)' }}
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
      style={{ ...inputBase, borderColor: focused ? '#00CFFF' : 'rgba(255,255,255,0.09)' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

/** Zona de imagen drag-and-drop con preview */
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
      className={`relative ${aspect} w-full rounded-2xl overflow-hidden cursor-pointer transition-all`}
      style={{
        border: `2px dashed ${dragging ? '#00CFFF' : preview ? 'rgba(0,207,255,0.25)' : 'rgba(255,255,255,0.12)'}`,
        background: dragging ? 'rgba(0,207,255,0.06)' : preview ? 'transparent' : 'rgba(255,255,255,0.03)',
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
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center transition-opacity ${preview ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        style={{ background: preview ? 'rgba(0,0,0,0.55)' : 'transparent' }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,207,255,0.12)' }}>
          <ImageIcon className="w-5 h-5" style={{ color: '#00CFFF' }} />
        </div>
        <p className="text-xs font-semibold text-white/70">{preview ? 'Cambiar imagen' : label}</p>
        <p className="text-[10px] text-white/30">{hint}</p>
      </div>
    </div>
  );
}

/** Submit button */
export function FSubmit({ children, loading, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 col-span-2"
      style={{ background: '#00CFFF', color: '#080B14' }}
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
        className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-6"
        style={{ paddingBottom: PLAYER_H }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'rgba(3,5,16,0.88)', backdropFilter: 'blur(14px)' }}
          onClick={closeable ? onClose : undefined}
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className={`relative w-full ${maxWidth} rounded-3xl overflow-hidden flex flex-col shadow-2xl`}
          style={{
            background: 'rgba(10,13,28,0.98)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,207,255,0.05)',
            maxHeight: `calc(100vh - ${PLAYER_H + 32}px)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <h2 className="text-sm font-black text-white">{title}</h2>
              {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
            </div>
            {closeable && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white transition-colors shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
