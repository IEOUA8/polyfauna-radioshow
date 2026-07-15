import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, AlertTriangle, ArrowUpRight, Banknote, BarChart2, CalendarDays, CheckCircle,
  ChevronRight, CreditCard, Disc3, FileText, Headphones, Home, Loader2, Mail, Menu,
  Gift, MessageCircle, Mic, Music, QrCode, Radio, RefreshCw, ScanLine, Shield,
  Ticket, TrendingUp, UserPlus, Users, WifiOff, X, XCircle,
} from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { parseTicketQRPayload } from '@/lib/tickets';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Logo from '@/components/Logo';
import { TransferTicketModal, VoidTicketModal } from '@/components/admin/TicketActionModals';
import { useConfirmDialog } from '@/components/admin/ConfirmDialog';
import { lazyImport } from '@/lib/lazyImport';

const EventManager     = lazy(lazyImport(() => import('@/components/admin/EventManager')));
const PodcastManager   = lazy(lazyImport(() => import('@/components/admin/PodcastManager')));
const BlogManager      = lazy(lazyImport(() => import('@/components/admin/BlogManager')));
const InterviewManager = lazy(lazyImport(() => import('@/components/admin/InterviewManager')));
const UserManager      = lazy(lazyImport(() => import('@/components/admin/UserManager')));
const ArtistManager    = lazy(lazyImport(() => import('@/components/admin/ArtistManager')));
const AlbumManager     = lazy(lazyImport(() => import('@/components/admin/AlbumManager')));

