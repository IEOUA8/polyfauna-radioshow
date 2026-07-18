import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Search, ShieldCheck } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const SOURCES = [
  {
    entityType: 'artists',
    group: 'profiles',
    fallbackLabel: 'Perfil artístico',
    // La vista excluye las fichas espejo de cuentas promoter/club, que ya
    // aparecen una sola vez en organizers.
    query: () => supabase.from('artists_public')
      .select('id, name, type, image_url, is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.name,
    subtitle: (row) => ({ label: 'label', collective: 'colectivo', artist: 'artista' }[row.type] || row.type || 'artista'),
    image: (row) => row.image_url,
  },
  {
    entityType: 'organizers',
    group: 'profiles',
    fallbackLabel: 'Organizador',
    query: () => supabase.from('organizers')
      .select('id, name, type, image_url, city, is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.name,
    subtitle: (row) => [row.type, row.city].filter(Boolean).join(' · '),
    image: (row) => row.image_url,
  },
  {
    entityType: 'blog_articles',
    group: 'content',
    fallbackLabel: 'Artículo',
    query: () => supabase.from('blog_articles')
      .select('id, title, category, cover_url, featured_image_url, is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.title,
    subtitle: (row) => row.category || 'Artículo',
    image: (row) => row.cover_url || row.featured_image_url,
  },
  {
    entityType: 'podcasts',
    group: 'content',
    fallbackLabel: 'Podcast',
    query: () => supabase.from('podcasts')
      .select('id, title, genre, cover_url, is_public, creator_is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.title,
    subtitle: (row) => row.genre || 'Podcast',
    image: (row) => row.cover_url,
  },
  {
    entityType: 'interviews',
    group: 'content',
    fallbackLabel: 'Entrevista',
    query: () => supabase.from('interviews')
      .select('id, title, subject, image_url, is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.title,
    subtitle: (row) => row.subject || 'Entrevista',
    image: (row) => row.image_url,
  },
  {
    entityType: 'albums',
    group: 'content',
    fallbackLabel: 'Álbum',
    query: () => supabase.from('albums')
      .select('id, title, genre, cover_url, is_public, creator_is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.title,
    subtitle: (row) => row.genre || 'Álbum',
    image: (row) => row.cover_url,
  },
  {
    entityType: 'events',
    group: 'content',
    fallbackLabel: 'Evento',
    query: () => supabase.from('events')
      .select('id, title, venue, city, image_url, is_public, creator_is_public, visibility_reason, visibility_changed_at'),
    title: (row) => row.title,
    subtitle: (row) => [row.venue, row.city].filter(Boolean).join(' · ') || 'Evento',
    image: (row) => row.image_url,
  },
];

const ENTITY_LABELS = {
  artists: 'Perfil artístico',
  organizers: 'Promotor / club',
  blog_articles: 'Artículo',
  podcasts: 'Podcast',
  interviews: 'Entrevista',
  albums: 'Álbum',
  events: 'Evento',
};

const isEffectivelyPublic = (item) => item.is_public !== false && item.creator_is_public !== false;

function normalizeItem(source, row) {
  return {
    ...row,
    entityType: source.entityType,
    group: source.group,
    entityLabel: ENTITY_LABELS[source.entityType] || source.fallbackLabel,
    title: source.title(row) || 'Sin nombre',
    subtitle: source.subtitle(row) || source.fallbackLabel,
    imageUrl: source.image(row),
  };
}

const VisibilityManager = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(SOURCES.map((source) => source.query()));
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const nextItems = results.flatMap((result, index) =>
        (result.data || []).map((row) => normalizeItem(SOURCES[index], row))
      );
      nextItems.sort((a, b) => {
        if (isEffectivelyPublic(a) !== isEffectivelyPublic(b)) return isEffectivelyPublic(a) ? 1 : -1;
        return a.title.localeCompare(b.title, 'es');
      });
      setItems(nextItems);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo cargar la visibilidad',
        description: error.code === '42703'
          ? 'Aplica la migración de controles de visibilidad en Supabase.'
          : error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return items.filter((item) => {
      if (group !== 'all' && item.group !== group) return false;
      if (status === 'public' && !isEffectivelyPublic(item)) return false;
      if (status === 'hidden' && isEffectivelyPublic(item)) return false;
      if (!term) return true;
      return `${item.title} ${item.subtitle} ${item.entityLabel}`.toLocaleLowerCase('es').includes(term);
    });
  }, [group, items, search, status]);

  const hiddenCount = items.filter((item) => !isEffectivelyPublic(item)).length;
  const targetWillBePublic = selected?.is_public === false;

  const openVisibilityDialog = (item) => {
    setSelected(item);
    setReason('');
  };

  const closeDialog = () => {
    if (saving) return;
    setSelected(null);
    setReason('');
  };

  const saveVisibility = async () => {
    if (!selected || (!targetWillBePublic && !reason.trim())) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('set_public_visibility', {
        p_entity_type: selected.entityType,
        p_entity_id: selected.id,
        p_is_public: targetWillBePublic,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;

      setItems((current) => current.map((item) => (
        item.entityType === selected.entityType && item.id === selected.id
          ? {
              ...item,
              is_public: data?.is_public ?? targetWillBePublic,
              visibility_reason: data?.visibility_reason ?? (reason.trim() || null),
              visibility_changed_at: data?.visibility_changed_at || new Date().toISOString(),
            }
          : item
      )));
      toast({
        title: targetWillBePublic ? 'Elemento publicado' : 'Elemento ocultado',
        description: targetWillBePublic
          ? selected.creator_is_public === false
            ? `${selected.title} ya no tiene bloqueo administrativo, pero sigue oculto por decisión de su creador.`
            : `${selected.title} vuelve a estar disponible públicamente.`
          : `${selected.title} ya no aparece en la plataforma pública.`,
      });
      setSelected(null);
      setReason('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo cambiar la visibilidad', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total', value: items.length, color: '#d1d5db' },
          { label: 'Públicos', value: items.length - hiddenCount, color: '#22c55e' },
          { label: 'Ocultos', value: hiddenCount, color: '#f59e0b' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{metric.label}</p>
            <p className="mt-1 text-2xl font-black" style={{ color: metric.color }}>{loading ? '—' : metric.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar perfil o contenido…"
            className="h-11 w-full rounded-xl pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/25"
            style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={group} onChange={(event) => setGroup(event.target.value)} className="h-10 rounded-xl px-3 text-xs font-bold text-white outline-none" style={{ background: '#101615', border: '1px solid rgba(255,255,255,0.09)' }}>
            <option value="all">Todo</option>
            <option value="profiles">Perfiles</option>
            <option value="content">Contenidos</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl px-3 text-xs font-bold text-white outline-none" style={{ background: '#101615', border: '1px solid rgba(255,255,255,0.09)' }}>
            <option value="all">Cualquier estado</option>
            <option value="public">Públicos</option>
            <option value="hidden">Ocultos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl py-14 text-center" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm font-bold text-white/50">No hay resultados para estos filtros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const isPublic = isEffectivelyPublic(item);
            const adminPublic = item.is_public !== false;
            const hiddenByCreator = adminPublic && item.creator_is_public === false;
            return (
              <div key={`${item.entityType}:${item.id}`} className="flex items-center gap-3 rounded-2xl p-3 sm:p-4" style={{ background: 'rgba(11,16,15,0.9)', border: `1px solid ${isPublic ? 'rgba(255,255,255,0.07)' : 'rgba(245,158,11,0.25)'}` }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sm font-black text-white/30">{item.title[0]?.toUpperCase()}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-white">{item.title}</p>
                    <span className="hidden rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/35 sm:inline" style={{ background: 'rgba(255,255,255,0.045)' }}>{item.entityLabel}</span>
                  </div>
                  <p className="truncate text-xs text-white/35">{item.subtitle}</p>
                  {!isPublic && item.visibility_reason && <p className="mt-1 truncate text-[10px] text-amber-300/65">Motivo: {item.visibility_reason}</p>}
                </div>
                <span className="hidden rounded-full px-2.5 py-1 text-[10px] font-black sm:block" style={{ color: isPublic ? '#22c55e' : '#f59e0b', background: isPublic ? 'rgba(34,197,94,0.09)' : 'rgba(245,158,11,0.10)' }}>
                  {isPublic ? 'Público' : hiddenByCreator ? 'Oculto por creador' : 'Oculto por admin'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openVisibilityDialog(item)}
                  aria-label={adminPublic ? `Ocultar ${item.title}` : `Restaurar ${item.title}`}
                  title={adminPublic ? 'Aplicar ocultación administrativa' : 'Retirar ocultación administrativa'}
                  className={adminPublic ? 'shrink-0 text-amber-400 hover:text-amber-300' : 'shrink-0 text-green-400 hover:text-green-300'}
                >
                  {adminPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>{targetWillBePublic ? 'Volver a publicar' : 'Ocultar del público'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-black">{selected.title}</p>
                <p className="text-xs text-muted-foreground">{selected.entityLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {targetWillBePublic
                  ? 'El elemento volverá a aparecer en listados, búsquedas y enlaces públicos.'
                  : 'El elemento y su página dejarán de estar disponibles públicamente. No se eliminará ningún dato.'}
              </p>
              <div>
                <Label htmlFor="visibility-reason">{targetWillBePublic ? 'Observación (opcional)' : 'Motivo *'}</Label>
                <textarea
                  id="visibility-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={targetWillBePublic ? 'Ej. Perfil completado y revisado' : 'Ej. Perfil incompleto o penalización temporal'}
                  className="mt-1 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeDialog} disabled={saving}>Cancelar</Button>
                <Button
                  type="button"
                  onClick={saveVisibility}
                  disabled={saving || (!targetWillBePublic && !reason.trim())}
                  className={targetWillBePublic ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-black hover:bg-amber-400'}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {targetWillBePublic ? 'Publicar' : 'Ocultar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisibilityManager;
