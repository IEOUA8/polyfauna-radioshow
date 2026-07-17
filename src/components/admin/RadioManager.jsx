import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Heart, Loader2, MessageCircle, Plus, Radio, Send, Trash2 } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_SET = { title: '', host_name: '', description: '', artwork_url: '', starts_at: '', ends_at: '' };

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

export default function RadioManager() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [sets, setSets] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(EMPTY_SET);
  const [responses, setResponses] = useState({});
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  const refresh = useCallback(async () => {
    const [{ data: setRows, error: setError }, { data: questionRows, error: questionError }] = await Promise.all([
      supabase.from('radio_sets').select('*').order('starts_at', { ascending: false }).limit(40),
      supabase.from('show_questions').select('*').order('created_at', { ascending: false }).limit(80),
    ]);
    if (setError || questionError) {
      toast({ title: 'No se pudo cargar Radio', description: (setError || questionError)?.message, variant: 'destructive' });
      return;
    }
    setSets(setRows || []);
    setQuestions(questionRows || []);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const createSet = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.starts_at || !form.ends_at) return;
    setSaving(true);
    const { error } = await supabase.from('radio_sets').insert({
      ...form,
      title: form.title.trim(),
      host_name: form.host_name.trim() || null,
      description: form.description.trim() || null,
      artwork_url: form.artwork_url.trim() || null,
      starts_at: toIso(form.starts_at),
      ends_at: toIso(form.ends_at),
      created_by: currentUser.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'No se pudo programar', description: error.message, variant: 'destructive' });
      return;
    }
    setForm(EMPTY_SET);
    toast({ title: 'Set radial programado' });
    refresh();
  };

  const deleteSet = async (id) => {
    if (!window.confirm('¿Eliminar este set de la programación?')) return;
    setWorkingId(id);
    const { error } = await supabase.from('radio_sets').delete().eq('id', id);
    setWorkingId(null);
    if (error) toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
    else refresh();
  };

  const answerQuestion = async (question) => {
    const response = responses[question.id]?.trim();
    if (!response) return;
    setWorkingId(question.id);
    const { data: message, error: messageError } = await supabase.from('messages').insert({
      from_user_id: currentUser.id,
      from_name: 'PolyFauna Radio',
      from_role: 'admin',
      to_user_id: question.user_id,
      to_display_name: question.user_name || 'Oyente',
      subject: `Respuesta: ${question.show_name || 'PolyFauna Radio'}`,
      body: response,
      is_read: false,
    }).select('id').single();
    if (!messageError) {
      const { error: updateError } = await supabase.from('show_questions').update({
        answered: true,
        answered_at: new Date().toISOString(),
        response_message_id: message.id,
      }).eq('id', question.id);
      if (updateError) toast({ title: 'Mensaje enviado, estado pendiente', description: updateError.message, variant: 'destructive' });
      else {
        supabase.functions.invoke('send-message-notification', { body: { messageId: message.id } }).catch(() => {});
        toast({ title: 'Respuesta enviada al usuario' });
        setResponses(current => ({ ...current, [question.id]: '' }));
      }
    } else {
      toast({ title: 'No se pudo responder', description: messageError.message, variant: 'destructive' });
    }
    setWorkingId(null);
    refresh();
  };

  const now = Date.now();
  return (
    <div className="space-y-7">
      <form onSubmit={createSet} className="rounded-2xl p-4 sm:p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2"><Radio className="w-5 h-5 text-red-400" /><h3 className="font-black text-white">Programar set radial</h3></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="Nombre del programa" className="bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
          <input value={form.host_name} onChange={e => setForm(v => ({ ...v, host_name: e.target.value }))} placeholder="Host" className="bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
          <label className="text-xs text-white/45">Inicio<input required type="datetime-local" value={form.starts_at} onChange={e => setForm(v => ({ ...v, starts_at: e.target.value }))} className="block w-full mt-1 bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
          <label className="text-xs text-white/45">Fin<input required type="datetime-local" min={form.starts_at || undefined} value={form.ends_at} onChange={e => setForm(v => ({ ...v, ends_at: e.target.value }))} className="block w-full mt-1 bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
          <input value={form.artwork_url} onChange={e => setForm(v => ({ ...v, artwork_url: e.target.value }))} placeholder="URL de portada (opcional)" className="sm:col-span-2 bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
          <textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Descripción" rows={2} className="sm:col-span-2 bg-black/25 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white resize-none" />
        </div>
        <button disabled={saving} className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-black flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Programar</button>
      </form>

      <section className="space-y-3">
        <h3 className="font-black text-white">Programación</h3>
        {sets.length === 0 ? <p className="text-sm text-white/35">No hay sets programados.</p> : sets.map(set => {
          const active = new Date(set.starts_at).getTime() <= now && new Date(set.ends_at).getTime() > now;
          return <div key={set.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: active ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.025)', border: `1px solid ${active ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
            <div className="flex-1 min-w-0"><p className="font-bold text-sm text-white truncate">{set.title}{active ? ' · EN VIVO' : ''}</p><p className="text-xs text-white/35 mt-1">{set.host_name || 'Sin host'} · {new Date(set.starts_at).toLocaleString('es-CO')} — {new Date(set.ends_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p></div>
            <span className="flex items-center gap-1 text-xs text-pink-300"><Heart className="w-3.5 h-3.5 fill-current" />{set.likes_count || 0}</span>
            <button type="button" onClick={() => deleteSet(set.id)} disabled={workingId === set.id} className="p-2 text-white/30 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
          </div>;
        })}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-violet-300" /><h3 className="font-black text-white">Preguntas de oyentes</h3></div>
        {questions.length === 0 ? <p className="text-sm text-white/35">No hay preguntas.</p> : questions.map(question => (
          <div key={question.id} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex justify-between gap-3"><div><p className="text-xs font-bold text-violet-200">{question.user_name || 'Oyente'} · {question.show_name}</p><p className="text-sm text-white mt-1">{question.question}</p></div>{question.answered && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}</div>
            {!question.answered && <div className="flex gap-2"><input value={responses[question.id] || ''} onChange={e => setResponses(v => ({ ...v, [question.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') answerQuestion(question); }} placeholder="Responder al usuario…" className="flex-1 bg-black/25 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" /><button type="button" onClick={() => answerQuestion(question)} disabled={workingId === question.id} className="px-3 rounded-xl bg-violet-400/15 text-violet-200 border border-violet-300/20"><Send className="w-4 h-4" /></button></div>}
          </div>
        ))}
      </section>
    </div>
  );
}