/* ─────────────────────── NAV CONFIG ─────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Gestión',
    items: [
      { id: 'dashboard', label: 'Dashboard',   icon: BarChart2,   color: 'rgba(255,255,255,0.85)' },
      { id: 'analytics', label: 'Métricas',    icon: TrendingUp,  color: '#5DE0A3' },
      { id: 'operations', label: 'Operación',   icon: AlertTriangle, color: '#f59e0b' },
      { id: 'support',   label: 'Soporte',      icon: MessageCircle, color: '#93c5fd' },
      { id: 'events',    label: 'Eventos',      icon: CalendarDays,color: 'rgba(255,255,255,0.85)' },
      { id: 'tickets',   label: 'Tickets',      icon: Ticket,      color: 'rgba(255,255,255,0.85)' },
      { id: 'refunds',   label: 'Devoluciones', icon: RefreshCw,   color: 'rgba(255,255,255,0.85)' },
      { id: 'qr',        label: 'Lector QR',    icon: QrCode,      color: '#22c55e' },
      { id: 'wallet',    label: 'Wallet',        icon: Banknote,    color: 'rgba(255,255,255,0.85)' },
      { id: 'payouts',   label: 'Retiros',       icon: ArrowUpRight, color: 'rgba(255,255,255,0.85)' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { id: 'podcasts',   label: 'Podcasts',    icon: Headphones,  color: 'rgba(255,255,255,0.85)' },
      { id: 'blog',       label: 'Blog',         icon: FileText,    color: 'rgba(255,255,255,0.7)' },
      { id: 'interviews', label: 'Interviews',   icon: Mic,         color: 'rgba(255,255,255,0.85)' },
      { id: 'artists',    label: 'Artistas',     icon: Disc3,       color: 'rgba(255,255,255,0.85)' },
      { id: 'albums',     label: 'Álbumes',      icon: Music,       color: 'rgba(255,255,255,0.85)' },
    ],
  },
  {
    label: 'Usuarios',
    items: [
      { id: 'users', label: 'Usuarios', icon: Users, color: 'rgba(255,255,255,0.6)' },
    ],
  },
];

/* ─────────────────────── QR SCANNER ─────────────────────── */
function QRResultBanner({ result, onDismiss }) {
  const ok = result.code === 'VALID';
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex items-center gap-4 px-5 py-4 rounded-2xl"
      style={{
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}
    >
      {ok
        ? <CheckCircle className="w-6 h-6 shrink-0" style={{ color: '#22c55e' }} />
        : <XCircle className="w-6 h-6 shrink-0" style={{ color: '#ef4444' }} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black" style={{ color: ok ? '#22c55e' : '#ef4444' }}>
          {ok ? '¡Acceso autorizado!' : result.code === 'ALREADY_USED' ? 'Ticket ya usado' : 'Ticket inválido'}
        </p>
        {result.event_title && <p className="text-xs text-white/50 truncate mt-0.5">{result.event_title}</p>}
        {result.ticket_number && <p className="text-[10px] font-mono text-white/30 mt-0.5">#{result.ticket_number}</p>}
        {!ok && result.error && <p className="text-[10px] text-red-400/70 mt-0.5">{result.error}</p>}
      </div>
      <button type="button" onClick={onDismiss}>
        <X className="w-4 h-4 text-white/30 hover:text-white transition-colors" />
      </button>
    </motion.div>
  );
}

function QRScannerWidget({ scanKey, eventId }) {
  const scannerRef   = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady]       = useState(false);
  const [error, setError]       = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult]     = useState(null);
  const [manualVal, setManualVal] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const processingRef = useRef(false);

  const validate = useCallback(async (uuid) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setChecking(true);
    const { data, error: rpcErr } = eventId
      ? await supabase.rpc('validate_ticket_for_event', { p_ticket_id: uuid, p_event_id: eventId })
      : await supabase.rpc('validate_ticket', { p_ticket_id: uuid });
    setResult(rpcErr ? { code: 'ERROR', error: rpcErr.message } : data);
    if (!rpcErr && data?.code === 'VALID') setScanCount(c => c + 1);
    setChecking(false);
    setTimeout(() => { processingRef.current = false; }, 2500);
  }, [eventId]);

  const onDetected = useCallback((raw) => {
    const uuid = parseTicketQRPayload(raw);
    if (!uuid || processingRef.current) return;
    validate(uuid);
  }, [validate]);

  useEffect(() => {
    let scanner = null;
    let mounted = true;
    const start = async () => {
      if (!containerRef.current) return;
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('admin-qr-region', { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => { if (mounted) onDetected(text); },
          () => {}
        );
        if (mounted) setReady(true);
      } catch (e) {
        if (mounted) setError(e.message || 'Sin acceso a la cámara');
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
  }, [onDetected, scanKey]);

  return (
    <div className="space-y-5">
      {/* Result banner */}
      <AnimatePresence>
        {result && (
          <QRResultBanner key="result" result={result} onDismiss={() => setResult(null)} />
        )}
      </AnimatePresence>

      {/* Scan counter */}
      {scanCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl w-fit" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
          <span className="text-xs font-bold" style={{ color: '#22c55e' }}>{scanCount} ticket{scanCount !== 1 ? 's' : ''} validado{scanCount !== 1 ? 's' : ''} en esta sesión</span>
        </div>
      )}

      {/* Scanner viewport */}
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-400" />
            <p className="text-sm font-bold text-white">Sin acceso a la cámara</p>
            <p className="text-xs text-white/40">{error}</p>
          </div>
        ) : (
          <div className="relative w-64 h-64 mx-auto">
            <div
              id="admin-qr-region"
              ref={containerRef}
              className="w-full h-full rounded-2xl overflow-hidden"
              style={{ background: '#0a0f0e' }}
            />
            {ready && (
              <>
                {[
                  'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                  'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                  'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                  'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-7 h-7 pointer-events-none ${cls}`} style={{ borderColor: checking ? '#F59E0B' : '#22c55e' }} />
                ))}
                <motion.div
                  className="absolute left-3 right-3 h-0.5 rounded-full pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${checking ? '#F59E0B' : '#22c55e'}, transparent)` }}
                  animate={{ top: ['12%', '88%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
                />
              </>
            )}
            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(8,13,9,0.8)' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#22c55e' }} />
              </div>
            )}
            {checking && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(8,13,9,0.7)' }}>
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(255,255,255,0.85)' }} />
                  <p className="text-xs text-white/60">Verificando…</p>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-white/35 text-center">Apunta la cámara al código QR del ticket</p>
      </div>

      {/* Manual fallback */}
      <div className="border-t pt-5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 text-center">Ingreso manual</p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (manualVal.trim()) { validate(manualVal.trim()); setManualVal(''); } }}
          className="flex gap-2 max-w-xs mx-auto"
        >
          <input
            value={manualVal}
            onChange={e => setManualVal(e.target.value)}
            placeholder="UUID del ticket…"
            className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none font-mono"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
          />
          <button
            type="submit"
            disabled={!manualVal.trim() || checking}
            className="px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-40"
            style={{ background: '#22c55e', color: '#052010' }}
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────── DASHBOARD SECTION ─────────────────────── */
function StatTile({ label, value, icon: Icon, loading, sub, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-5 rounded-2xl flex flex-col gap-3 overflow-hidden"
      style={accent
        ? { background: `linear-gradient(135deg, rgba(${accent},0.14), rgba(10,15,14,0.95))`, border: `1px solid rgba(${accent},0.22)` }
        : { background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {accent && (
        <div
          className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(${accent},0.18), transparent 70%)`, transform: 'translate(30%, -30%)' }}
        />
      )}
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accent ? `rgba(${accent},0.14)` : 'rgba(255,255,255,0.05)' }}>
          <Icon className="w-4 h-4" style={{ color: accent ? `rgb(${accent})` : 'rgba(255,255,255,0.5)' }} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-20 rounded animate-pulse relative z-10" style={{ background: 'rgba(255,255,255,0.06)' }} />
        : <p className="text-3xl font-black relative z-10" style={{ color: accent ? `rgb(${accent})` : '#fff' }}>{value}</p>
      }
      {sub && <p className="text-[11px] text-white/25 relative z-10">{sub}</p>}
    </motion.div>
  );
}

function DashboardSection({ ownerId }) {
  const [stats, setStats] = useState({ users: 0, events: 0, tickets: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState([]);

  useEffect(() => {
    const load = async () => {
      let eventsQuery = supabase.from('events').select('id', { count: 'exact', head: true });
      if (ownerId) eventsQuery = eventsQuery.eq('owner_id', ownerId);

      // Tickets + ingresos en una sola consulta agregada, escopeada al dueño
      // cuando aplica (antes eran 2 consultas extra sin límite y SIN filtrar
      // por ownerId, así que un promotor veía el total de toda la plataforma).
      let ticketsAggQuery = supabase.from('user_tickets').select('id, ticket_type, events!inner(price, owner_id)', { count: 'exact' });
      if (ownerId) ticketsAggQuery = ticketsAggQuery.eq('events.owner_id', ownerId);

      // user_tickets.user_id referencia auth.users, no profiles: no hay FK
      // directa para que PostgREST anide profiles(...) aqui (siempre fallaba
      // con 400 y "Sin ventas aun"). Se trae el nombre en una segunda consulta.
      let recentTicketsQuery = ownerId
        ? supabase.from('user_tickets').select('id, user_id, ticket_type, created_at, events!inner(title, price, owner_id)').eq('events.owner_id', ownerId)
        : supabase.from('user_tickets').select('id, user_id, ticket_type, created_at, events(title, price)');
      recentTicketsQuery = recentTicketsQuery.order('created_at', { ascending: false }).limit(50);

      const [usersRes, eventsRes, ticketsRes, ticketsAggRes] = await Promise.all([
        ownerId ? Promise.resolve({ count: 0 }) : supabase.from('profiles').select('id', { count: 'exact', head: true }),
        eventsQuery,
        recentTicketsQuery,
        ticketsAggQuery,
      ]);

      // Las cortesías no generan ingreso real (son regalos del organizador),
      // así que no se suman al total aunque el evento tenga precio de lista.
      const revenue = (ticketsAggRes.data || [])
        .reduce((sum, t) => sum + (t.ticket_type === 'Cortesía' ? 0 : (t.events?.price || 0)), 0);

      const buyerIds = [...new Set((ticketsRes.data || []).map(t => t.user_id).filter(Boolean))];
      const { data: buyerProfiles } = buyerIds.length
        ? await supabase.from('profiles').select('id, display_name').in('id', buyerIds)
        : { data: [] };
      const nameById = Object.fromEntries((buyerProfiles || []).map(p => [p.id, p.display_name]));

      setStats({
        users: ownerId ? buyerIds.length : usersRes.count || 0,
        events: eventsRes.count || 0,
        tickets: ticketsAggRes.count ?? ticketsAggRes.data?.length ?? 0,
        revenue,
      });
      setRecentTickets((ticketsRes.data || []).map(t => ({ ...t, buyerName: t.user_id ? nameById[t.user_id] : null })));
      setLoading(false);
    };
    load();
  }, [ownerId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Dashboard</h2>
        <p className="text-sm text-white/40 mt-0.5">{ownerId ? 'Resumen de tus eventos' : 'Resumen general de la plataforma'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={ownerId ? 'Asistentes' : 'Usuarios'} value={stats.users} icon={Users} loading={loading} sub={ownerId ? 'Con ticket' : 'Registrados'} accent="96,165,250" />
        <StatTile label="Eventos" value={stats.events} icon={CalendarDays} loading={loading} sub="Creados" accent="255,138,31" />
        <StatTile label="Tickets" value={stats.tickets} icon={Ticket} loading={loading} sub="Vendidos" accent="167,139,250" />
        <StatTile
          label="Ingresos"
          value={loading ? '—' : `$${stats.revenue.toLocaleString('es-CO')}`}
          icon={Banknote}
          loading={loading}
          sub="COP total"
          accent="93,224,163"
        />
      </div>

      {/* Recent tickets */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Últimas ventas</h3>
          <TrendingUp className="w-4 h-4 text-white/30" />
        </div>
        {loading ? (
          <div className="px-5 pb-5 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : recentTickets.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-white/30">Sin ventas aún</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {recentTickets.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{t.events?.title || 'Evento'}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    {t.buyerName || 'Usuario'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    ${(t.ticket_type === 'Cortesía' ? 0 : (t.events?.price || 0)).toLocaleString('es-CO')}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {new Date(t.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentDashboardSection({ ownerId }) {
  const [stats, setStats] = useState({ podcasts: 0, podcastPlays: 0, albums: 0, tracks: 0, trackPlays: 0 });
  const [myArtist, setMyArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [artistRes, podcastsRes, albumsRes] = await Promise.all([
        supabase.from('artists').select('id, name, slug').eq('user_id', ownerId).maybeSingle(),
        supabase.from('podcasts').select('play_count', { count: 'exact' }).eq('uploaded_by', ownerId),
        supabase.from('albums').select('id', { count: 'exact' }).eq('uploaded_by', ownerId),
      ]);

      const albumIds = (albumsRes.data || []).map(a => a.id);
      const tracksRes = albumIds.length
        ? await supabase.from('tracks').select('play_count', { count: 'exact' }).in('album_id', albumIds)
        : { data: [], count: 0 };

      setMyArtist(artistRes.data || null);
      setStats({
        podcasts: podcastsRes.count || 0,
        podcastPlays: (podcastsRes.data || []).reduce((sum, p) => sum + (p.play_count || 0), 0),
        albums: albumsRes.count || 0,
        tracks: tracksRes.count || 0,
        trackPlays: (tracksRes.data || []).reduce((sum, t) => sum + (t.play_count || 0), 0),
      });
      setLoading(false);
    };
    if (ownerId) load();
  }, [ownerId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Dashboard</h2>
          <p className="text-sm text-white/40 mt-0.5">Resumen de tu contenido</p>
        </div>
        {myArtist?.slug && (
          <a
            href={`/?section=artists&artist=${myArtist.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            Ver mi perfil público <ChevronRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Podcasts" value={stats.podcasts} icon={Headphones} loading={loading} sub="Publicados" accent="96,165,250" />
        <StatTile label="Álbumes" value={stats.albums} icon={Disc3} loading={loading} sub="Publicados" accent="255,138,31" />
        <StatTile label="Tracks" value={stats.tracks} icon={Music} loading={loading} sub="En tus álbumes" accent="167,139,250" />
        <StatTile
          label="Reproducciones"
          value={stats.podcastPlays + stats.trackPlays}
          icon={TrendingUp}
          loading={loading}
          sub={`${stats.podcastPlays} podcast · ${stats.trackPlays} tracks`}
          accent="93,224,163"
        />
      </div>
    </div>
  );
}

function OperationalSection() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [operationalResult, radioResult] = await Promise.all([
      supabase.rpc('get_operational_alerts'),
      supabase.rpc('get_radio_health_alerts'),
    ]);
    const { data, error: alertError } = operationalResult;
    const radioAlerts = radioResult.error?.code === '42883' ? [] : (radioResult.data || []);
    if (alertError) {
      setError(alertError.code === '42883'
        ? 'La migración de alertas operativas aún no está aplicada en Supabase.'
        : alertError.message);
      setAlerts([]);
    } else {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      setAlerts([...(data || []), ...radioAlerts].sort((a, b) =>
        (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
        || new Date(b.latest_at || 0) - new Date(a.latest_at || 0)
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const criticalCount = alerts.filter(alert => alert.severity === 'critical').length;
  const warningCount = alerts.filter(alert => alert.severity === 'warning').length;

  const colorFor = (severity) => {
    if (severity === 'critical') return { fg: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)' };
    if (severity === 'warning') return { fg: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' };
    return { fg: '#93c5fd', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.22)' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Operación</h2>
          <p className="text-sm text-white/40 mt-0.5">Alertas vivas de pagos, tickets, soporte y estabilidad</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Críticas" value={criticalCount} icon={AlertTriangle} loading={loading} sub="Atención inmediata" />
        <StatTile label="Advertencias" value={warningCount} icon={Shield} loading={loading} sub="Revisar hoy" />
        <StatTile label="Total alertas" value={alerts.length} icon={BarChart2} loading={loading} sub="Estado actual" />
      </div>

      {error ? (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-sm font-bold text-red-300">No se pudieron cargar alertas</p>
          <p className="text-xs text-red-200/55 mt-1">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.16)' }}>
          <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#22c55e' }} />
          <p className="text-sm font-black text-white">Sin alertas operativas</p>
          <p className="text-xs text-white/35 mt-1">Pagos, tickets, soporte y errores no tienen señales activas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const colors = colorFor(alert.severity);
            return (
              <div
                key={alert.code}
                className="p-4 rounded-2xl"
                style={{ background: 'rgba(11,16,15,0.90)', border: `1px solid ${colors.border}` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: colors.bg }}>
                      <AlertTriangle className="w-5 h-5" style={{ color: colors.fg }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-white">{alert.title}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                          style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-white/45 mt-1">{alert.detail}</p>
                      <p className="text-xs text-white/30 mt-2 leading-relaxed">{alert.action}</p>
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <p className="text-2xl font-black" style={{ color: colors.fg }}>{Number(alert.affected_count || 0).toLocaleString('es-CO')}</p>
                    <p className="text-[10px] text-white/30">
                      {alert.latest_at
                        ? new Date(alert.latest_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Sin fecha'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsageMetricsSection() {
  const [hours, setHours] = useState(24);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: metricsError } = await supabase.rpc('get_usage_metrics', { p_hours: hours });

    if (metricsError) {
      setError(metricsError.code === '42883'
        ? 'La migración del tablero de métricas aún no está aplicada en Supabase.'
        : metricsError.message);
      setMetrics(null);
    } else {
      setMetrics(data);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const summary = metrics?.summary || {};
  const funnel = metrics?.funnel || [];
  const timeline = metrics?.timeline || [];
  const checkoutErrors = metrics?.checkout_errors || [];
  const maxSessions = Math.max(1, ...timeline.map(item => Number(item.sessions || 0)));
  const firstStage = Number(funnel[0]?.count || 0);

  const formatBucket = (value) => {
    const date = new Date(value);
    return hours <= 48
      ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const stageLabel = {
    event_view: 'Vista del evento',
    checkout_start: 'Checkout iniciado',
    checkout_ready: 'Pago preparado',
    ticket_claimed: 'Ticket emitido',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Métricas</h2>
          <p className="text-sm text-white/40 mt-0.5">Actividad, escucha y conversión sin datos personales</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { value: 1, label: '1h' },
              { value: 6, label: '6h' },
              { value: 24, label: '24h' },
              { value: 168, label: '7d' },
              { value: 720, label: '30d' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHours(option.value)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors"
                style={{
                  background: hours === option.value ? '#ECECEC' : 'transparent',
                  color: hours === option.value ? '#090C0B' : 'rgba(255,255,255,0.38)',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-sm font-bold text-red-300">No se pudieron cargar las métricas</p>
          <p className="text-xs text-red-200/55 mt-1">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Sesiones activas" value={Number(summary.sessions || 0).toLocaleString('es-CO')} icon={Users} loading={loading} sub="Sesiones únicas" />
            <StatTile label="Escuchas live" value={Number(summary.live_starts || 0).toLocaleString('es-CO')} icon={Radio} loading={loading} sub="Inicios de radio" />
            <StatTile label="On-demand" value={Number(summary.media_starts || 0).toLocaleString('es-CO')} icon={Headphones} loading={loading} sub="Podcasts y música" />
            <StatTile label="Errores checkout" value={Number(summary.checkout_errors || 0).toLocaleString('es-CO')} icon={AlertTriangle} loading={loading} sub="Intentos con error" />
          </div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-sm font-black text-white">Actividad por {hours <= 48 ? 'hora' : 'día'}</h3>
                  <p className="text-[11px] text-white/30 mt-0.5">Sesiones únicas por intervalo</p>
                </div>
                <span className="text-[10px] text-white/25">{Number(summary.total_events || 0).toLocaleString('es-CO')} señales</span>
              </div>
              {loading ? (
                <div className="h-44 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.035)' }} />
              ) : timeline.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-white/30">Sin actividad en esta ventana</div>
              ) : (
                <div className="h-44 flex items-end gap-1.5 overflow-hidden">
                  {timeline.map((item, index) => {
                    const height = Math.max(3, (Number(item.sessions || 0) / maxSessions) * 100);
                    return (
                      <div key={item.bucket || index} className="group flex-1 min-w-[5px] h-full flex flex-col justify-end relative">
                        <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 rounded-lg whitespace-nowrap text-[9px] text-white"
                          style={{ background: '#151a18', border: '1px solid rgba(255,255,255,0.12)' }}>
                          {formatBucket(item.bucket)} · {item.sessions} sesiones · {item.plays} plays
                        </div>
                        <div
                          className="w-full rounded-t-sm transition-colors"
                          style={{ height: `${height}%`, background: Number(item.errors || 0) > 0 ? '#f59e0b' : '#5DE0A3', opacity: 0.78 }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between mt-2 text-[9px] text-white/20">
                <span>{timeline[0] ? formatBucket(timeline[0].bucket) : '—'}</span>
                <span>{timeline.at(-1) ? formatBucket(timeline.at(-1).bucket) : '—'}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-black text-white">Conversión de eventos</h3>
              <p className="text-[11px] text-white/30 mt-0.5 mb-5">Embudo de vistas a tickets emitidos</p>
              <div className="space-y-4">
                {funnel.map((stage, index) => {
                  const count = Number(stage.count || 0);
                  const width = firstStage > 0 ? Math.max(3, (count / firstStage) * 100) : 0;
                  const previous = Number(funnel[index - 1]?.count || 0);
                  const stepRate = index === 0 ? 100 : previous > 0 ? (count / previous) * 100 : 0;
                  return (
                    <div key={stage.event_name}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-[11px] font-bold text-white/55">{stageLabel[stage.event_name] || stage.event_name}</span>
                        <span className="text-[11px] font-black text-white">{count.toLocaleString('es-CO')} <span className="text-white/25 font-medium">· {Math.round(stepRate)}%</span></span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${width}%`, background: '#5DE0A3' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-black text-white">Errores de checkout</h3>
              <p className="text-[11px] text-white/30 mt-0.5">Agrupados por evento, código y release</p>
            </div>
            {loading ? (
              <div className="px-5 pb-5 space-y-2">
                {[1, 2, 3].map(item => <div key={item} className="h-11 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
              </div>
            ) : checkoutErrors.length === 0 ? (
              <div className="px-5 pb-5 flex items-center gap-2 text-xs text-white/35">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Sin errores registrados en esta ventana
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {checkoutErrors.map((item, index) => (
                  <div key={`${item.event_id}-${item.error_code}-${item.release}-${index}`} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.error_code}</p>
                      <p className="text-[10px] text-white/28 truncate mt-0.5">Evento {item.event_id || 'sin identificar'} · {item.release}</p>
                    </div>
                    <span className="text-sm font-black text-amber-300 shrink-0">{Number(item.count || 0).toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SupportCasesSection() {
  const { toast } = useToast();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [saving, setSaving] = useState(null);

  const statuses = ['open', 'triage', 'waiting_user', 'waiting_internal', 'resolved', 'closed'];
  const priorities = ['low', 'normal', 'high', 'urgent'];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: casesError } = await supabase
      .from('support_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (casesError) {
      setError(casesError.code === '42P01'
        ? 'La migración de soporte aún no está aplicada en Supabase.'
        : casesError.message);
      setCases([]);
    } else {
      setCases(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCase = async (supportCase, patch) => {
    setSaving(supportCase.id);
    const { data, error: updateError } = await supabase.rpc('update_support_case', {
      p_case_id: supportCase.id,
      p_status: patch.status ?? null,
      p_priority: patch.priority ?? null,
      p_assigned_to: patch.assigned_to ?? null,
      p_internal_notes: patch.internal_notes ?? null,
    });

    if (updateError) {
      toast({
        variant: 'destructive',
        title: 'No se pudo actualizar el caso',
        description: updateError.code === '42883' ? 'Aplica la migración de gobernanza antes de gestionar soporte.' : updateError.message,
      });
    } else {
      setCases(prev => prev.map(item => item.id === supportCase.id ? data : item));
      toast({ title: 'Caso actualizado', description: `Estado: ${data.status}` });
    }
    setSaving(null);
  };

  const visibleCases = cases.filter(item => {
    if (filter === 'active') return !['resolved', 'closed'].includes(item.status);
    if (filter === 'urgent') return item.priority === 'urgent' && !['resolved', 'closed'].includes(item.status);
    if (filter === 'closed') return ['resolved', 'closed'].includes(item.status);
    return true;
  });

  const activeCount = cases.filter(item => !['resolved', 'closed'].includes(item.status)).length;
  const urgentCount = cases.filter(item => item.priority === 'urgent' && !['resolved', 'closed'].includes(item.status)).length;

  const priorityColor = (priority) => {
    if (priority === 'urgent') return '#ef4444';
    if (priority === 'high') return '#f59e0b';
    if (priority === 'low') return '#93c5fd';
    return '#d1d5db';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Soporte</h2>
          <p className="text-sm text-white/40 mt-0.5">Casos de usuarios, prioridad operativa y notas internas</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Activos" value={activeCount} icon={MessageCircle} loading={loading} sub="Abiertos o en espera" />
        <StatTile label="Urgentes" value={urgentCount} icon={AlertTriangle} loading={loading} sub="Sin resolver" />
        <StatTile label="Total" value={cases.length} icon={FileText} loading={loading} sub="Ultimos 100 casos" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: 'active', label: 'Activos' },
          { id: 'urgent', label: 'Urgentes' },
          { id: 'closed', label: 'Resueltos' },
          { id: 'all', label: 'Todos' },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: filter === item.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: filter === item.id ? 'white' : 'rgba(255,255,255,0.40)',
              border: `1px solid ${filter === item.id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-sm font-bold text-red-300">No se pudieron cargar casos</p>
          <p className="text-xs text-red-200/55 mt-1">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : visibleCases.length === 0 ? (
        <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <MessageCircle className="w-9 h-9 mx-auto mb-3 text-white/18" />
          <p className="text-sm font-bold text-white/60">Sin casos en este filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCases.map((supportCase) => (
            <div key={supportCase.id} className="p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-white truncate">{supportCase.subject}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.06)', color: priorityColor(supportCase.priority), border: '1px solid rgba(255,255,255,0.09)' }}>
                      {supportCase.priority}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white/45"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {supportCase.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/35 mt-1">
                    {supportCase.category}
                    {supportCase.created_at ? ` · ${new Date(supportCase.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                  {supportCase.description && (
                    <p className="text-xs text-white/45 mt-3 leading-relaxed">{supportCase.description}</p>
                  )}
                  <p className="text-[10px] font-mono text-white/22 mt-3">#{supportCase.id}</p>
                </div>

                <div className="w-full lg:w-72 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={supportCase.status}
                      onChange={e => updateCase(supportCase, { status: e.target.value })}
                      disabled={saving === supportCase.id}
                      className="h-10 px-3 rounded-xl text-xs font-bold text-white outline-none disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      {statuses.map(status => <option key={status} value={status} style={{ background: '#0b100f' }}>{status}</option>)}
                    </select>
                    <select
                      value={supportCase.priority}
                      onChange={e => updateCase(supportCase, { priority: e.target.value })}
                      disabled={saving === supportCase.id}
                      className="h-10 px-3 rounded-xl text-xs font-bold text-white outline-none disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      {priorities.map(priority => <option key={priority} value={priority} style={{ background: '#0b100f' }}>{priority}</option>)}
                    </select>
                  </div>
                  <textarea
                    defaultValue={supportCase.internal_notes || ''}
                    placeholder="Notas internas"
                    rows={3}
                    disabled={saving === supportCase.id}
                    onBlur={e => {
                      if (e.target.value !== (supportCase.internal_notes || '')) {
                        updateCase(supportCase, { internal_notes: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder:text-white/25 outline-none resize-none disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  {saving === supportCase.id && (
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Guardando
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── TICKETS SECTION ─────────────────────── */
function ManualTicketModal({ event, onClose, onIssued }) {
  const { toast } = useToast();
  const activeTicketTypes = Array.isArray(event.ticket_types)
    ? event.ticket_types.filter(type => type?.active !== false)
    : [];
  const ticketTypes = activeTicketTypes.length > 0
    ? activeTicketTypes
    : [{ name: 'General', price: event.price || 0, capacity: event.tickets_total || 1 }];
  const [email, setEmail] = useState('');
  const [ticketType, setTicketType] = useState(ticketTypes[0]?.name || 'General');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const issueTicket = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!email.trim() || !reference.trim() || !ticketType) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('issue-manual-ticket', {
      body: {
        eventId: event.id,
        userEmail: email.trim(),
        ticketType,
        paymentReference: reference.trim(),
      },
    });
    setSaving(false);

    if (error || !data?.ok) {
      toast({
        title: 'No se pudo generar el ticket',
        description: data?.error || error?.message || 'Verifica los datos e intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: data.alreadyProcessed ? 'Ticket ya registrado' : 'Ticket generado',
      description: data.emailSent
        ? `#${data.ticketNumber} · correo enviado`
        : `#${data.ticketNumber} · ${data.emailWarning || 'correo pendiente'}`,
      variant: data.emailSent ? undefined : 'destructive',
    });
    onIssued(data);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,5,5,0.84)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}>
      <form onSubmit={issueTicket} onClick={eventClick => eventClick.stopPropagation()}
        className="w-full max-w-md rounded-3xl p-6 space-y-5"
        style={{ background: '#0B1110', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 90px rgba(0,0,0,0.65)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-black text-white">Generar ticket manual</p>
            <p className="text-xs text-white/40 mt-1">{event.title} · transferencia bancaria verificada</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-4 h-4 text-white/55" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Correo del usuario</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="usuario@correo.com"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)' }} />
          <span className="block text-[10px] text-white/28">El correo debe pertenecer a una cuenta registrada en PolyFauna.</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tipo de entrada</span>
          <select value={ticketType} onChange={e => setTicketType(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none [color-scheme:dark]"
            style={{ background: '#111817', border: '1px solid rgba(255,255,255,0.11)' }}>
            {ticketTypes.map(type => (
              <option key={type.name} value={type.name} className="bg-[#111817] text-white">
                {type.name} · ${Number(type.price || 0).toLocaleString('es-CO')}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Referencia bancaria</span>
          <input required value={reference} onChange={e => setReference(e.target.value)}
            placeholder="Ej. TRX-458921"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)' }} />
        </label>

        <button type="submit" disabled={saving || !email.trim() || !reference.trim()}
          title={!email.trim() || !reference.trim() ? 'Completa correo y referencia bancaria para continuar' : undefined}
          className="w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#EAF0ED', color: '#07100D' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {saving ? 'Generando…' : 'Generar y enviar ticket'}
        </button>
      </form>
    </div>
  );
}

function CourtesyTicketModal({ event, onClose, onIssued, onConfigure }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const remaining = Math.max(0, (event.courtesy_limit || 0) - (event.courtesies_issued || 0));

  const issueCourtesy = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!email.trim() || remaining <= 0) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('issue-courtesy-ticket', {
      body: { eventId: event.id, userEmail: email.trim() },
    });
    setSaving(false);

    if (error || !data?.ok) {
      toast({
        title: 'No se pudo emitir la cortesía',
        description: data?.error || error?.message || 'Verifica el correo y los cupos disponibles.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: data.alreadyProcessed
        ? (data.pending ? 'Ya se había invitado a este correo' : 'El usuario ya tenía entrada')
        : (data.pending ? 'Cortesía enviada · pendiente de activación' : 'Cortesía enviada'),
      description: data.emailSent
        ? data.pending
          ? `#${data.ticketNumber} · el destinatario debe crear su cuenta para activarla`
          : `#${data.ticketNumber} · correo y Ticket Vault actualizados`
        : `#${data.ticketNumber} · ${data.notificationWarning || 'notificación pendiente'}`,
      variant: data.emailSent ? undefined : 'destructive',
    });
    onIssued(data);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,5,5,0.84)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}>
      <div onClick={eventClick => eventClick.stopPropagation()}
        className="w-full max-w-md rounded-3xl p-6 space-y-5"
        style={{ background: '#0B1110', border: '1px solid rgba(167,139,250,0.24)', boxShadow: '0 28px 90px rgba(0,0,0,0.65)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-black text-white">Crear cortesía</p>
            <p className="text-xs text-white/40 mt-1">{event.title}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-4 h-4 text-white/55" />
          </button>
        </div>

        <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.16)' }}>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35">Cupos disponibles</p>
            <p className="text-xl font-black text-violet-200 mt-1">{remaining}</p>
          </div>
          <Gift className="w-7 h-7 text-violet-300/70" />
        </div>

        {remaining > 0 ? (
          <form onSubmit={issueCourtesy} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Correo del usuario</span>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="usuario@correo.com"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)' }} />
              <span className="block text-[10px] text-white/28">
                Si el correo no tiene cuenta PolyFauna, igual recibe el QR por correo con invitación a registrarse para activarlo.
              </span>
            </label>
            <button type="submit" disabled={saving || !email.trim()}
              title={!email.trim() ? 'Ingresa el correo del destinatario para continuar' : undefined}
              className="w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: '#DDD6FE', color: '#21143F' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              {saving ? 'Enviando…' : 'Crear y enviar cortesía'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-white/45 leading-relaxed">
              Este evento no tiene cupos disponibles. Configura o aumenta los cupos de cortesía desde la edición del evento.
            </p>
            <button type="button" onClick={onConfigure}
              className="w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2"
              style={{ background: '#DDD6FE', color: '#21143F' }}>
              <CalendarDays className="w-4 h-4" />
              Configurar cupos en Eventos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsSection({ ownerId, onConfigureCourtesy }) {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [buyers, setBuyers] = useState({});
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [manualEvent, setManualEvent] = useState(null);
  const [courtesyEvent, setCourtesyEvent] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

  useEffect(() => {
    const EVENT_COLUMNS = 'id, title, date, venue, price, tickets_total, tickets_sold, ticket_types, courtesy_limit, courtesies_issued, tickets_voided';
    const load = async () => {
      // Propios en una consulta, co-promovidos en otra — sin filtro .or() armado a mano.
      const ownEventsQuery = ownerId
        ? supabase.from('events').select(EVENT_COLUMNS).eq('owner_id', ownerId).order('date', { ascending: true })
        : supabase.from('events').select(EVENT_COLUMNS).order('date', { ascending: true });

      const [{ data: ownEvents }, { data: linked }] = await Promise.all([
        ownEventsQuery,
        ownerId
          ? supabase.from('event_co_promoters').select('event_id').eq('promoter_id', ownerId).eq('status', 'active')
          : Promise.resolve({ data: [] }),
      ]);

      const byId = new Map((ownEvents || []).map(event => [event.id, event]));
      const linkedIds = (linked || []).map(row => row.event_id).filter(id => !byId.has(id));
      if (linkedIds.length) {
        const { data: coPromotedEvents } = await supabase.from('events').select(EVENT_COLUMNS).in('id', linkedIds);
        (coPromotedEvents || []).forEach(event => byId.set(event.id, event));
      }

      setEvents([...byId.values()].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setLoading(false);
    };
    load();
  }, [ownerId]);

  const loadBuyers = async (eventId) => {
    if (buyers[eventId]) { setExpanded(eventId); return; }
    setLoadingBuyers(true);
    const { data } = await supabase.rpc('get_event_attendees', { p_event_id: eventId });
    setBuyers(b => ({ ...b, [eventId]: data || [] }));
    setExpanded(eventId);
    setLoadingBuyers(false);
  };

  const refreshBuyers = async (eventId) => {
    const { data } = await supabase.rpc('get_event_attendees', { p_event_id: eventId });
    setBuyers(b => ({ ...b, [eventId]: data || [] }));
  };

  // Solo tickets manuales/cortesia (sin referencia Wompi real) pueden
  // anularse o transferirse desde aqui; los pagados por pasarela usan
  // el flujo de devoluciones.
  const isVoidable = (t) => !t.wompi_reference || t.wompi_reference.startsWith('BANK-');

  const submitVoid = async (reason) => {
    const { eventId, ticket: t } = voidTarget;
    try {
      const { data, error } = await supabase.functions.invoke('void-ticket', {
        body: { ticketId: t.ticket_id, reason },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible anular el ticket');
      toast({ title: 'Ticket anulado', description: `#${data.ticketNumber} · total anulados: ${data.ticketsVoidedTotal}` });
      await refreshBuyers(eventId);
      setEvents(current => current.map(item => item.id === eventId
        ? { ...item, tickets_sold: Math.max(0, (item.tickets_sold || 0) - 1), tickets_voided: data.ticketsVoidedTotal }
        : item));
      setVoidTarget(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const submitTransfer = async (newEmail) => {
    const { eventId, ticket: t } = transferTarget;
    try {
      const { data, error } = await supabase.functions.invoke('transfer-ticket', {
        body: { ticketId: t.ticket_id, newEmail },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible transferir el ticket');
      toast({
        title: 'Ticket transferido',
        description: data.pending
          ? `#${data.ticketNumber} · el destinatario debe crear su cuenta para activarlo`
          : `#${data.ticketNumber} · notificado por correo${data.notificationSent ? ' y dentro de la plataforma' : ''}`,
      });
      await refreshBuyers(eventId);
      setTransferTarget(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const toggle = (id) => expanded === id ? setExpanded(null) : loadBuyers(id);
  const handleManualIssued = (result) => {
    setEvents(current => current.map(item => item.id === manualEvent?.id
      ? { ...item, tickets_sold: (item.tickets_sold || 0) + (result?.alreadyProcessed ? 0 : 1) }
      : item));
    setBuyers(current => {
      const next = { ...current };
      if (manualEvent?.id) delete next[manualEvent.id];
      return next;
    });
    setExpanded(null);
    setManualEvent(null);
  };
  const handleCourtesyIssued = (result) => {
    setEvents(current => current.map(item => item.id === courtesyEvent?.id
      ? {
          ...item,
          tickets_sold: (item.tickets_sold || 0) + (result?.alreadyProcessed ? 0 : 1),
          courtesies_issued: (item.courtesies_issued || 0) + (result?.alreadyProcessed ? 0 : 1),
        }
      : item));
    setBuyers(current => {
      const next = { ...current };
      if (courtesyEvent?.id) delete next[courtesyEvent.id];
      return next;
    });
    setExpanded(null);
    setCourtesyEvent(null);
  };

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {manualEvent && (
          <ManualTicketModal
            event={manualEvent}
            onClose={() => setManualEvent(null)}
            onIssued={handleManualIssued}
          />
        )}
        {courtesyEvent && (
          <CourtesyTicketModal
            event={courtesyEvent}
            onClose={() => setCourtesyEvent(null)}
            onIssued={handleCourtesyIssued}
            onConfigure={() => {
              setCourtesyEvent(null);
              onConfigureCourtesy?.();
            }}
          />
        )}
        {transferTarget && (
          <TransferTicketModal
            ticket={transferTarget.ticket}
            eventTitle={events.find(e => e.id === transferTarget.eventId)?.title || ''}
            onClose={() => setTransferTarget(null)}
            onSubmit={submitTransfer}
          />
        )}
        {voidTarget && (
          <VoidTicketModal
            ticket={voidTarget.ticket}
            eventTitle={events.find(e => e.id === voidTarget.eventId)?.title || ''}
            onClose={() => setVoidTarget(null)}
            onSubmit={submitVoid}
          />
        )}
      </AnimatePresence>
      <div>
        <h2 className="text-lg font-black text-white">Gestión de Tickets</h2>
        <p className="text-sm text-white/40 mt-0.5">Ventas, cortesías y asistentes por evento</p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-white/30">No hay eventos creados aún.</p>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const sold = ev.tickets_sold || 0;
            const total = ev.tickets_total || 0;
            const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
            // Las cortesías no generan ingreso real, se descuentan del estimado.
            const revenue = Math.max(0, sold - (ev.courtesies_issued || 0)) * (ev.price || 0);
            const isOpen = expanded === ev.id;

            return (
              <div key={ev.id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                  type="button"
                  onClick={() => toggle(ev.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left"
                >
                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{ev.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      {ev.date && <span>{new Date(ev.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      {ev.venue && <span>{ev.venue}</span>}
                    </div>
                  </div>

                  {/* Ticket bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-32">
                    <div className="flex items-center justify-between w-full text-[10px]">
                      <span className="text-white/40">{sold}/{total || '∞'}</span>
                      <span className="font-bold" style={{ color: pct > 80 ? '#ef4444' : pct > 50 ? '#F59E0B' : '#22c55e' }}>{pct}%</span>
                    </div>
                    {total > 0 && (
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#F59E0B' : '#22c55e' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: 'rgba(255,255,255,0.85)' }}>${revenue.toLocaleString('es-CO')}</p>
                    <p className="text-[10px] text-white/30">${(ev.price || 0).toLocaleString('es-CO')} c/u</p>
                  </div>

                  <ChevronRight
                    className="w-4 h-4 text-white/30 shrink-0 transition-transform"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="grid sm:grid-cols-2 gap-3 mb-4">
                          <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                            style={{ background: 'rgba(32,199,232,0.05)', border: '1px solid rgba(32,199,232,0.12)' }}>
                            <div>
                              <p className="text-xs font-bold text-white/75">Emisión manual</p>
                              <p className="text-[10px] text-white/30">Transferencia bancaria verificada</p>
                            </div>
                            <button type="button" onClick={() => setManualEvent(ev)}
                              className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black"
                              style={{ background: 'rgba(32,199,232,0.12)', color: '#8BEAFF', border: '1px solid rgba(32,199,232,0.25)' }}>
                              <UserPlus className="w-3.5 h-3.5" />
                              Generar
                            </button>
                          </div>
                          <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                            style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.14)' }}>
                            <div>
                              <p className="text-xs font-bold text-white/75">Cortesías</p>
                              <p className="text-[10px] text-white/30">
                                {ev.courtesies_issued || 0}/{ev.courtesy_limit || 0} emitidas
                              </p>
                            </div>
                            <button type="button" onClick={() => setCourtesyEvent(ev)}
                              className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black"
                              style={{ background: 'rgba(167,139,250,0.12)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.25)' }}>
                              <Gift className="w-3.5 h-3.5" />
                              Crear
                            </button>
                          </div>
                        </div>
                        {ev.tickets_voided > 0 && (
                          <p className="text-[10px] text-white/30 mb-3">
                            <span className="font-bold text-white/45">{ev.tickets_voided}</span> {ev.tickets_voided === 1 ? 'ticket anulado' : 'tickets anulados'} en este evento
                          </p>
                        )}
                        {loadingBuyers ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                          </div>
                        ) : (buyers[ev.id] || []).length === 0 ? (
                          <div className="flex items-center gap-2 py-3">
                            <Users className="w-4 h-4 text-white/20" />
                            <p className="text-xs text-white/30">Sin compradores aún</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Compradores</p>
                            {(buyers[ev.id] || []).map((t) => (
                              <div key={t.ticket_id} className="flex items-center justify-between flex-wrap gap-2 py-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">
                                    {t.display_name || t.email || 'Usuario'}
                                  </p>
                                  <p className="text-[10px] font-mono text-white/30 truncate">#{t.ticket_number} · {t.ticket_type}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                                    style={{
                                      background: t.ticket_status === 'used'
                                        ? 'rgba(239,68,68,0.1)'
                                        : t.ticket_status === 'pending_registration'
                                          ? 'rgba(167,139,250,0.14)'
                                          : t.ticket_status === 'cancelled'
                                            ? 'rgba(255,255,255,0.06)'
                                            : 'rgba(34,197,94,0.1)',
                                      color: t.ticket_status === 'used'
                                        ? '#ef4444'
                                        : t.ticket_status === 'pending_registration'
                                          ? '#A78BFA'
                                          : t.ticket_status === 'cancelled'
                                            ? 'rgba(255,255,255,0.3)'
                                            : '#22c55e',
                                    }}
                                  >
                                    {t.ticket_status === 'used' ? 'Usado'
                                      : t.ticket_status === 'pending_registration' ? 'Pendiente'
                                        : t.ticket_status === 'cancelled' ? 'Anulado' : 'Activo'}
                                  </span>
                                  {isVoidable(t) && ['valid', 'pending_registration'].includes(t.ticket_status) && (
                                    <>
                                      <button type="button" onClick={() => setTransferTarget({ eventId: ev.id, ticket: t })}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/70"
                                        title="Transferir a otro correo" aria-label="Transferir a otro correo">
                                        <Mail className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={() => setVoidTarget({ eventId: ev.id, ticket: t })}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-red-400"
                                        title="Anular ticket" aria-label="Anular ticket">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── WALLET SECTION ─────────────────────── */
const BANKS = [
  'Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Popular',
  'Banco de Occidente', 'Nequi', 'Daviplata', 'Otro',
];

function WalletSection() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const userId = currentUser?.id;

  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [showRequest, setShowRequest] = useState(false);

  const [account, setAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({
    account_holder: '', document_type: 'CC', document_number: '',
    bank_name: 'Bancolombia', account_type: 'ahorros', account_number: '',
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [walletRes, acctRes, txRes, payoutRes] = await Promise.all([
      supabase.rpc('get_or_create_wallet', { p_user_id: userId }),
      supabase.from('promoter_accounts').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('transactions')
        .select('id, amount_total, promoter_amount, payment_method, status, paid_at, events(title)')
        .eq('promoter_id', userId)
        .eq('status', 'approved')
        .order('paid_at', { ascending: false })
        .limit(50),
      supabase.from('payouts')
        .select('id, amount, status, requested_at, processed_at, transfer_reference')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(5),
    ]);
    const payoutRows = payoutRes.data || [];
    const reserved = payoutRows
      .filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    setWallet(walletRes.data ? {
      ...walletRes.data,
      balance_available: Math.max(0, Number(walletRes.data.balance_available || 0) - reserved),
    } : null);
    if (acctRes.data) {
      setAccount(acctRes.data);
      setAccountForm({
        account_holder: acctRes.data.account_holder || '',
        document_type: acctRes.data.document_type || 'CC',
        document_number: acctRes.data.document_number || '',
        bank_name: acctRes.data.bank_name || 'Bancolombia',
        account_type: acctRes.data.account_type || 'ahorros',
        account_number: acctRes.data.account_number || '',
      });
    }
    setTxs(txRes.data || []);
    setPayouts(payoutRows);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleRequestPayout = async () => {
    const amount = parseInt(requestAmount.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) return;
    if (amount > (wallet?.balance_available || 0)) {
      toast({ title: 'Monto inválido', description: 'El monto supera tu saldo disponible.', variant: 'destructive' });
      return;
    }
    setRequesting(true);
    const { data: payoutId, error } = await supabase.rpc('request_payout', { p_amount: amount });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Solicitud enviada', description: 'El equipo procesará tu retiro en 1-2 días hábiles.' });
      setShowRequest(false);
      setRequestAmount('');
      setWallet(w => ({ ...w, balance_available: (w?.balance_available || 0) - amount }));
      setPayouts(p => [{ id: payoutId, amount, status: 'pending', requested_at: new Date().toISOString() }, ...p]);
    }
    setRequesting(false);
  };

  const setAccountField = (k, v) => setAccountForm(p => ({ ...p, [k]: v }));

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.account_holder || !accountForm.account_number || !accountForm.document_number) return;
    setSavingAccount(true);
    const payload = { ...accountForm, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = account
      ? await supabase.from('promoter_accounts').update(payload).eq('user_id', userId)
      : await supabase.from('promoter_accounts').insert(payload);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: account ? 'Cuenta actualizada' : 'Cuenta registrada', description: 'Tus datos bancarios han sido guardados.' });
      setAccount({ ...account, ...payload });
      setEditingAccount(false);
    }
    setSavingAccount(false);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  const available = wallet?.balance_available || 0;
  const pending    = wallet?.balance_pending   || 0;
  const total      = wallet?.total_earned      || 0;
  const inputStyle = { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Wallet</h2>
        <p className="text-sm text-white/40 mt-0.5">Tu saldo por ventas de tickets y solicitudes de retiro</p>
      </div>

      {/* Balance hero */}
      <div className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'linear-gradient(135deg, rgba(93,224,163,0.15), rgba(10,15,14,0.95))', border: '1px solid rgba(93,224,163,0.2)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(93,224,163,0.15), transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="grid grid-cols-3 gap-4 relative z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Disponible</p>
            <p className="text-2xl font-black text-white">${available.toLocaleString('es-CO')}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">En espera</p>
            <p className="text-2xl font-black text-white/60">${pending.toLocaleString('es-CO')}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Total ganado</p>
            <p className="text-2xl font-black text-white/40">${total.toLocaleString('es-CO')}</p>
          </div>
        </div>
        {pending > 0 && (
          <p className="text-[11px] text-white/30 mt-3 relative z-10">El saldo en espera se libera 48h después de cada evento.</p>
        )}
      </div>

      {/* Solicitar retiro */}
      {available > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(93,224,163,0.15)' }}>
          {!account ? (
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs text-white/50">Registra tu cuenta bancaria abajo para poder solicitar retiros.</p>
            </div>
          ) : showRequest ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-white">Solicitar retiro</p>
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Monto (COP)</label>
                <input type="number" value={requestAmount} onChange={e => setRequestAmount(e.target.value)}
                  placeholder="0" max={available}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={inputStyle} />
                <p className="text-[10px] text-white/30 mt-1">Disponible: ${available.toLocaleString('es-CO')} COP</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowRequest(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleRequestPayout} disabled={requesting}
                  className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'rgba(255,255,255,0.85)', color: '#080B14' }}>
                  {requesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                  Solicitar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowRequest(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(93,224,163,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(93,224,163,0.2)' }}>
              <ArrowUpRight className="w-4 h-4" />
              Solicitar Retiro · ${available.toLocaleString('es-CO')} disponibles
            </button>
          )}
        </div>
      )}

      {/* Retiros solicitados */}
      {payouts.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-5 pt-5 pb-2">Retiros solicitados</p>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {payouts.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">${p.amount.toLocaleString('es-CO')} COP</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {new Date(p.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    {p.transfer_reference && ` · Ref: ${p.transfer_reference}`}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                  background: p.status === 'completed' ? 'rgba(34,197,94,0.1)' : p.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                  color: p.status === 'completed' ? '#22c55e' : p.status === 'rejected' ? '#ef4444' : '#F59E0B',
                }}>
                  {p.status === 'completed' ? 'Completado' : p.status === 'rejected' ? 'Rechazado' : p.status === 'processing' ? 'En proceso' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cuenta bancaria */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Cuenta bancaria</h3>
          {account && !editingAccount && (
            <button type="button" onClick={() => setEditingAccount(true)} className="text-xs font-bold text-white/50 hover:text-white/80">
              Editar
            </button>
          )}
        </div>

        <div className="px-5 pb-5 space-y-4">
          {account && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={
              account.verified
                ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }
                : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }
            }>
              {account.verified
                ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#22c55e' }} />
                : <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />}
              <p className="text-xs text-white/60">
                {account.verified ? 'Cuenta bancaria verificada por el equipo PolyFauna.' : 'Tu cuenta está pendiente de verificación. El equipo la revisará en 1-2 días hábiles.'}
              </p>
            </div>
          )}

          {account && !editingAccount ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[11px] text-white/30">Titular</p><p className="text-white/80">{account.account_holder}</p></div>
              <div><p className="text-[11px] text-white/30">Documento</p><p className="text-white/80">{account.document_type} {account.document_number}</p></div>
              <div><p className="text-[11px] text-white/30">Banco</p><p className="text-white/80">{account.bank_name}</p></div>
              <div><p className="text-[11px] text-white/30">Cuenta</p><p className="text-white/80">{account.account_type} · {account.account_number}</p></div>
            </div>
          ) : (
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Nombre completo del titular *</label>
                  <input type="text" value={accountForm.account_holder} onChange={e => setAccountField('account_holder', e.target.value)}
                    placeholder="Nombre Apellido" className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Tipo de documento</label>
                  <select value={accountForm.document_type} onChange={e => setAccountField('document_type', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                    {['CC', 'NIT', 'CE', 'Pasaporte'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Número de documento *</label>
                  <input type="text" value={accountForm.document_number} onChange={e => setAccountField('document_number', e.target.value)}
                    placeholder="1234567890" className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Banco</label>
                  <select value={accountForm.bank_name} onChange={e => setAccountField('bank_name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Tipo de cuenta</label>
                  <select value={accountForm.account_type} onChange={e => setAccountField('account_type', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                    <option value="ahorros">Ahorros</option>
                    <option value="corriente">Corriente</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Número de cuenta *</label>
                  <input type="text" value={accountForm.account_number} onChange={e => setAccountField('account_number', e.target.value)}
                    placeholder="0000000000" className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none" style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-2">
                {account && (
                  <button type="button" onClick={() => setEditingAccount(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={savingAccount || !accountForm.account_holder || !accountForm.account_number || !accountForm.document_number}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#06090A' }}>
                  {savingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {savingAccount ? 'Guardando…' : account ? 'Actualizar cuenta' : 'Registrar cuenta'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Pagos recibidos */}
      {txs.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-5 pt-5 pb-2">Pagos recibidos</p>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {txs.map(tx => (
              <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{tx.events?.title || 'Evento'}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {tx.payment_method || 'Pago'}
                    {tx.paid_at && ` · ${new Date(tx.paid_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>+${tx.promoter_amount.toLocaleString('es-CO')}</p>
                  <p className="text-[10px] text-white/30">de ${tx.amount_total.toLocaleString('es-CO')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {txs.length === 0 && payouts.length === 0 && available === 0 && pending === 0 && (
        <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Banknote className="w-8 h-8 mx-auto mb-3 text-white/20" />
          <p className="text-sm font-black text-white">Aún no hay pagos registrados</p>
          <p className="text-xs text-white/35 mt-1">Cuando vendas tickets, tu saldo aparecerá aquí.</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── PAYOUTS SECTION ─────────────────────── */
function PayoutsSection() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [refInput, setRefInput] = useState({});
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payouts')
      .select('*, profiles:user_id(display_name, email), promoter_accounts:user_id(bank_name, account_type, account_number, account_holder)')
      .order('requested_at', { ascending: false });
    setPayouts(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (payout) => {
    const ref = refInput[payout.id]?.trim();
    if (!ref) {
      toast({ variant: 'destructive', title: 'Referencia requerida', description: 'Ingresa la referencia bancaria de la transferencia.' });
      return;
    }
    setProcessing(payout.id);
    const { error } = await supabase.rpc('approve_payout', {
      p_payout_id: payout.id,
      p_transfer_reference: ref,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      setPayouts(prev => prev.map(p => p.id === payout.id
        ? { ...p, status: 'completed', transfer_reference: ref, processed_at: new Date().toISOString() }
        : p
      ));
    }
    setProcessing(null);
  };

  const handleReject = async (payout) => {
    if (!(await confirm({
      title: 'Rechazar retiro',
      message: `Se rechazará la solicitud de retiro por $${payout.amount.toLocaleString('es-CO')} COP.`,
      confirmLabel: 'Rechazar retiro',
      variant: 'destructive',
    }))) return;
    setProcessing(payout.id);
    const { error } = await supabase.from('payouts')
      .update({ status: 'rejected', processed_at: new Date().toISOString() })
      .eq('id', payout.id);
    if (!error) {
      setPayouts(prev => prev.map(p => p.id === payout.id ? { ...p, status: 'rejected' } : p));
    }
    setProcessing(null);
  };

  const pending = payouts.filter(p => p.status === 'pending');
  const done    = payouts.filter(p => p.status !== 'pending');

  return (
    <>
    {ConfirmDialogElement}
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Retiros</h2>
          <p className="text-sm text-white/40 mt-0.5">Solicitudes de retiro de promotores</p>
        </div>
        <button type="button" onClick={load}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : (
        <>
          {pending.length === 0 && done.length === 0 && (
            <p className="text-sm text-white/30 text-center py-8">Sin solicitudes de retiro.</p>
          )}

          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Pendientes ({pending.length})</p>
              {pending.map(p => (
                <div key={p.id} className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{p.profiles?.display_name || p.profiles?.email || 'Usuario'}</p>
                      <p className="text-xs text-white/40">{p.profiles?.email}</p>
                    </div>
                    <p className="text-lg font-black shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}>${p.amount.toLocaleString('es-CO')} COP</p>
                  </div>
                  {p.account_snapshot && (
                    <div className="text-[11px] text-white/40 space-y-0.5">
                      <p>{p.account_snapshot.account_holder} · {p.account_snapshot.document_type}: {p.account_snapshot.document_number}</p>
                      <p>{p.account_snapshot.bank_name} · {p.account_snapshot.account_type} · {p.account_snapshot.account_number}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-white/30">
                    Solicitado: {new Date(p.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Referencia bancaria de la transferencia"
                      value={refInput[p.id] || ''}
                      onChange={e => setRefInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-transparent border outline-none"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                    />
                    <button type="button" onClick={() => handleReject(p)} disabled={processing === p.id}
                      className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      Rechazar
                    </button>
                    <button type="button" onClick={() => handleApprove(p)} disabled={processing === p.id}
                      className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.9)', color: '#06090A' }}>
                      {processing === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Marcar pagado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Historial</p>
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {done.map((p, i) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{p.profiles?.display_name || p.profiles?.email}</p>
                      <p className="text-[11px] text-white/30">
                        ${p.amount.toLocaleString('es-CO')} COP
                        {p.transfer_reference && ` · Ref: ${p.transfer_reference}`}
                        {p.processed_at && ` · ${new Date(p.processed_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: p.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color:      p.status === 'completed' ? '#22c55e'             : '#ef4444',
                      }}>
                      {p.status === 'completed' ? 'Pagado' : 'Rechazado'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

function RefundRequestsSection({ ownerId }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('ticket_refund_requests')
      .select('*, events(title, date, venue, owner_id), user_tickets(ticket_number, status)')
      .order('created_at', { ascending: false });
    if (ownerId) query = query.eq('events.owner_id', ownerId);

    const { data, error: requestError } = await query;
    if (requestError) {
      setError(requestError.code === '42P01' ? 'La tabla de devoluciones aún no está aplicada en Supabase.' : requestError.message);
      setRequests([]);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const updateRequest = async (request, patch) => {
    const { data, error: updateError } = await supabase
      .from('ticket_refund_requests')
      .update({
        ...patch,
        reviewed_by: currentUser?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
      .select('*, events(title, date, venue, owner_id), user_tickets(ticket_number, status)')
      .single();

    if (updateError) {
      toast({ variant: 'destructive', title: 'No se pudo actualizar', description: updateError.message });
      return;
    }

    setRequests(prev => prev.map(item => item.id === request.id ? data : item));
    if (patch.status && ['approved', 'rejected', 'refunded', 'cancelled'].includes(patch.status)) {
      const label = {
        approved: 'aprobada',
        rejected: 'rechazada',
        refunded: 'reembolsada',
        cancelled: 'cancelada',
      }[patch.status];
      supabase.functions.invoke('send-push', {
        body: {
          userId: data.user_id,
          title: 'Actualización de devolución',
          body: `Tu solicitud de devolución fue ${label}${data.events?.title ? ` · ${data.events.title}` : ''}.`,
          url: `${window.location.origin}/?section=tickets`,
        },
      }).catch(() => {});
    }
    toast({ title: 'Solicitud actualizada', description: `Estado: ${data.status}` });
  };

  const statuses = ['requested', 'reviewing', 'approved', 'rejected', 'processing', 'refunded', 'cancelled'];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-white">Devoluciones</h2>
        <p className="text-sm text-white/40 mt-0.5">Solicitudes de reembolso para revisión operativa</p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-white/35" />
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-sm font-bold text-red-300">No se pudieron cargar devoluciones</p>
          <p className="text-xs text-red-200/55 mt-1">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-white/18" />
          <p className="text-sm font-bold text-white/60">Sin solicitudes por ahora</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="p-4 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-black text-white truncate">{request.events?.title || 'Evento'}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(96,165,250,0.10)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.18)' }}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/35">
                    Ticket #{request.user_tickets?.ticket_number?.slice(0, 16) || request.ticket_id.slice(0, 8)}
                    {request.events?.venue ? ` · ${request.events.venue}` : ''}
                  </p>
                  <p className="text-xs text-white/45 mt-2">Motivo: {request.reason}</p>
                  {request.details && <p className="text-xs text-white/32 mt-1 leading-relaxed">{request.details}</p>}
                </div>

                <div className="w-full sm:w-56 space-y-2">
                  <select
                    value={request.status}
                    onChange={e => updateRequest(request, { status: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl text-xs font-bold text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    {statuses.map(status => <option key={status} value={status} style={{ background: '#0b100f' }}>{status}</option>)}
                  </select>
                  <textarea
                    defaultValue={request.admin_notes || ''}
                    placeholder="Notas internas"
                    rows={2}
                    onBlur={e => {
                      if (e.target.value !== (request.admin_notes || '')) updateRequest(request, { admin_notes: e.target.value || null });
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder:text-white/25 outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── QR SECTION WRAPPER ─────────────────────── */
function QRSection({ ownerId }) {
  const navigate = useNavigate();
  const [scanKey, setScanKey] = useState(0);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  useEffect(() => {
    let query = supabase.from('events').select('id, title').order('date', { ascending: true });
    if (ownerId) query = query.eq('owner_id', ownerId);
    query.then(({ data }) => setEvents(data || []));
  }, [ownerId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Lector QR</h2>
        <p className="text-sm text-white/40 mt-0.5">Valida entradas en la puerta del evento</p>
      </div>

      {/* Event selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedEvent}
          onChange={e => setSelectedEvent(e.target.value)}
          className="text-sm px-4 py-2.5 rounded-xl outline-none min-w-52"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        >
          <option value="">Todos los eventos</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setScanKey(k => k + 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reiniciar cámara
        </button>
        {selectedEvent && (
          <button type="button" onClick={() => navigate(`/validate?event=${selectedEvent}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black"
            style={{ background: '#22c55e', color: '#052010' }}>
            <WifiOff className="w-3.5 h-3.5" />
            Abrir lector offline
          </button>
        )}
      </div>

      {/* Scanner */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <QRScannerWidget key={`${scanKey}-${selectedEvent}`} scanKey={scanKey} eventId={selectedEvent || null} />
      </div>

      {/* Instructions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: QrCode, title: 'Escanea el QR', desc: 'Apunta la cámara al código QR del ticket del asistente' },
          { icon: CheckCircle, title: 'Validación instantánea', desc: 'El sistema verifica en tiempo real si el ticket es válido y no ha sido usado' },
          { icon: ScanLine, title: 'Control de acceso', desc: 'Un ticket solo puede usarse una vez. Intento duplicado = rechazo automático' },
        ].map(({ icon: Icon, title, desc }, i) => (
          <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Icon className="w-4 h-4 mb-2" style={{ color: '#22c55e' }} />
            <p className="text-xs font-bold text-white mb-1">{title}</p>
            <p className="text-[11px] text-white/35 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── SIDEBAR ─────────────────────── */
function Sidebar({ active, setActive, onGoHome, mobileOpen, setMobileOpen, groups = NAV_GROUPS, panelLabel = 'Admin Panel' }) {
  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-xs font-black text-white tracking-widest uppercase">PolyFauna</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Shield className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.85)' }} />
            <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{panelLabel}</p>
          </div>
        </div>
        {mobileOpen !== undefined && (
          <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 px-3 mb-2">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setActive(item.id); setMobileOpen?.(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.40)',
                    }}
                    onMouseEnter={!isActive ? e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)') : undefined}
                    onMouseLeave={!isActive ? e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)') : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-white/80" />
                    )}
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white/90' : 'text-white/30'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Go home */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          type="button"
          onClick={onGoHome}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white/50 hover:text-white transition-colors group"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <Home className="w-4 h-4 shrink-0" />
          Ir a Inicio
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full" style={{ background: 'rgba(6,10,9,0.98)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {content}
      </aside>

      {/* Mobile navigation: tactile bottom sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] lg:hidden"
              style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 0.9 }}
              // z-[70]: por encima del GlobalPlayer (z-50), que vive fuera de
              // esta ruta y si no quedaría flotando sobre este panel.
              className="fixed left-0 right-0 bottom-0 z-[70] lg:hidden flex flex-col overflow-hidden"
              style={{
                maxHeight: '88dvh',
                background: '#0A0D0C',
                border: '1px solid rgba(255,255,255,0.10)',
                borderBottom: 0,
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -24px 70px rgba(0,0,0,0.55)',
              }}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.16)' }} />
              </div>

              <div className="flex items-center justify-between px-5 py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: '#171B19', border: '1px solid #252A27' }}>
                    <Shield className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">{panelLabel}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Polyfauna · Operación</p>
                  </div>
                </div>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"
                  className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: '#171B19', border: '1px solid #252A27' }}>
                  <X className="w-5 h-5 text-white/55" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                {groups.map(group => (
                  <div key={group.label} className="mb-5 last:mb-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 px-1 mb-2.5">{group.label}</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {group.items.map(item => {
                        const isActive = active === item.id;
                        return (
                          <button key={item.id} type="button"
                            onClick={() => { setActive(item.id); setMobileOpen(false); }}
                            aria-current={isActive ? 'page' : undefined}
                            className="relative min-h-[84px] px-2 py-3 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-[0.94] transition-transform"
                            style={{
                              background: isActive ? '#ECECEC' : '#141816',
                              border: `1px solid ${isActive ? '#ECECEC' : '#232825'}`,
                              color: isActive ? '#090C0B' : '#A5AAA7',
                            }}>
                            <item.icon className="w-5 h-5" />
                            <span className="text-[10px] font-bold leading-tight text-center">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button type="button" onClick={onGoHome}
                  className="w-full min-h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-white/60 active:scale-[0.98]"
                  style={{ background: '#141816', border: '1px solid #232825' }}>
                  <Home className="w-4 h-4" /> Ir a la plataforma
                </button>
              </div>
              <div className="shrink-0" style={{ height: 'env(safe-area-inset-bottom, 12px)' }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileOperationsDock({ active, setActive, openMenu, allowedIds }) {
  const quickItems = NAV_GROUPS.flatMap(group => group.items)
    .filter(item => ['dashboard', 'events', 'tickets', 'qr', 'podcasts'].includes(item.id) && allowedIds.includes(item.id))
    .slice(0, 4);
  const moreActive = !quickItems.some(item => item.id === active);
  return (
    <nav className="fixed left-0 right-0 bottom-0 z-30 lg:hidden" aria-label="Navegación rápida del panel"
      style={{
        background: 'rgba(8,11,10,0.96)',
        borderTop: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(18px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
      <div className="grid grid-cols-5 px-2 pt-1.5">
        {quickItems.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setActive(item.id)} aria-current={isActive ? 'page' : undefined}
              className="min-h-[58px] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95"
              style={{ color: isActive ? '#ECECEC' : '#555C58' }}>
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-bold">{item.label === 'Dashboard' ? 'Inicio' : item.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={openMenu} className="min-h-[58px] rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95"
          style={{ color: moreActive ? '#ECECEC' : '#555C58' }}>
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-bold">Menú</span>
        </button>
      </div>
    </nav>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
const AdminDashboard = () => {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAdmin = userRole === 'admin';
  const canManageEvents = isAdmin || userRole === 'promoter' || userRole === 'club';
  const canManagePodcasts = isAdmin || userRole === 'artist' || userRole === 'club' || userRole === 'sello'
    || (userRole === 'promoter' && currentUser?.organizer_type === 'collective');
  const allowedSectionIds = [
    'dashboard',
    ...(canManageEvents ? ['events', 'tickets', 'refunds', 'qr', 'wallet'] : []),
    ...(canManagePodcasts ? ['podcasts', 'albums'] : []),
  ];
  const allNavItems = NAV_GROUPS.flatMap(group => group.items);
  const visibleGroups = isAdmin ? NAV_GROUPS : [{
    label: 'Operación',
    items: allNavItems.filter(item => allowedSectionIds.includes(item.id)),
  }];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':   return (!isAdmin && canManagePodcasts && !canManageEvents)
        ? <ContentDashboardSection ownerId={currentUser?.id} />
        : <DashboardSection ownerId={isAdmin ? null : currentUser?.id} />;
      case 'analytics':   return isAdmin ? <UsageMetricsSection /> : <DashboardSection ownerId={currentUser?.id} />;
      case 'operations':  return isAdmin ? <OperationalSection /> : <DashboardSection ownerId={currentUser?.id} />;
      case 'support':     return isAdmin ? <SupportCasesSection /> : <DashboardSection ownerId={currentUser?.id} />;
      case 'events':      return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Eventos</h2><p className="text-sm text-white/40 mt-0.5">Crear y gestionar eventos, artistas y tipos de entrada</p></div><EventManager ownerId={isAdmin ? null : currentUser?.id} isAdmin={isAdmin} /></div>;
      case 'tickets':     return <TicketsSection ownerId={isAdmin ? null : currentUser?.id} onConfigureCourtesy={() => setActiveSection('events')} />;
      case 'refunds':     return <RefundRequestsSection ownerId={isAdmin ? null : currentUser?.id} />;
      case 'qr':          return <QRSection ownerId={isAdmin ? null : currentUser?.id} />;
      case 'wallet':      return <WalletSection />;
      case 'payouts':     return <PayoutsSection />;
      case 'podcasts':    return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Podcasts</h2><p className="text-sm text-white/40 mt-0.5">Gestionar episodios</p></div><PodcastManager ownerId={isAdmin ? null : currentUser?.id} /></div>;
      case 'blog':        return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Blog</h2><p className="text-sm text-white/40 mt-0.5">Artículos y publicaciones</p></div><BlogManager /></div>;
      case 'interviews':  return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Interviews</h2><p className="text-sm text-white/40 mt-0.5">Entrevistas</p></div><InterviewManager /></div>;
      case 'artists':     return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Artistas</h2><p className="text-sm text-white/40 mt-0.5">Perfiles de artistas y sellos</p></div><ArtistManager /></div>;
      case 'albums':      return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Álbumes</h2><p className="text-sm text-white/40 mt-0.5">Discografía y tracks</p></div><AlbumManager ownerId={isAdmin ? null : currentUser?.id} /></div>;
      case 'users':       return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Usuarios</h2><p className="text-sm text-white/40 mt-0.5">Gestión de cuentas y roles</p></div><UserManager /></div>;
      default:            return <DashboardSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#070C0B', color: 'white' }}>
      <Helmet>
        <title>{isAdmin ? 'Admin Panel' : 'Panel Operativo'} · PolyFauna</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Top bar */}
      <header
        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 shrink-0 z-20"
        style={{ background: 'rgba(6,10,9,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center min-w-0 flex-1">
          <div className="w-[152px] sm:w-[190px]">
            <Logo variant="header" className="opacity-95" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-[10px] text-white/30 truncate max-w-40">{currentUser?.email}</span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 w-11 sm:w-auto h-11 sm:h-auto sm:px-4 sm:py-2 justify-center rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(32,199,232,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inicio</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={activeSection}
          setActive={setActiveSection}
          onGoHome={() => navigate('/')}
          mobileOpen={mobileNavOpen}
          setMobileOpen={setMobileNavOpen}
          groups={visibleGroups}
          panelLabel={isAdmin ? 'Admin Panel' : 'Panel Operativo'}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:p-6 lg:pb-6 overscroll-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={
                <div className="min-h-[40vh] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" aria-label="Cargando módulo" />
                </div>
              }>
                {renderSection()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileOperationsDock active={activeSection} setActive={setActiveSection} openMenu={() => setMobileNavOpen(true)} allowedIds={allowedSectionIds} />
    </div>
  );
};

export default AdminDashboard;
