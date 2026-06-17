import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useProfile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!currentUser) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    setProfile(data);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updateProfile = async (updates) => {
    if (!currentUser) return { error: 'No autenticado' };
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: currentUser.id, ...updates })
      .select()
      .single();
    if (!error) setProfile(data);
    return { data, error };
  };

  return { profile, loading, refetch: fetchProfile, updateProfile };
}
