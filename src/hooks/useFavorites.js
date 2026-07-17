import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export function useFavorites() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentUser) { setFavorites([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', currentUser.id);
    setFavorites(data ?? []);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const isFav = useCallback(
    (type, id) => favorites.some(f => f.item_type === type && f.item_id === id),
    [favorites]
  );

  const toggle = useCallback(async (type, id) => {
    if (!currentUser) return;
    if (isFav(type, id)) {
      const { error } = await supabase.from('user_favorites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('item_type', type)
        .eq('item_id', id);
      if (error) {
        toast({ title: 'No se pudo actualizar', description: error.message, variant: 'destructive' });
        return { error };
      }
      setFavorites(prev => prev.filter(f => !(f.item_type === type && f.item_id === id)));
    } else {
      const { data } = await supabase.from('user_favorites')
        .insert({ user_id: currentUser.id, item_type: type, item_id: id })
        .select().single();
      if (!data) {
        toast({ title: 'No se pudo guardar', description: 'Intenta nuevamente.', variant: 'destructive' });
        return { error: new Error('Favorite insert failed') };
      }
      setFavorites(prev => [...prev, data]);
    }
    return { error: null };
  }, [currentUser, isFav, toast]);

  return { favorites, loading, isFav, toggle, refetch: fetch };
}
