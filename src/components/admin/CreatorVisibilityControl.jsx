import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import supabase from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const CreatorVisibilityControl = ({ entityType, item, ownerId, noun, onChanged }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const creatorPublic = item.creator_is_public !== false;
  const adminPublic = item.is_public !== false;
  const canManage = Boolean(currentUser?.id && ownerId === currentUser.id);
  const nextPublic = !creatorPublic;

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('set_creator_visibility', {
        p_entity_type: entityType,
        p_entity_id: item.id,
        p_is_public: nextPublic,
      });
      if (error) throw error;
      onChanged?.(data || {
        ...item,
        creator_is_public: nextPublic,
        creator_visibility_changed_at: new Date().toISOString(),
      });
      toast({
        title: nextPublic ? `${noun} publicado` : `${noun} ocultado`,
        description: nextPublic
          ? `Tu ${noun.toLocaleLowerCase('es')} vuelve a estar disponible públicamente.`
          : `Tu ${noun.toLocaleLowerCase('es')} ya no aparece en la plataforma pública.`,
      });
      setOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo cambiar la visibilidad', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const status = !adminPublic
    ? { label: 'Oculto por administración', color: '#f87171' }
    : !creatorPublic
      ? { label: canManage ? 'Oculto por ti' : 'Oculto por creador', color: '#f59e0b' }
      : { label: 'Público', color: '#22c55e' };

  return (
    <>
      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <span
          className="hidden rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex"
          style={{ color: status.color, background: `${status.color}14`, border: `1px solid ${status.color}28` }}
        >
          {status.label}
        </span>
        {canManage && adminPublic && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className={creatorPublic ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'}
            title={creatorPublic ? 'Ocultar del público' : 'Volver a publicar'}
            aria-label={creatorPublic ? `Ocultar ${noun}` : `Publicar ${noun}`}
          >
            {creatorPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) setOpen(nextOpen); }}>
        <DialogContent className="max-w-md border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>{nextPublic ? `Publicar ${noun.toLocaleLowerCase('es')}` : `Ocultar ${noun.toLocaleLowerCase('es')}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {nextPublic
                ? `Tu ${noun.toLocaleLowerCase('es')} volverá a aparecer en la plataforma pública.`
                : `Tu ${noun.toLocaleLowerCase('es')} dejará de aparecer públicamente, pero conservará todos sus datos y podrás restaurarlo cuando quieras.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button
                type="button"
                onClick={save}
                disabled={saving}
                className={nextPublic ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-black hover:bg-amber-400'}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {nextPublic ? 'Publicar' : 'Ocultar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatorVisibilityControl;
