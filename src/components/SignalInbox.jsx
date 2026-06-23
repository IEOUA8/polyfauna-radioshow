import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Edit, MessageSquare, Search, Send, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState, LoginRequired } from '@/components/SectionStates';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/components/ui/use-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(str) {
  if (!str) return '';
  const diff = (Date.now() - new Date(str)) / 1000;
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const ROLE_COLOR = {
  citizen:  '#20C7E8',
  artist:   '#A78BFA',
  promoter: '#FF8A1F',
  club:     '#34D399',
  admin:    '#F87171',
};

const ROLE_LABEL = {
  citizen:  'Wave Citizen',
  artist:   'Artista',
  promoter: 'Promotor',
  club:     'Club / Venue',
  admin:    'Admin',
};

function Avatar({ name, avatarUrl, role, size = 8 }) {
  const color = ROLE_COLOR[role] || 'rgba(255,255,255,0.45)';
  const cls = `w-${size} h-${size} rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-black`;
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className={`${cls} object-cover`}
      style={{ border: `1px solid ${color}35` }} />
  ) : (
    <div className={cls}
      style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── ComposeModal ──────────────────────────────────────────────────────────────

function ComposeModal({ onClose, currentUser, senderProfile, initialTo = null, initialSubject = '' }) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || recipient) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, role')
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', currentUser.id)
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, recipient, currentUser.id]);

  const handleSend = async () => {
    if (!recipient || !subject.trim() || !body.trim()) {
      toast({ title: 'Completa todos los campos', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { data: sentMessage, error } = await supabase.from('messages').insert({
      from_user_id:    currentUser.id,
      from_name:       senderProfile?.display_name || currentUser.email?.split('@')[0] || 'Usuario',
      from_role:       senderProfile?.role || 'citizen',
      to_user_id:      recipient.id,
      to_display_name: recipient.display_name || recipient.username || 'Usuario',
      subject:         subject.trim(),
      body:            body.trim(),
      is_read:         false,
    }).select('id').single();
    setSending(false);
    if (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mensaje enviado', description: `Para: ${recipient.display_name || recipient.username}` });
      // Notify recipient by email — Edge Function resolves email via service role
      supabase.functions.invoke('send-message-notification', {
        body: { messageId: sentMessage.id },
      }).catch(() => {});
      onClose(true);
    }
  };

  const recipientColor = ROLE_COLOR[recipient?.role] || 'rgba(255,255,255,0.45)';
  const canSend = !sending && recipient && subject.trim() && body.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full sm:max-w-lg flex flex-col"
        style={{
          background: 'rgba(7,12,11,0.97)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -24px 80px rgba(0,0,0,0.55)',
          maxHeight: '92dvh',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <Edit className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.38)' }} />
            <span className="text-sm font-black text-white">Nuevo mensaje</span>
          </div>
          <button type="button" onClick={() => onClose(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Para */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block"
              style={{ color: 'rgba(255,255,255,0.32)' }}>Para</label>

            {recipient ? (
              /* Selected chip */
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <Avatar name={recipient.display_name || recipient.username} avatarUrl={recipient.avatar_url} role={recipient.role} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{recipient.display_name || recipient.username}</p>
                  {recipient.role && (
                    <p className="text-[10px]" style={{ color: recipientColor }}>
                      {ROLE_LABEL[recipient.role] || recipient.role}
                    </p>
                  )}
                </div>
                <button type="button"
                  onClick={() => { setRecipient(null); setQuery(''); }}
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>
              </div>
            ) : (
              /* Search field */
              <div className="relative">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }} />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar artista, promotor, usuario…"
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/25"
                  />
                  {searching && (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/15 border-t-white/55 animate-spin shrink-0" />
                  )}
                </div>

                {/* Results dropdown */}
                <AnimatePresence>
                  {results.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                      style={{
                        background: 'rgba(7,13,12,0.99)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                      }}>
                      {results.map((p, i) => {
                        const rc = ROLE_COLOR[p.role] || 'rgba(255,255,255,0.4)';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setRecipient(p); setQuery(''); setResults([]); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                            style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                          >
                            <Avatar name={p.display_name || p.username} avatarUrl={p.avatar_url} role={p.role} size={7} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{p.display_name || p.username}</p>
                              {p.role && (
                                <p className="text-[10px]" style={{ color: rc }}>
                                  {ROLE_LABEL[p.role] || p.role}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Asunto */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block"
              style={{ color: 'rgba(255,255,255,0.32)' }}>Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del mensaje"
              className="w-full bg-transparent outline-none text-sm text-white placeholder-white/25 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block"
              style={{ color: 'rgba(255,255,255,0.32)' }}>Mensaje</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe tu mensaje…"
              rows={6}
              className="w-full bg-transparent outline-none text-sm text-white placeholder-white/25 px-3 py-2.5 rounded-xl resize-none leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
            />
            <p className="text-[10px] mt-1 text-right" style={{ color: 'rgba(255,255,255,0.18)' }}>
              {body.length} caracteres
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 flex items-center justify-end gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button type="button" onClick={() => onClose(false)}
            className="text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            style={{ color: 'rgba(255,255,255,0.38)' }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 text-sm font-black px-5 py-2.5 rounded-xl transition-all"
            style={{
              background: canSend ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.15)',
              color: canSend ? '#07100F' : 'rgba(255,255,255,0.35)',
              boxShadow: canSend ? '0 2px 16px rgba(255,255,255,0.18)' : 'none',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {sending
              ? <div className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-gray-800 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
            Enviar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── MessageRow ────────────────────────────────────────────────────────────────

function MessageRow({ msg, isSelected, onSelect, onMarkRead, isSent }) {
  const displayName = isSent
    ? (msg.to_display_name || 'Destinatario')
    : (msg.from_name || 'Sistema');
  const roleColor = ROLE_COLOR[msg.from_role] || 'rgba(255,255,255,0.4)';
  const unread = !msg.is_read && !isSent;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-colors"
      style={{
        background: isSelected ? 'rgba(255,255,255,0.07)' : 'rgba(11,16,15,0.90)',
        border: `1px solid ${isSelected ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}`,
      }}
      onClick={() => {
        onSelect(msg.id);
        if (unread) onMarkRead(msg.id);
      }}
    >
      {/* Avatar placeholder */}
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black"
        style={{ background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}28` }}
      >
        {displayName[0]?.toUpperCase() || '?'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-xs font-bold truncate ${unread ? 'text-white' : 'text-white/55'}`}>
            {displayName}
          </span>
          <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {timeAgo(msg.created_at)}
          </span>
        </div>
        <p className={`text-xs truncate mt-0.5 ${unread ? 'text-white/65' : 'text-white/30'}`}>
          {msg.subject}
        </p>
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-1.5 shrink-0">
        {unread && (
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.85)' }} />
        )}
        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.18)' }} />
      </div>
    </motion.button>
  );
}

// ── MessageDetail ─────────────────────────────────────────────────────────────

function MessageDetail({ msg, onBack, onReply, isSent }) {
  const roleColor = ROLE_COLOR[msg.from_role] || 'rgba(255,255,255,0.45)';
  const senderLabel = isSent
    ? (msg.to_display_name || 'Destinatario')
    : (msg.from_name || 'Sistema');

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
      style={{
        background: 'rgba(11,16,15,0.90)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        minHeight: 300,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Back arrow — mobile only */}
        {onBack && (
          <button type="button" onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center md:hidden shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-white leading-tight truncate">{msg.subject}</h2>
          <p className="text-[11px] mt-0.5 flex flex-wrap items-center gap-x-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span style={{ color: roleColor }}>
              {isSent ? `Para: ${senderLabel}` : `De: ${senderLabel}`}
            </span>
            {!isSent && msg.from_role && (
              <>
                <span>·</span>
                <span>{ROLE_LABEL[msg.from_role] || msg.from_role}</span>
              </>
            )}
            <span>·</span>
            <span>{timeAgo(msg.created_at)}</span>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.60)' }}>
          {msg.body || 'Sin contenido.'}
        </p>
      </div>

      {/* Reply button — only for received messages from real users */}
      {!isSent && msg.from_user_id && onReply && (
        <div className="shrink-0 px-4 py-3.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            onClick={onReply}
            className="w-full flex items-center justify-center gap-2 text-xs font-black py-2.5 rounded-xl transition-all hover:bg-white/10"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <Send className="w-3.5 h-3.5" />
            Responder a {msg.from_name}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── SignalInbox ───────────────────────────────────────────────────────────────

export default function SignalInbox() {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [tab, setTab] = useState('recibidos');
  const [selectedId, setSelectedId] = useState(null);
  const [localRead, setLocalRead] = useState({});
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  const isSent = tab === 'enviados';

  const {
    data: received,
    loading: loadingR,
    error: errorR,
    refetch: refetchR,
  } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('messages').select('*').eq('to_user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  const {
    data: sent,
    loading: loadingS,
    error: errorS,
    refetch: refetchS,
  } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('messages').select('*').eq('from_user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) {
    return (
      <div className="p-5">
        <LoginRequired message="Inicia sesión para ver tus mensajes." />
      </div>
    );
  }

  const markRead = async (id) => {
    setLocalRead((prev) => ({ ...prev, [id]: true }));
    await supabase.from('messages').update({ is_read: true }).eq('id', id);
  };

  const enrichedReceived = (received || []).map((m) => ({
    ...m,
    is_read: localRead[m.id] ?? m.is_read,
  }));
  const enrichedSent = sent || [];

  const messages  = isSent ? enrichedSent : enrichedReceived;
  const loading   = isSent ? loadingS : loadingR;
  const error     = isSent ? errorS : errorR;
  const refetch   = isSent ? refetchS : refetchR;
  const unread    = enrichedReceived.filter((m) => !m.is_read).length;
  const selected  = messages.find((m) => m.id === selectedId);

  const handleSelect = (id) => {
    setSelectedId(id);
    setMobileDetail(true);
  };

  const handleBack = () => {
    setMobileDetail(false);
    setSelectedId(null);
  };

  const handleReply = (msg) => {
    setReplyTo({
      id:           msg.from_user_id,
      display_name: msg.from_name,
      username:     msg.from_name,
      role:         msg.from_role,
      avatar_url:   null,
      _subject:     msg.subject,
    });
    setShowCompose(true);
  };

  const handleCloseCompose = (sent) => {
    setShowCompose(false);
    setReplyTo(null);
    if (sent) { refetchR(); refetchS(); }
  };

  const switchTab = (id) => {
    setTab(id);
    setSelectedId(null);
    setMobileDetail(false);
  };

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Signal Inbox</h1>
          <p className="text-sm text-white/40 mt-0.5">Mensajes de la comunidad PolyFauna.</p>
        </div>
        <button
          type="button"
          onClick={() => { setReplyTo(null); setShowCompose(true); }}
          className="flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-xl transition-all hover:scale-105 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.90)',
            color: '#07100F',
            boxShadow: '0 2px 14px rgba(255,255,255,0.16)',
          }}
        >
          <Edit className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nuevo mensaje</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        className="inline-flex gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { id: 'recibidos', label: unread > 0 ? `Recibidos · ${unread}` : 'Recibidos' },
          { id: 'enviados',  label: 'Enviados' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: tab === id ? 'rgba(255,255,255,0.09)' : 'transparent',
              color:      tab === id ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.32)',
              border:     tab === id ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && <LoadingSkeleton rows={4} />}
      {error   && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && messages.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          label={isSent ? 'Aún no has enviado mensajes' : 'Tu inbox está vacío'}
          subtitle={
            isSent
              ? 'Escribe a artistas, promotores y otros miembros de la comunidad.'
              : 'Los mensajes de artistas, promotores y la comunidad aparecerán aquí.'
          }
          action={() => setShowCompose(true)}
          actionLabel="Enviar primer mensaje"
        />
      )}

      {/* Two-pane layout */}
      {!loading && !error && messages.length > 0 && (
        <div className="flex gap-4" style={{ minHeight: 420 }}>

          {/* ── Message list ── */}
          <div className={`w-full md:w-72 shrink-0 space-y-2 ${mobileDetail ? 'hidden md:block' : 'block'}`}>
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isSelected={selectedId === msg.id}
                onSelect={handleSelect}
                onMarkRead={markRead}
                isSent={isSent}
              />
            ))}
          </div>

          {/* ── Message detail ── */}
          <AnimatePresence mode="wait">
            {selected ? (
              <div
                key={selected.id}
                className={`flex-1 ${mobileDetail ? 'block' : 'hidden md:block'}`}
              >
                <MessageDetail
                  msg={selected}
                  onBack={handleBack}
                  onReply={() => handleReply(selected)}
                  isSent={isSent}
                />
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center text-sm rounded-xl"
                style={{ color: 'rgba(255,255,255,0.18)', border: '1px dashed rgba(255,255,255,0.07)' }}>
                Selecciona un mensaje para leerlo
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Compose modal */}
      <AnimatePresence>
        {showCompose && (
          <ComposeModal
            currentUser={currentUser}
            senderProfile={profile}
            initialTo={replyTo}
            initialSubject={replyTo?._subject ? `Re: ${replyTo._subject}` : ''}
            onClose={handleCloseCompose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
