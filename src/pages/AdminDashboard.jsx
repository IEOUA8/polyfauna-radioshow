import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Banknote, BarChart2, CalendarDays, CheckCircle,
  ChevronRight, Disc3, FileText, Headphones, Home, Loader2, Menu,
  Mic, Music, QrCode, Radio, RefreshCw, ScanLine, Shield,
  Ticket, TrendingUp, Users, X, XCircle, ListMusic,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import EventManager from '@/components/admin/EventManager';
import PodcastManager from '@/components/admin/PodcastManager';
import BlogManager from '@/components/admin/BlogManager';
import InterviewManager from '@/components/admin/InterviewManager';
import ShowManager from '@/components/admin/ShowManager';
import UserManager from '@/components/admin/UserManager';
import ArtistManager from '@/components/admin/ArtistManager';
import AlbumManager from '@/components/admin/AlbumManager';
import TrackManager from '@/components/admin/TrackManager';

/* ─────────────────────── NAV CONFIG ─────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Gestión',
    items: [
      { id: 'dashboard', label: 'Dashboard',   icon: BarChart2,   color: '#20C7E8' },
      { id: 'events',    label: 'Eventos',      icon: CalendarDays,color: '#FF8A1F' },
      { id: 'tickets',   label: 'Tickets',      icon: Ticket,      color: '#FFB020' },
      { id: 'qr',        label: 'Lector QR',    icon: QrCode,      color: '#22c55e' },
      { id: 'wallet',    label: 'Wallet',        icon: Banknote,    color: '#5DE0A3' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { id: 'podcasts',   label: 'Podcasts',    icon: Headphones,  color: '#7C5CFF' },
      { id: 'blog',       label: 'Blog',         icon: FileText,    color: '#B8CFA6' },
      { id: 'interviews', label: 'Interviews',   icon: Mic,         color: '#D946EF' },
      { id: 'shows',      label: 'Shows',        icon: Radio,       color: '#20C7E8' },
      { id: 'artists',    label: 'Artistas',     icon: Disc3,       color: '#7C5CFF' },
      { id: 'albums',     label: 'Álbumes',      icon: Music,       color: '#3A86FF' },
      { id: 'tracks',     label: 'Tracks',       icon: ListMusic,   color: '#3A86FF' },
    ],
  },
  {
    label: 'Usuarios',
    items: [
      { id: 'users', label: 'Usuarios', icon: Users, color: '#94A3B8' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

/* ─────────────────────── QR SCANNER ─────────────────────── */
function parseQRPayload(raw) {
  const match = raw.match(/polyfauna:\/\/ticket\/([0-9a-f-]{36})/i);
  if (match) return match[1];
  if (/^[0-9a-f-]{36}$/i.test(raw.trim())) return raw.trim();
  return null;
}

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

