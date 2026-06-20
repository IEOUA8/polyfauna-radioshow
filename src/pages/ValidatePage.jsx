import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, QrCode, RefreshCw, ScanLine, XCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

/* ── Extraer UUID del payload del QR ── */
function parseQRPayload(raw) {
  // Formato: polyfauna://ticket/{uuid}
  const match = raw.match(/polyfauna:\/\/ticket\/([0-9a-f-]{36})/i);
  if (match) return match[1];
  // Fallback: si escanearon directamente un UUID
  if (/^[0-9a-f-]{36}$/i.test(raw.trim())) return raw.trim();
  return null;
}

/* ── Pantalla de resultado fullscreen ── */
function ResultScreen({ result, onScanNext }) {
  const isValid = result.code === 'VALID';
  const isUsed  = result.code === 'ALREADY_USED';

  const bg    = isValid ? '#052010' : '#150505';
  const color = isValid ? '#22c55e' : '#ef4444';
  const Icon  = isValid ? CheckCircle : XCircle;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: bg }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
      >
        <Icon className="w-24 h-24" style={{ color }} />
      </motion.div>

      <div>
        <p className="text-2xl font-black text-white">
          {isValid ? '¡Acceso autorizado!' : isUsed ? 'Ticket ya usado' : 'Ticket inválido'}
        </p>
        {result.event_title && (
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {result.event_title}
          </p>
        )}
        {result.ticket_type && (
          <p className="text-xs mt-1 font-bold uppercase tracking-widest" style={{ color }}>
            {result.ticket_type}
          </p>
        )}
        {result.ticket_number && (
          <p className="text-xs font-mono mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            #{result.ticket_number}
          </p>
        )}
        {!isValid && (
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {result.error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onScanNext}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
        style={{ background: color, color: isValid ? '#052010' : '#150505' }}
      >
        <ScanLine className="w-5 h-5" />
        Escanear siguiente
      </button>
    </motion.div>
  );
}

/* ── Vista del escáner con visor ── */
function ScannerView({ onDetected, eventName }) {
  const scannerRef   = useRef(null);
  const containerRef = useRef(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError]   = useState(null);

  useEffect(() => {
    let scanner = null;
    let mounted = true;

    const start = async () => {
      if (!containerRef.current) return;
      try {
        scanner = new Html5Qrcode('qr-scanner-region', { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decodedText) => {
            if (!mounted) return;
            onDetected(decodedText);
          },
          () => {} // ignore frame errors (normal during scanning)
        );

        if (mounted) setScannerReady(true);
      } catch (err) {
        if (mounted) setCameraError(err.message || 'No se pudo acceder a la cámara');
      }
    };

    start();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onDetected]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <div>
          <p className="text-sm font-bold text-white">No se pudo acceder a la cámara</p>
          <p className="text-xs text-white/40 mt-1">{cameraError}</p>
          <p className="text-xs text-white/30 mt-2">Verifica que el navegador tiene permiso para usar la cámara.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-4 w-full">
      {/* Visor */}
      <div className="relative w-72 h-72 mx-auto">
        {/* html5-qrcode inyecta el video aquí */}
        <div id="qr-scanner-region" ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />

        {/* Corner markers */}
        {scannerReady && (
          <>
            {[
              'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
              'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
              'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
              'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: '#20C7E8' }} />
            ))}
            {/* Scan line animation */}
            <motion.div
              className="absolute left-3 right-3 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #20C7E8, transparent)' }}
              animate={{ top: ['12%', '88%'] }}
              transition={{ duration: 2.2, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
            />
          </>
        )}

        {!scannerReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(8,13,9,0.80)' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#20C7E8' }} />
          </div>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Apunta la cámara al QR del ticket
        {eventName && <><br /><span style={{ color: 'rgba(255,255,255,0.5)' }}>{eventName}</span></>}
      </p>
    </div>
  );
}

