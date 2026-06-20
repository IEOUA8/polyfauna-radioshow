import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState, LoginRequired } from '@/components/SectionStates';
import { useAuth } from '@/contexts/AuthContext';

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function MessageRow({ msg, isSelected, onSelect, onMarkRead }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors"
      style={{
        background: isSelected ? 'rgba(32,199,232,0.07)' : 'rgba(11, 16, 15, 0.90)',
        border: `1px solid ${isSelected ? 'rgba(32,199,232,0.25)' : 'rgba(255,255,255,0.07)'}`,
      }}
      onClick={() => { onSelect(msg.id); if (!msg.is_read) onMarkRead(msg.id); }}
    >
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black mt-0.5"
        style={{ background: 'linear-gradient(135deg, #20C7E822, #7C5CFF22)', color: '#20C7E8' }}
      >
        {msg.from_name?.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold ${msg.is_read ? 'text-white/70' : 'text-white'}`}>{msg.from_name}</span>
          <span className="text-[10px] text-white/30 shrink-0">{formatDate(msg.created_at)}</span>
        </div>
        <p className={`text-xs mt-0.5 truncate ${msg.is_read ? 'text-white/40' : 'text-white/70'}`}>{msg.subject}</p>
        {msg.from_role && (
          <span className="text-[9px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
            {msg.from_role}
          </span>
        )}
      </div>
      {!msg.is_read && (
        <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: '#20C7E8' }} />
      )}
    </motion.div>
  );
}

export default function SignalInbox() {
  const { currentUser } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [localRead, setLocalRead] = useState({});

  const { data: messages, loading, error, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('messages').select('*').eq('to_user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para ver tus mensajes." /></div>;

  const markRead = async (id) => {
    setLocalRead((prev) => ({ ...prev, [id]: true }));
    await supabase.from('messages').update({ is_read: true }).eq('id', id);
  };

  const enriched = (messages || []).map((m) => ({ ...m, is_read: localRead[m.id] ?? m.is_read }));
  const selected = enriched.find((m) => m.id === selectedId);
  const unread = enriched.filter((m) => !m.is_read).length;

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Signal Inbox</h1>
          <p className="text-sm text-white/40 mt-1">Mensajes de la comunidad PolyFauna.</p>
        </div>
        {unread > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#20C7E8', color: '#080B14' }}>
            {unread} nuevo{unread !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && enriched.length === 0 && (
        <EmptyState label="Tu inbox está vacío" icon={MessageSquare} />
      )}

      {!loading && !error && enriched.length > 0 && (
        <div className="flex gap-4 min-h-[60vh]">
          {/* Message list */}
          <div className="w-full md:w-72 shrink-0 space-y-2">
            {enriched.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isSelected={selectedId === msg.id}
                onSelect={setSelectedId}
                onMarkRead={markRead}
              />
            ))}
          </div>

          {/* Message detail */}
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="hidden md:flex flex-1 flex-col rounded-xl p-6"
                style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black text-white">{selected.subject}</h2>
                    <p className="text-xs text-white/40 mt-1">
                      De: <span className="text-white/60">{selected.from_name}</span>
                      {selected.from_role && <span className="ml-1 text-white/30">· {selected.from_role}</span>}
                    </p>
                  </div>
                  <span className="text-[11px] text-white/30 shrink-0">{formatDate(selected.created_at)}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed flex-1">
                  {selected.body || 'Sin contenido.'}
                </p>
              </motion.div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center text-sm text-white/20 rounded-xl" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                Selecciona un mensaje para leerlo
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
