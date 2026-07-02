import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useFavorites() {
  const { currentUser } = useAuth();
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

  const isFav = (type, id) => favorites.some(f => f.item_type === type && f.item_id === id);

  const toggle = async (type, id) => {
    if (!currentUser) return;
    if (isFav(type, id)) {
      await supabase.from('user_favorites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('item_type', type)
        .eq('item_id', id);
      setFavorites(prev => prev.filter(f => !(f.item_type === type && f.item_id === id)));
    } else {
      const { data } = await supabase.from('user_favorites')
        .insert({ user_id: currentUser.id, item_type: type, item_id: id })
        .select().single();
      if (data) setFavorites(prev => [...prev, data]);
    }
  };

  return { favorites, loading, isFav, toggle, refetch: fetch };
}