/* ── Entrada manual como fallback ── */
function ManualEntry({ onSubmit, loading }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xs mx-auto">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="UUID del ticket…"
        className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none font-mono"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
      />
      <button
        type="submit"
        disabled={!value.trim() || loading}
        className="px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-40"
        style={{ background: '#20C7E8', color: '#080B14' }}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
      </button>
    </form>
  );
}

/* ── Página principal ── */
export default function ValidatePage() {
  const { currentUser, userRole, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');

  const [phase, setPhase]     = useState('scanning'); // scanning | checking | result
  const [result, setResult]   = useState(null);
  const [checking, setChecking] = useState(false);
  const [eventName, setEventName] = useState('');
  const [scanKey, setScanKey] = useState(0); // re-mount scanner on "next scan"

  // Carga nombre del evento si viene en params
  useEffect(() => {
    if (!eventId) return;
    supabase.from('events').select('title').eq('id', eventId).single()
      .then(({ data }) => { if (data) setEventName(data.title); });
  }, [eventId]);

  const handleValidate = useCallback(async (ticketId) => {
    if (checking) return;
    setChecking(true);
    setPhase('checking');

    const { data, error } = await supabase.rpc('validate_ticket', { p_ticket_id: ticketId });

    if (error) {
      setResult({ code: 'ERROR', error: error.message });
    } else {
      setResult(data);
    }
    setChecking(false);
    setPhase('result');
  }, [checking]);

  const handleDetected = useCallback((rawText) => {
    const uuid = parseQRPayload(rawText);
    if (!uuid) return; // QR que no es un ticket de PolyFauna, ignorar
    handleValidate(uuid);
  }, [handleValidate]);

  const handleScanNext = () => {
    setResult(null);
    setPhase('scanning');
    setScanKey(k => k + 1); // re-monta el scanner limpio
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050814' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#20C7E8' }} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: '#050814' }}>
        <QrCode className="w-12 h-12" style={{ color: '#20C7E8' }} />
        <div>
          <p className="text-lg font-black text-white">Validador de Entradas</p>
          <p className="text-sm text-white/40 mt-1">Inicia sesión como promotor o admin para continuar.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-8 py-3 rounded-xl text-sm font-black"
          style={{ background: '#20C7E8', color: '#080B14' }}
        >
          Iniciar sesión
        </button>
      </div>
    );
  }

  const canValidate = ['promoter', 'club', 'admin'].includes(userRole);
  if (!canValidate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#050814' }}>
        <AlertTriangle className="w-10 h-10 text-yellow-400" />
        <p className="text-base font-black text-white">Sin acceso</p>
        <p className="text-sm text-white/40">Necesitas rol de promotor o admin para validar entradas.</p>
        <button type="button" onClick={() => navigate('/')} className="text-xs text-white/30 hover:text-white mt-2">
          ← Volver a la plataforma
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050814' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-semibold text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4" style={{ color: '#20C7E8' }} />
          <span className="text-xs font-black text-white">Validador PolyFauna</span>
        </div>
        {phase !== 'scanning' && (
          <button type="button" onClick={handleScanNext} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        {phase === 'scanning' && <div className="w-16" />}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-8 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === 'result' && result ? (
            <ResultScreen key="result" result={result} onScanNext={handleScanNext} />
          ) : (
            <motion.div
              key={`scanner-${scanKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-8"
            >
              {phase === 'checking' ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-16 h-16 animate-spin" style={{ color: '#20C7E8' }} />
                  <p className="text-sm text-white/50">Verificando ticket…</p>
                </div>
              ) : (
                <ScannerView key={scanKey} onDetected={handleDetected} eventName={eventName} />
              )}

              {/* Manual entry fallback */}
              {phase === 'scanning' && (
                <div className="w-full flex flex-col items-center gap-3">
                  <p className="text-[11px] text-white/20 uppercase tracking-widest">o ingresa el UUID manualmente</p>
                  <ManualEntry
                    onSubmit={(uuid) => handleValidate(uuid)}
                    loading={checking}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 text-center shrink-0">
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
          {currentUser.email} · PolyFauna Ticket Validator
        </p>
      </div>
    </div>
  );
}
