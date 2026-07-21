import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useProfile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!currentUser) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    if (error) console.error('Error fetching profile:', error);
    setProfile(data);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleProfileUpdated = (event) => {
      if (event.detail?.id === currentUser?.id) setProfile(event.detail);
    };
    window.addEventListener('pf:profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('pf:profile-updated', handleProfileUpdated);
  }, [currentUser?.id]);

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