function QRScannerWidget({ scanKey }) {
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
    const { data, error: rpcErr } = await supabase.rpc('validate_ticket', { p_ticket_id: uuid });
    setResult(rpcErr ? { code: 'ERROR', error: rpcErr.message } : data);
    if (!rpcErr && data?.code === 'VALID') setScanCount(c => c + 1);
    setChecking(false);
    setTimeout(() => { processingRef.current = false; }, 2500);
  }, []);

  const onDetected = useCallback((raw) => {
    const uuid = parseQRPayload(raw);
    if (!uuid || processingRef.current) return;
    validate(uuid);
  }, [validate]);

  useEffect(() => {
    let scanner = null;
    let mounted = true;
    const start = async () => {
      if (!containerRef.current) return;
      try {
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
      if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
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
                  <div key={i} className={`absolute w-7 h-7 pointer-events-none ${cls}`} style={{ borderColor: checking ? '#FFB020' : '#22c55e' }} />
                ))}
                <motion.div
                  className="absolute left-3 right-3 h-0.5 rounded-full pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${checking ? '#FFB020' : '#22c55e'}, transparent)` }}
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
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFB020' }} />
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
function StatTile({ label, value, icon: Icon, color, loading, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl flex flex-col gap-3"
      style={{ background: 'rgba(11,16,15,0.90)', border: `1px solid ${color}20` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      {loading
        ? <div className="h-8 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        : <p className="text-3xl font-black text-white">{value}</p>
      }
      {sub && <p className="text-[11px] text-white/30">{sub}</p>}
    </motion.div>
  );
}

function DashboardSection() {
  const [stats, setStats] = useState({ users: 0, events: 0, tickets: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [recentTickets, setRecentTickets] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [usersRes, eventsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id, created_at, events(title, price), profiles(display_name, email)').order('created_at', { ascending: false }).limit(8),
      ]);

      // calculate total sold & revenue from tickets
      const allTickets = await supabase.from('tickets').select('events(price)');
      const revenue = (allTickets.data || []).reduce((sum, t) => sum + (t.events?.price || 0), 0);

      setStats({
        users: usersRes.count || 0,
        events: eventsRes.count || 0,
        tickets: ticketsRes.data?.length ? (await supabase.from('tickets').select('id', { count: 'exact', head: true })).count || 0 : 0,
        revenue,
      });
      setRecentTickets(ticketsRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Dashboard</h2>
        <p className="text-sm text-white/40 mt-0.5">Resumen general de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Usuarios" value={stats.users} icon={Users} color="#20C7E8" loading={loading} sub="Registrados" />
        <StatTile label="Eventos" value={stats.events} icon={CalendarDays} color="#FF8A1F" loading={loading} sub="Creados" />
        <StatTile label="Tickets" value={stats.tickets} icon={Ticket} color="#FFB020" loading={loading} sub="Vendidos" />
        <StatTile
          label="Ingresos"
          value={loading ? '—' : `$${stats.revenue.toLocaleString('es-CO')}`}
          icon={Banknote}
          color="#5DE0A3"
          loading={loading}
          sub="COP total"
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
                    {t.profiles?.display_name || t.profiles?.email || 'Usuario'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black" style={{ color: '#5DE0A3' }}>
                    ${(t.events?.price || 0).toLocaleString('es-CO')}
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

/* ─────────────────────── TICKETS SECTION ─────────────────────── */
function TicketsSection() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [buyers, setBuyers] = useState({});
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  useEffect(() => {
    supabase
      .from('events')
      .select('id, title, date, venue, price, tickets_total, tickets_sold')
      .order('date', { ascending: true })
      .then(({ data }) => { setEvents(data || []); setLoading(false); });
  }, []);

  const loadBuyers = async (eventId) => {
    if (buyers[eventId]) { setExpanded(eventId); return; }
    setLoadingBuyers(true);
    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_number, ticket_type, status, created_at, profiles(display_name, email, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setBuyers(b => ({ ...b, [eventId]: data || [] }));
    setExpanded(eventId);
    setLoadingBuyers(false);
  };

  const toggle = (id) => expanded === id ? setExpanded(null) : loadBuyers(id);

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Gestión de Tickets</h2>
        <p className="text-sm text-white/40 mt-0.5">Ventas y asistentes por evento</p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-white/30">No hay eventos creados aún.</p>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const sold = ev.tickets_sold || 0;
            const total = ev.tickets_total || 0;
            const pct = total > 0 ? Math.round((sold / total) * 100) : 0;
            const revenue = sold * (ev.price || 0);
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
                      <span className="font-bold" style={{ color: pct > 80 ? '#ef4444' : pct > 50 ? '#FFB020' : '#22c55e' }}>{pct}%</span>
                    </div>
                    {total > 0 && (
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#FFB020' : '#22c55e' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#5DE0A3' }}>${revenue.toLocaleString('es-CO')}</p>
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
                        {loadingBuyers ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                          </div>
                        ) : (buyers[ev.id] || []).length === 0 ? (
                          <p className="text-xs text-white/30 py-2">Sin compradores aún</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Compradores</p>
                            {(buyers[ev.id] || []).map((t) => (
                              <div key={t.id} className="flex items-center justify-between py-1.5">
                                <div>
                                  <p className="text-xs font-bold text-white">
                                    {t.profiles?.display_name || t.profiles?.email || 'Usuario'}
                                  </p>
                                  <p className="text-[10px] font-mono text-white/30">#{t.ticket_number} · {t.ticket_type}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded"
                                    style={{
                                      background: t.status === 'used' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                      color: t.status === 'used' ? '#ef4444' : '#22c55e',
                                    }}
                                  >
                                    {t.status === 'used' ? 'Usado' : 'Activo'}
                                  </span>
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
function WalletSection() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Get all tickets with event info
      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, events(id, title, date, price)')
        .neq('status', 'cancelled');

      // Aggregate by event
      const byEvent = {};
      (tickets || []).forEach(t => {
        const ev = t.events;
        if (!ev) return;
        if (!byEvent[ev.id]) byEvent[ev.id] = { title: ev.title, date: ev.date, price: ev.price || 0, count: 0 };
        byEvent[ev.id].count += 1;
      });

      setData(Object.values(byEvent).sort((a, b) => (b.count * b.price) - (a.count * a.price)));
      setLoading(false);
    };
    load();
  }, []);

  const total = data.reduce((s, e) => s + e.count * e.price, 0);
  const totalTickets = data.reduce((s, e) => s + e.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-white">Wallet</h2>
        <p className="text-sm text-white/40 mt-0.5">Ingresos por ventas de tickets</p>
      </div>

      {/* Total balance hero */}
      <div
        className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'linear-gradient(135deg, rgba(93,224,163,0.15), rgba(10,15,14,0.95))', border: '1px solid rgba(93,224,163,0.2)' }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(93,224,163,0.15), transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Total generado</p>
        {loading
          ? <div className="h-12 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          : <p className="text-4xl font-black text-white">${total.toLocaleString('es-CO')} <span className="text-base text-white/30 font-medium">COP</span></p>
        }
        <p className="text-sm text-white/40 mt-2">{totalTickets} ticket{totalTickets !== 1 ? 's' : ''} vendido{totalTickets !== 1 ? 's' : ''}</p>

        <div className="mt-6 flex gap-3 flex-wrap">
          <div className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
            💳 Retiro: próximamente
          </div>
          <div className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
            📊 Reportes: próximamente
          </div>
        </div>
      </div>

      {/* Per event breakdown */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-black text-white">Ingresos por evento</h3>
        </div>
        {loading ? (
          <div className="px-5 pb-5 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : data.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-white/30">Sin ventas registradas</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {data.map((ev, i) => {
              const evRevenue = ev.count * ev.price;
              const pct = total > 0 ? (evRevenue / total) * 100 : 0;
              return (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#5DE0A3' }} />
                      </div>
                      <span className="text-[10px] text-white/30 shrink-0">{ev.count} tickets</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: '#5DE0A3' }}>${evRevenue.toLocaleString('es-CO')}</p>
                    <p className="text-[10px] text-white/30">{Math.round(pct)}% del total</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── QR SECTION WRAPPER ─────────────────────── */
function QRSection() {
  const [scanKey, setScanKey] = useState(0);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  useEffect(() => {
    supabase.from('events').select('id, title').order('date', { ascending: true })
      .then(({ data }) => setEvents(data || []));
  }, []);

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
      </div>

      {/* Scanner */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <QRScannerWidget key={scanKey} scanKey={scanKey} />
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
function Sidebar({ active, setActive, onGoHome, mobileOpen, setMobileOpen }) {
  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-xs font-black text-white tracking-widest uppercase">PolyFauna</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Shield className="w-3 h-3" style={{ color: '#D946EF' }} />
            <p className="text-[10px] font-bold" style={{ color: '#D946EF' }}>Admin Panel</p>
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
        {NAV_GROUPS.map(group => (
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
                      background: isActive ? `${item.color}15` : 'transparent',
                      color: isActive ? item.color : 'rgba(255,255,255,0.45)',
                    }}
                    onMouseEnter={!isActive ? e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)') : undefined}
                    onMouseLeave={!isActive ? e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)') : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: item.color }} />
                    )}
                    <item.icon className="w-4 h-4 shrink-0" style={{ color: isActive ? item.color : `${item.color}70` }} />
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
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(32,199,232,0.08)'; e.currentTarget.style.borderColor = 'rgba(32,199,232,0.2)'; e.currentTarget.style.color = '#20C7E8'; }}
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

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.7)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col lg:hidden"
              style={{ background: 'rgba(6,10,9,0.99)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeItem = ALL_ITEMS.find(i => i.id === activeSection);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':   return <DashboardSection />;
      case 'events':      return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Eventos</h2><p className="text-sm text-white/40 mt-0.5">Crear y gestionar eventos</p></div><EventManager /></div>;
      case 'tickets':     return <TicketsSection />;
      case 'qr':          return <QRSection />;
      case 'wallet':      return <WalletSection />;
      case 'podcasts':    return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Podcasts</h2><p className="text-sm text-white/40 mt-0.5">Gestionar episodios</p></div><PodcastManager /></div>;
      case 'blog':        return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Blog</h2><p className="text-sm text-white/40 mt-0.5">Artículos y publicaciones</p></div><BlogManager /></div>;
      case 'interviews':  return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Interviews</h2><p className="text-sm text-white/40 mt-0.5">Entrevistas</p></div><InterviewManager /></div>;
      case 'shows':       return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Shows</h2><p className="text-sm text-white/40 mt-0.5">Programación de shows</p></div><ShowManager /></div>;
      case 'artists':     return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Artistas</h2><p className="text-sm text-white/40 mt-0.5">Perfiles de artistas y sellos</p></div><ArtistManager /></div>;
      case 'albums':      return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Álbumes</h2><p className="text-sm text-white/40 mt-0.5">Discografía</p></div><AlbumManager /></div>;
      case 'tracks':      return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Tracks</h2><p className="text-sm text-white/40 mt-0.5">Canciones y pistas</p></div><TrackManager /></div>;
      case 'users':       return <div className="space-y-4"><div><h2 className="text-lg font-black text-white">Usuarios</h2><p className="text-sm text-white/40 mt-0.5">Gestión de cuentas y roles</p></div><UserManager /></div>;
      default:            return <DashboardSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#070C0B', color: 'white' }}>
      <Helmet>
        <title>Admin Panel · PolyFauna</title>
      </Helmet>

      {/* Top bar */}
      <header
        className="flex items-center gap-4 px-5 py-3 shrink-0 z-30"
        style={{ background: 'rgba(6,10,9,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden text-white/40 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {activeItem && (
            <>
              <activeItem.icon className="w-4 h-4 shrink-0" style={{ color: activeItem.color }} />
              <span className="text-sm font-bold text-white truncate">{activeItem.label}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-[10px] text-white/30 truncate max-w-40">{currentUser?.email}</span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(32,199,232,0.08)', color: '#20C7E8', border: '1px solid rgba(32,199,232,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(32,199,232,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(32,199,232,0.08)')}
          >
            <Home className="w-3.5 h-3.5" />
            Inicio
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
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
