import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, ArrowUpRight, Banknote, Calendar, CheckCircle,
  CreditCard, ExternalLink, Gift, Loader2, Plus, QrCode, Send, Ticket, Trash2, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { LoadingSkeleton, EmptyState, LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import FormModal, { FField, FInput, FTextarea, FImageZone, FSubmit } from '@/components/ui/FormModal';
import ArtistMentionInput from '@/components/ArtistMentionInput';

const TICKET_TYPE_OPTIONS = ['General', 'VIP', 'Early', 'Anytime', 'Gratis'];
const FREE_TICKET_TYPES = new Set(['Gratis']);
const DEFAULT_TICKET_TYPES = [{ name: 'General', price: '', capacity: '100' }];
const BANKS = [
  'Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Popular',
  'Banco de Occidente', 'Nequi', 'Daviplata', 'Otro',
];

const TABS = [
  { id: 'events',   label: 'Mis Eventos',     icon: Calendar },
  { id: 'wallet',   label: 'Wallet',           icon: Wallet   },
  { id: 'account',  label: 'Cuenta Bancaria',  icon: CreditCard },
];

// ── Create Event modal ────────────────────────────────────────
function CreateEventModal({ onClose, onCreated }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', date: '', ends_at: '', venue: '', city: '', lineup: [], courtesy_limit: '0',
  });
  const [ticketTypes, setTicketTypes] = useState(DEFAULT_TICKET_TYPES);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateTicketType = (index, key, value) => {
    setTicketTypes(current => current.map((ticket, i) => i === index ? { ...ticket, [key]: value } : ticket));
  };
  const addTicketType = (name) => {
    setTicketTypes(current => current.some(ticket => ticket.name === name)
      ? current
      : [...current, { name, price: FREE_TICKET_TYPES.has(name) ? '0' : '', capacity: '50' }]);
  };
  const removeTicketType = (name) => {
    setTicketTypes(current => current.length === 1 ? current : current.filter(ticket => ticket.name !== name));
  };

  const normalizedTicketTypes = ticketTypes.map(ticket => ({
    name: ticket.name,
    price: Math.max(0, Number(ticket.price) || 0),
    capacity: Math.max(0, parseInt(ticket.capacity, 10) || 0),
  }));
  const ticketTypesValid = normalizedTicketTypes.length > 0
    && normalizedTicketTypes.every((ticket, index) =>
      ticket.capacity > 0
      && ticketTypes[index].price !== ''
      && Number(ticketTypes[index].price) >= 0
    );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (
      !form.title
      || !form.date
      || !form.ends_at
      || new Date(form.ends_at) <= new Date(form.date)
      || !ticketTypesValid
    ) return;
    setSaving(true);

    let image_url = null;
    if (coverFile) {
      const ext = coverFile.name.split('.').pop();
      const path = `events/${currentUser.id}/${crypto.randomUUID()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from('album-covers')
        .upload(path, coverFile, { upsert: false });
      if (upErr || !up) {
        toast({
          title: 'No se pudo subir la portada',
          description: upErr?.message || 'Intenta nuevamente con otra imagen.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('album-covers').getPublicUrl(up.path);
      image_url = publicUrl;
    }

    const courtesyLimit = Math.max(0, parseInt(form.courtesy_limit, 10) || 0);
    const ticketsTotal = normalizedTicketTypes.reduce((sum, ticket) => sum + ticket.capacity, 0) + courtesyLimit;
    const startingPrice = Math.min(...normalizedTicketTypes.map(ticket => ticket.price));
    const { data, error } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      date: form.date,
      ends_at: form.ends_at,
      venue: form.venue || null,
      city: form.city || null,
      price: startingPrice,
      tickets_total: ticketsTotal,
      ticket_types: normalizedTicketTypes,
      courtesy_limit: courtesyLimit,
      lineup: form.lineup,
      owner_id: currentUser.id,
      status: 'upcoming',
      image_url,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '¡Evento publicado!', description: form.title });
      onCreated(data);
    }
    setSaving(false);
  };

  return (
    <FormModal
      title="Crear Evento"
      subtitle="Completa los datos y configura uno o varios tipos de entrada"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={(
        <FSubmit
          form="create-event-form"
          loading={saving}
          disabled={!form.title || !form.date || !form.ends_at || new Date(form.ends_at) <= new Date(form.date) || !ticketTypesValid}
        >
          <Plus className="w-4 h-4" />
          {saving ? 'Publicando…' : 'Publicar Evento'}
        </FSubmit>
      )}
    >
      <form id="create-event-form" onSubmit={handleCreate} className="space-y-4">
        <FImageZone
          file={coverFile}
          onFile={setCoverFile}
          label="Subir imagen del evento"
          hint="JPG, PNG, WEBP · Recomendado 16:9"
          aspect="aspect-video"
        />
        <div className="grid grid-cols-2 gap-3">
          <FField label="Nombre del evento" required span={2}>
            <FInput value={form.title} onChange={e => set('title', e.target.value)} placeholder="PolyFauna: Opening Night" />
          </FField>
          <FField label="Inicio del evento" required>
            <FInput type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} />
          </FField>
          <FField label="Final del evento" required>
            <FInput type="datetime-local" value={form.ends_at} min={form.date || undefined} onChange={e => set('ends_at', e.target.value)} />
          </FField>
          <FField label="Venue / Lugar">
            <FInput value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Club Razzmatazz" />
          </FField>
          <FField label="Ciudad">
            <FInput value={form.city} onChange={e => set('city', e.target.value)} placeholder="Bogotá" />
          </FField>
          <FField label="Cupos de cortesía">
            <FInput type="number" min="0" value={form.courtesy_limit} onChange={e => set('courtesy_limit', e.target.value)} placeholder="0" />
          </FField>
          <FField label="Tipos de entrada" span={2}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TICKET_TYPE_OPTIONS.map(name => {
                  const active = ticketTypes.some(ticket => ticket.name === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => active ? removeTicketType(name) : addTicketType(name)}
                      className="rounded-xl px-3 py-2.5 text-xs font-black transition-all"
                      style={{
                        background: active ? 'rgba(32,199,232,0.16)' : 'rgba(255,255,255,0.045)',
                        color: active ? '#8BEAFF' : 'rgba(255,255,255,0.62)',
                        border: active ? '1px solid rgba(32,199,232,0.45)' : '1px solid rgba(255,255,255,0.12)',
                        boxShadow: active ? '0 0 0 1px rgba(32,199,232,0.08)' : 'none',
                      }}
                    >
                      {active ? '✓ ' : '+ '}{name}
                    </button>
                  );
                })}
              </div>

              {ticketTypes.map((ticket, index) => (
                <div key={ticket.name} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl p-3"
                  style={{ background: 'rgba(4,10,10,0.58)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <p className="text-xs font-black text-white mb-2">
                      {ticket.name}{FREE_TICKET_TYPES.has(ticket.name) ? ' · Sin costo' : ''}
                    </p>
                    <FInput
                      type="number"
                      value={ticket.price}
                      onChange={e => updateTicketType(index, 'price', e.target.value)}
                      placeholder="Precio COP"
                      min="0"
                      step="1000"
                      disabled={FREE_TICKET_TYPES.has(ticket.name)}
                      aria-label={`Precio ${ticket.name}`}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white mb-2">Cupo</p>
                    <FInput
                      type="number"
                      value={ticket.capacity}
                      onChange={e => updateTicketType(index, 'capacity', e.target.value)}
                      placeholder="Cantidad"
                      min="1"
                      aria-label={`Cupo ${ticket.name}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTicketType(ticket.name)}
                    disabled={ticketTypes.length === 1}
                    className="self-end mb-1 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-20"
                    style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)' }}
                    aria-label={`Eliminar ${ticket.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Puedes combinar entradas pagas y gratis. Las cortesías se reservan arriba y se asignan desde la gestión del evento.
              </p>
            </div>
          </FField>
          <FField label="Descripción" span={2}>
            <FTextarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe el evento, artistas, rooms…" rows={3} />
          </FField>
          <FField label="DJs / Artistas" span={2}>
            <ArtistMentionInput value={form.lineup} onChange={lineup => set('lineup', lineup)} />
          </FField>
        </div>
      </form>
    </FormModal>
  );
}

function CourtesyModal({ event, onClose, onIssued }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('issue-courtesy-ticket', {
      body: { eventId: event.id, userEmail: email.trim() },
    });
    setSending(false);
    if (error || !data?.ok) {
      toast({
        title: 'No se pudo emitir la cortesía',
        description: data?.error || error?.message || 'Verifica el correo e intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: data.alreadyProcessed ? 'El usuario ya tenía entrada' : 'Cortesía enviada',
      description: `#${data.ticketNumber}${data.emailSent ? ' · correo enviado' : ''}${data.pushSent ? ' · push enviado' : ''}`,
    });
    onIssued(data);
  };

  return (
    <FormModal
      title="Enviar cortesía"
      subtitle={`${event.title} · ${(event.courtesy_limit || 0) - (event.courtesies_issued || 0)} disponibles`}
      onClose={onClose}
      footer={(
        <FSubmit form="courtesy-ticket-form" loading={sending} disabled={!email.trim()}>
          <Send className="w-4 h-4" />
          Enviar cortesía
        </FSubmit>
      )}
    >
      <form id="courtesy-ticket-form" onSubmit={submit} className="space-y-4">
        <FField label="Correo del usuario" required>
          <FInput type="email" value={email} onChange={eventChange => setEmail(eventChange.target.value)}
            placeholder="usuario@correo.com" autoFocus />
        </FField>
        <div className="rounded-xl p-3 text-xs leading-relaxed text-white/45"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          El usuario debe estar registrado y tener nombre completo y documento en su perfil. Recibirá el ticket en su Vault, correo y notificación push.
        </div>
      </form>
    </FormModal>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event, onCourtesy }) {
  const navigate = useNavigate();
  const sold = event.tickets_sold || 0;
  const total = event.tickets_total || 100;
  const pct = Math.round((sold / total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40">Tickets vendidos</span>
          <span className="font-bold text-white">{sold} / {total}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#F59E0B' : 'rgba(255,255,255,0.9)' }} />
        </div>
        <p className="text-[10px] text-white/30">{pct}% de capacidad</p>
      </div>

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

      <div className="grid grid-cols-1 gap-2">
        {(event.courtesy_limit || 0) > 0 && (
          <button type="button" onClick={() => onCourtesy(event)}
            disabled={(event.courtesies_issued || 0) >= event.courtesy_limit}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold disabled:opacity-35"
            style={{ background: 'rgba(167,139,250,0.10)', color: '#C4B5FD', border: '1px solid rgba(167,139,250,0.22)' }}>
            <Gift className="w-3.5 h-3.5" />
            Cortesías {event.courtesies_issued || 0}/{event.courtesy_limit}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/validate?event=${event.id}`)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.11)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          <QrCode className="w-3.5 h-3.5" />
          Validar entradas en puerta
          <ExternalLink className="w-3 h-3 opacity-50" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Wallet Tab ─────────────────────────────────────────────────
function WalletTab({ userId }) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [walletRes, acctRes, txRes, payoutRes] = await Promise.all([
        supabase.rpc('get_or_create_wallet', { p_user_id: userId }),
        supabase.from('promoter_accounts').select('id').eq('user_id', userId).maybeSingle(),
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
      setHasAccount(!!acctRes.data?.id);
      setTxs(txRes.data || []);
      setPayouts(payoutRows);
      setLoading(false);
    };
    load();
  }, [userId]);

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

  if (loading) return <LoadingSkeleton rows={4} />;

  const available = wallet?.balance_available || 0;
  const pending   = wallet?.balance_pending   || 0;
  const total     = wallet?.total_earned      || 0;

  return (
    <div className="space-y-5">
      {/* Balance hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: 'linear-gradient(135deg, rgba(93,224,163,0.14), rgba(10,15,14,0.95))', border: '1px solid rgba(93,224,163,0.2)' }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(93,224,163,0.18), transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="grid grid-cols-3 gap-4 relative z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Disponible</p>
            <p className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.85)' }}>${available.toLocaleString('es-CO')}</p>
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
          <p className="text-[11px] text-white/30 mt-3 relative z-10">
            El saldo en espera se libera 48h después de cada evento.
          </p>
        )}
      </motion.div>

      {/* Solicitar retiro */}
      {available > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(93,224,163,0.15)' }}>
          {!hasAccount ? (
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs text-white/50">Registra una cuenta bancaria en la pestaña <span className="text-white/80 font-bold">Cuenta Bancaria</span> para poder solicitar retiros.</p>
            </div>
          ) : showRequest ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-white">Solicitar retiro</p>
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Monto (COP)</label>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={e => setRequestAmount(e.target.value)}
                  placeholder="0"
                  max={available}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                />
                <p className="text-[10px] text-white/30 mt-1">Disponible: ${available.toLocaleString('es-CO')} COP</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowRequest(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
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

      {/* Retiros recientes */}
      {payouts.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-4 pt-4 pb-2">Retiros solicitados</p>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {payouts.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">${p.amount.toLocaleString('es-CO')} COP</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {new Date(p.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    {p.transfer_reference && ` · Ref: ${p.transfer_reference}`}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full`} style={{
                  background: p.status === 'completed' ? 'rgba(34,197,94,0.1)' : p.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                  color: p.status === 'completed' ? '#22c55e' : p.status === 'rejected' ? '#ef4444' : '#F59E0B',
                }}>
                  {p.status === 'completed' ? 'Completado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de transacciones */}
      {txs.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-4 pt-4 pb-2">Pagos recibidos</p>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {txs.map(tx => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
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
        <EmptyState label="Aún no hay pagos registrados" icon={Banknote} />
      )}
    </div>
  );
}

// ── Cuenta Bancaria Tab ────────────────────────────────────────
function BankAccountTab({ userId }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_holder: '', document_type: 'CC', document_number: '',
    bank_name: 'Bancolombia', account_type: 'ahorros', account_number: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [exists, setExists] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('promoter_accounts').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            account_holder: data.account_holder || '',
            document_type:  data.document_type  || 'CC',
            document_number: data.document_number || '',
            bank_name:      data.bank_name      || 'Bancolombia',
            account_type:   data.account_type   || 'ahorros',
            account_number: data.account_number || '',
          });
          setExists(true);
          setVerified(data.verified);
        }
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.account_holder || !form.account_number || !form.document_number) return;
    setSaving(true);

    const payload = { ...form, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = exists
      ? await supabase.from('promoter_accounts').update(payload).eq('user_id', userId)
      : await supabase.from('promoter_accounts').insert(payload);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: exists ? 'Cuenta actualizada' : 'Cuenta registrada', description: 'Tus datos bancarios han sido guardados.' });
      setExists(true);
    }
    setSaving(false);
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-5">
      {verified && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#22c55e' }} />
          <p className="text-xs text-white/60">Cuenta bancaria verificada por el equipo PolyFauna.</p>
        </div>
      )}
      {exists && !verified && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-xs text-white/60">Tu cuenta está pendiente de verificación. El equipo la revisará en 1-2 días hábiles.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-bold text-white">Datos del titular</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Nombre completo del titular *</label>
              <input type="text" value={form.account_holder} onChange={e => set('account_holder', e.target.value)}
                placeholder="Nombre Apellido"
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }} />
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Tipo de documento</label>
              <select value={form.document_type} onChange={e => set('document_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                {['CC','NIT','CE','Pasaporte'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Número de documento *</label>
              <input type="text" value={form.document_number} onChange={e => set('document_number', e.target.value)}
                placeholder="1234567890"
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }} />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-bold text-white">Datos bancarios</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Banco</label>
              <select value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Tipo de cuenta</label>
              <select value={form.account_type} onChange={e => set('account_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(11,16,15,0.95)' }}>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1">Número de cuenta *</label>
              <input type="text" value={form.account_number} onChange={e => set('account_number', e.target.value)}
                placeholder="0000000000"
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving || !form.account_holder || !form.account_number || !form.document_number}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.95)', color: '#06090A' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {saving ? 'Guardando…' : exists ? 'Actualizar cuenta' : 'Registrar cuenta'}
        </button>
      </form>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function PromoterDashboard() {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState('events');
  const [showCreate, setShowCreate] = useState(false);
  const [courtesyEvent, setCourtesyEvent] = useState(null);

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
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <Users className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.9)' }} />
        </div>
        <p className="text-sm font-bold text-white/60">Acceso restringido</p>
        <p className="text-xs text-white/30 max-w-xs">Este panel es exclusivo para Promotores y Clubs. Edita tu perfil y cambia tu rol para solicitar acceso.</p>
      </div>
    );
  }

  const totalSold    = (myEvents || []).reduce((s, e) => s + (e.tickets_sold || 0), 0);
  const totalRevenue = (myEvents || []).reduce((s, e) => s + ((e.tickets_sold || 0) * (e.price || 0)), 0);
  const dashboardTitle = profile?.organizer_type === 'collective' ? 'Panel del Colectivo' : 'Promoter Dashboard';

  return (
    <div className="p-5 space-y-5">
      <AnimatePresence>
        {courtesyEvent && (
          <CourtesyModal
            event={courtesyEvent}
            onClose={() => setCourtesyEvent(null)}
            onIssued={() => {
              setCourtesyEvent(null);
              refetch();
            }}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">{dashboardTitle}</h1>
          <p className="text-sm text-white/40 mt-1">Gestiona eventos, wallet y cuenta bancaria.</p>
        </div>
        {activeTab === 'events' && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </button>
        )}
      </div>

      {/* Stats (visible on events tab) */}
      {activeTab === 'events' && myEvents && myEvents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Eventos',  value: myEvents.length, icon: Calendar,   color: 'rgba(255,255,255,0.9)' },
            { label: 'Tickets',  value: totalSold,        icon: Ticket,     color: '#A78BFA' },
            { label: 'Ingresos', value: `$${totalRevenue.toLocaleString('es-CO')}`, icon: TrendingUp, color: '#34D399' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Icon className="w-4 h-4 mb-2" style={{ color }} />
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: activeTab === id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === id ? '#fff' : 'rgba(255,255,255,0.4)',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'events' && (
            <>
              {loading && <LoadingSkeleton rows={3} />}
              {!loading && (!myEvents || myEvents.length === 0) && (
                <EmptyState label="Aún no has creado eventos" icon={Calendar} />
              )}
              {!loading && myEvents && myEvents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myEvents.map(event => (
                    <EventCard key={event.id} event={event} onCourtesy={setCourtesyEvent} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'wallet' && (
            <WalletTab userId={currentUser.id} />
          )}

          {activeTab === 'account' && (
            <BankAccountTab userId={currentUser.id} />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
