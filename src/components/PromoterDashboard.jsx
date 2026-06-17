import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Calendar, CheckCircle, Loader2,
  Plus, QrCode, Ticket, TrendingUp, Users, X, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { LoadingSkeleton, EmptyState, LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

// ── QR Validator modal ────────────────────────────────────────
function QRValidator({ eventId, onClose }) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const validate = async () => {
    if (!input.trim()) return;
    setChecking(true);
    setResult(null);

    const { data, error } = await supabase
      .from('user_tickets')
      .select('*, events(title)')
      .eq('ticket_number', input.trim())
      .eq('event_id', eventId)
      .single();

    if (error || !data) {
      setResult({ valid: false, message: 'Ticket no encontrado o no pertenece a este evento.' });
    } else if (data.status === 'used') {
      setResult({ valid: false, message: 'Este ticket ya fue usado.', ticket: data });
    } else {
      // Mark as used
      await supabase.from('user_tickets').update({ status: 'used' }).eq('id', data.id);
      setResult({ valid: true, message: '¡Acceso autorizado!', ticket: data });
      toast({ title: '✓ Entrada válida', description: `${data.ticket_type} — ${data.events?.title}` });
    }
    setChecking(false);
    setInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: '#0F1322', border: '1px solid rgba(255,255,255,0.1)' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" style={{ color: '#00CFFF' }} />
            <h3 className="text-sm font-black text-white">Validar Entrada</h3>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-white/40">Ingresa el número de ticket o escanea el QR.</p>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && validate()}
            placeholder="Número de ticket…"
            className="flex-1 text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            autoFocus
          />
          <button type="button" onClick={validate} disabled={checking || !input.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: '#00CFFF', color: '#080B14' }}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div key={result.valid ? 'ok' : 'fail'}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-4 rounded-xl text-center"
              style={{ background: result.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.valid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
              {result.valid
                ? <CheckCircle className="w-10 h-10" style={{ color: '#22c55e' }} />
                : <XCircle className="w-10 h-10 text-red-400" />}
              <p className="text-sm font-black" style={{ color: result.valid ? '#22c55e' : '#f87171' }}>
                {result.message}
              </p>
              {result.ticket && (
                <div className="text-[11px] text-white/40 space-y-0.5">
                  <p>Tipo: {result.ticket.ticket_type}</p>
                  <p className="font-mono">{result.ticket.ticket_number?.slice(0, 16)}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── Create Event modal ────────────────────────────────────────
function CreateEventModal({ onClose, onCreated }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', date: '', venue: '', city: '',
    price: '', tickets_total: '100', ticket_type: 'GA',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);
    const { data, error } = await supabase.from('events').insert({
      title: form.title, description: form.description,
      date: form.date, venue: form.venue, city: form.city,
      price: parseFloat(form.price) || 0,
      tickets_total: parseInt(form.tickets_total) || 100,
      owner_id: currentUser.id, status: 'published',
    }).select().single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Evento creado', description: form.title });
      onCreated(data);
    }
    setSaving(false);
  };

  const fields = [
    { key: 'title',        label: 'Nombre del evento *',  placeholder: 'PolyFauna: Opening Night',   type: 'text' },
    { key: 'date',         label: 'Fecha y hora *',       placeholder: '',                            type: 'datetime-local' },
    { key: 'venue',        label: 'Venue / Lugar',        placeholder: 'Club Razzmatazz',             type: 'text' },
    { key: 'city',         label: 'Ciudad',               placeholder: 'Bogotá',                      type: 'text' },
    { key: 'price',        label: 'Precio entrada (COP)', placeholder: '35000',                       type: 'number' },
    { key: 'tickets_total',label: 'Total de entradas',    placeholder: '100',                         type: 'number' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#0F1322', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">Crear Evento</h3>
            <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {fields.map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
                onFocus={e => (e.target.style.borderColor = '#00CFFF')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider block mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Describe el evento…"
              className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
              onFocus={e => (e.target.style.borderColor = '#00CFFF')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')} />
          </div>
          <button type="button" onClick={handleCreate} disabled={!form.title || !form.date || saving}
            className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#00CFFF', color: '#080B14' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creando…' : 'Publicar Evento'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event, onValidate }) {
  const sold = event.tickets_sold || 0;
  const total = event.tickets_total || 100;
  const pct = Math.round((sold / total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{event.title}</p>
          {event.date && (
            <p className="text-[11px] text-white/40 mt-0.5">
              {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              {event.venue && ` · ${event.venue}`}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${event.status === 'published' ? '' : 'opacity-60'}`}
          style={{ background: event.status === 'published' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)', color: event.status === 'published' ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
          {event.status === 'published' ? 'Publicado' : event.status}
        </span>
      </div>

      {/* Ticket progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40">Tickets vendidos</span>
          <span className="font-bold text-white">{sold} / {total}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#F59E0B' : '#00CFFF' }} />
        </div>
        <p className="text-[10px] text-white/30">{pct}% de capacidad</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1 text-xs text-white/50">
          <Ticket className="w-3 h-3" />
          <span>{sold} vendidas</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/50">
          <TrendingUp className="w-3 h-3" />
          <span>{event.price ? `$${Number(event.price).toLocaleString('es-CO')}` : 'Gratis'}</span>
        </div>
      </div>

      <button type="button" onClick={() => onValidate(event)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors"
        style={{ background: 'rgba(0,207,255,0.08)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,207,255,0.14)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,207,255,0.08)')}>
        <QrCode className="w-3.5 h-3.5" />
        Validar entradas en puerta
      </button>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function PromoterDashboard() {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [showCreate, setShowCreate] = useState(false);
  const [validatingEvent, setValidatingEvent] = useState(null);

  const { data: myEvents, loading, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('events').select('*').eq('owner_id', currentUser.id).order('date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para acceder al dashboard." /></div>;

  const canAccess = ['promoter', 'club', 'admin'].includes(profile?.role);
  if (profile && !canAccess) {
    return (
      <div className="p-5 flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1"
          style={{ background: 'rgba(0,207,255,0.08)' }}>
          <Users className="w-6 h-6" style={{ color: '#00CFFF' }} />
        </div>
        <p className="text-sm font-bold text-white/60">Acceso restringido</p>
        <p className="text-xs text-white/30 max-w-xs">Este panel es exclusivo para Promotores y Clubs. Edita tu perfil y cambia tu rol para solicitar acceso.</p>
      </div>
    );
  }

  const totalSold    = (myEvents || []).reduce((s, e) => s + (e.tickets_sold || 0), 0);
  const totalRevenue = (myEvents || []).reduce((s, e) => s + ((e.tickets_sold || 0) * (e.price || 0)), 0);

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Promoter Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Gestiona tus eventos y entradas.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#00CFFF', color: '#080B14' }}>
          <Plus className="w-4 h-4" />
          Nuevo Evento
        </button>
      </div>

      {/* Stats */}
      {myEvents && myEvents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Eventos',  value: myEvents.length, icon: Calendar,   color: '#00CFFF' },
            { label: 'Tickets',  value: totalSold,        icon: Ticket,     color: '#A78BFA' },
            { label: 'Ingresos', value: `$${totalRevenue.toLocaleString('es-CO')}`, icon: TrendingUp, color: '#34D399' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Icon className="w-4 h-4 mb-2" style={{ color }} />
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Events list */}
      {loading && <LoadingSkeleton rows={3} />}
      {!loading && (!myEvents || myEvents.length === 0) && (
        <EmptyState label="Aún no has creado eventos" icon={Calendar} />
      )}
      {!loading && myEvents && myEvents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myEvents.map(event => (
            <EventCard key={event.id} event={event} onValidate={setValidatingEvent} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
        )}
        {validatingEvent && (
          <QRValidator eventId={validatingEvent.id} onClose={() => setValidatingEvent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
