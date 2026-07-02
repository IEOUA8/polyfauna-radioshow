import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useLikes() {
  const { currentUser } = useAuth();
  const [liked, setLiked] = useState([]);

  const fetch = useCallback(async () => {
    if (!currentUser) { setLiked([]); return; }
    const { data } = await supabase
      .from('user_likes')
      .select('podcast_id')
      .eq('user_id', currentUser.id);
    setLiked((data ?? []).map(r => r.podcast_id));
  }, [currentUser?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const isLiked = (id) => liked.includes(id);

  const toggle = async (podcastId) => {
    if (!currentUser) return;
    if (isLiked(podcastId)) {
      await supabase.from('user_likes')
        .delete().eq('user_id', currentUser.id).eq('podcast_id', podcastId);
      setLiked(prev => prev.filter(id => id !== podcastId));
    } else {
      await supabase.from('user_likes')
        .insert({ user_id: currentUser.id, podcast_id: podcastId });
      setLiked(prev => [...prev, podcastId]);
    }
  };

  return { liked, isLiked, toggle };
}
