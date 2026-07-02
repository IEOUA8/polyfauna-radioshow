import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle, CloudUpload, Download, Loader2, QrCode, RefreshCw, ScanLine, Wifi, WifiOff, XCircle } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { parseTicketQRPayload } from '@/lib/tickets';
import { downloadEventPack, getOfflineScannerState, syncOfflineScans, validateTicketOffline } from '@/lib/offlineTickets';
import { useAuth } from '@/contexts/AuthContext';

/* ── Pantalla de resultado fullscreen ── */
function ResultScreen({ result, onScanNext }) {
  const isValid = result.code === 'VALID';
  const isUsed  = result.code === 'ALREADY_USED';

  const bg    = isValid
    ? 'radial-gradient(circle at 50% 30%, #4ade80 0%, #16a34a 42%, #052e16 100%)'
    : '#150505';
  const color = isValid ? '#ffffff' : '#ef4444';
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
          {isValid ? (result.offline ? 'Acceso offline registrado' : '¡Acceso autorizado!') : isUsed ? 'Ticket ya usado' : 'Ticket inválido'}
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
        {isValid && (
          <div className="mt-5 rounded-2xl px-6 py-4 min-w-[280px]"
            style={{ background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.28)' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Verificar identidad</p>
            <p className="text-xl font-black text-white mt-2">
              {result.full_name || 'Nombre no registrado'}
            </p>
            <p className="text-sm font-mono text-white/85 mt-1">
              {result.document_type || 'Documento'} · {result.document_number || 'Sin registrar'}
            </p>
          </div>
        )}
        {result.pendingSync && (
          <p className="text-xs mt-3 font-bold" style={{ color: '#f59e0b' }}>
            Pendiente de sincronizar con Polyfauna
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
        style={{ background: isValid ? '#ffffff' : color, color: isValid ? '#14532d' : '#150505' }}
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
        const { Html5Qrcode } = await import('html5-qrcode');
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
      const activeScanner = scannerRef.current;
      scannerRef.current = null;
      if (activeScanner) {
        try {
          const stopped = activeScanner.stop();
          if (stopped?.catch) stopped.catch(() => {});
        } catch (_) {
          // The scanner may already be stopped during route transitions.
        }
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
              <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: 'rgba(255,255,255,0.9)' }} />
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
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(255,255,255,0.9)' }} />
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
        style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
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
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineState, setOfflineState] = useState({ ready: false, pending: 0, ticketCount: 0, cachedAt: null });
  const [offlineBusy, setOfflineBusy] = useState(false);

  const refreshOfflineState = useCallback(async () => {
    setOfflineState(await getOfflineScannerState(eventId));
  }, [eventId]);

  const prepareOffline = useCallback(async () => {
    if (!eventId) return;
    setOfflineBusy(true);
    try {
      await downloadEventPack(eventId);
      await refreshOfflineState();
    } catch (error) {
      setResult({ code: 'ERROR', error: error.message || 'No se pudo descargar el evento' });
      setPhase('result');
    } finally {
      setOfflineBusy(false);
    }
  }, [eventId, refreshOfflineState]);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return;
    setOfflineBusy(true);
    try {
      await syncOfflineScans();
      await refreshOfflineState();
      if (eventId) await downloadEventPack(eventId);
      await refreshOfflineState();
    } catch (_) {
      // La cola permanece intacta para el siguiente intento.
    } finally {
      setOfflineBusy(false);
    }
  }, [eventId, refreshOfflineState]);

  // Carga nombre del evento si viene en params
  useEffect(() => {
    if (!eventId) return;
    supabase.from('events').select('title').eq('id', eventId).single()
      .then(({ data }) => { if (data) setEventName(data.title); });
  }, [eventId]);

  useEffect(() => {
    refreshOfflineState().catch(() => {});
    const onOnline = () => { setOnline(true); syncPending(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshOfflineState, syncPending]);

  const handleValidate = useCallback(async (rawText) => {
    if (checking) return;
    setChecking(true);
    setPhase('checking');

    const ticketId = parseTicketQRPayload(rawText);
    if (!ticketId) {
      setResult({ code: 'INVALID_QR', error: 'El código no pertenece a Polyfauna' });
      setChecking(false);
      setPhase('result');
      return;
    }

    let data = null;
    let error = null;
    if (navigator.onLine) {
      const rpcName = eventId ? 'validate_ticket_for_event' : 'validate_ticket';
      const params = eventId
        ? { p_ticket_id: ticketId, p_event_id: eventId }
        : { p_ticket_id: ticketId };
      ({ data, error } = await supabase.rpc(rpcName, params));
    }

    if (data && !error) {
      setResult(data);
    } else {
      const offlineResult = await validateTicketOffline(rawText, eventId);
      setResult(error && offlineResult.code === 'OFFLINE_NOT_READY'
        ? { code: 'ERROR', error: error.message }
        : offlineResult);
      await refreshOfflineState();
    }
    setChecking(false);
    setPhase('result');
  }, [checking, eventId, refreshOfflineState]);

  const handleDetected = useCallback((rawText) => {
    handleValidate(rawText);
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
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(255,255,255,0.9)' }} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: '#050814' }}>
        <QrCode className="w-12 h-12" style={{ color: 'rgba(255,255,255,0.9)' }} />
        <div>
          <p className="text-lg font-black text-white">Validador de Entradas</p>
          <p className="text-sm text-white/40 mt-1">Inicia sesión como promotor o admin para continuar.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-8 py-3 rounded-xl text-sm font-black"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
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
          <QrCode className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.9)' }} />
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
        {eventId && phase === 'scanning' && (
          <div className="w-full max-w-md rounded-2xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {online ? <Wifi className="w-4 h-4 text-green-400 shrink-0" /> : <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">{online ? 'Conectado' : offlineState.ready ? 'Modo offline listo' : 'Sin conexión'}</p>
              <p className="text-[10px] text-white/35 truncate">
                {offlineState.ready ? `${offlineState.ticketCount} tickets en caché` : 'Descarga el evento antes de abrir puertas'}
                {offlineState.pending > 0 ? ` · ${offlineState.pending} pendientes` : ''}
              </p>
            </div>
            <button type="button" onClick={offlineState.pending ? syncPending : prepareOffline} disabled={offlineBusy || (!online && !offlineState.ready)}
              className="px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              {offlineBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : offlineState.pending ? <CloudUpload className="w-3 h-3" /> : <Download className="w-3 h-3" />}
              {offlineState.pending ? 'Sincronizar' : offlineState.ready ? 'Actualizar' : 'Preparar'}
            </button>
          </div>
        )}
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
                  <Loader2 className="w-16 h-16 animate-spin" style={{ color: 'rgba(255,255,255,0.9)' }} />
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
