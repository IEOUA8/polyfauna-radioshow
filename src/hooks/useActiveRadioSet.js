import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useActiveRadioSet() {
  const { currentUser } = useAuth();
  const [radioSet, setRadioSet] = useState(null);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('radio_sets')
      .select('id, title, host_name, description, artwork_url, starts_at, ends_at, likes_count')
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Unable to load active radio set:', error);
      setRadioSet(null);
      setLiked(false);
      setLoading(false);
      return;
    }

    setRadioSet(data || null);
    if (data?.id && currentUser?.id) {
      const { data: ownLike } = await supabase
        .from('radio_set_likes')
        .select('set_id')
        .eq('set_id', data.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      setLiked(Boolean(ownLike));
    } else {
      setLiked(false);
    }
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const toggleLike = useCallback(async () => {
    if (!currentUser?.id || !radioSet?.id) return { error: new Error('No hay set activo o sesión iniciada.') };
    const nextLiked = !liked;
    setLiked(nextLiked);
    setRadioSet(current => current ? {
      ...current,
      likes_count: Math.max(0, Number(current.likes_count || 0) + (nextLiked ? 1 : -1)),
    } : current);

    const result = nextLiked
      ? await supabase.from('radio_set_likes').insert({ set_id: radioSet.id, user_id: currentUser.id })
      : await supabase.from('radio_set_likes').delete().eq('set_id', radioSet.id).eq('user_id', currentUser.id);
    if (result.error) await refresh();
    return result;
  }, [currentUser?.id, liked, radioSet?.id, refresh]);

  return { radioSet, liked, loading, toggleLike, refresh };
}

