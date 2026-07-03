import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { ModalShell, ModalHeader } from './AdminModal';

// Reemplaza window.confirm (diálogo genérico del navegador, sin marca) por
// un modal propio de Polyfauna. Uso: const { confirm, ConfirmDialogElement } =
// useConfirmDialog(); ... if (!(await confirm({ title, message }))) return;
export function useConfirmDialog() {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);
  const [pending, setPending] = useState(false);

  const confirm = useCallback((options) => {
    setState(options);
    return new Promise((resolve) => { resolveRef.current = resolve; });
  }, []);

  const close = (result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
    setPending(false);
  };

  const handleConfirm = async () => {
    setPending(true);
    close(true);
  };

  const ConfirmDialogElement = (
    <AnimatePresence>
      {state && (
        <ModalShell onClose={() => close(false)} accent={state.variant === 'destructive' ? '#FF6B6B' : '#20C7E8'}>
          <ModalHeader
            icon={state.variant === 'destructive' ? Trash2 : AlertTriangle}
            accent={state.variant === 'destructive' ? '#FF6B6B' : '#20C7E8'}
            title={state.title}
            subtitle={state.subtitle}
            onClose={() => close(false)}
          />
          <p className="text-sm text-white/60 leading-relaxed">{state.message}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => close(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white/60 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              {state.cancelLabel || 'Cancelar'}
            </button>
            <button type="button" onClick={handleConfirm} disabled={pending}
              className="flex-1 rounded-xl py-2.5 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
              style={{
                background: state.variant === 'destructive' ? '#FF6B6B' : '#20C7E8',
                color: state.variant === 'destructive' ? '#2A0A0A' : '#031014',
              }}>
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {state.confirmLabel || 'Confirmar'}
            </button>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );

  return { confirm, ConfirmDialogElement };
}
