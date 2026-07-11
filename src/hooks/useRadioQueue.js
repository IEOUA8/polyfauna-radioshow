import { useEffect, useState, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';

const POLL_INTERVAL_MS = 60_000;

export function useRadioQueue() {
  const [queue, setQueue] = useState([]);
  const [syncedAt, setSyncedAt] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('radio_queue_cache')
      .select('queue, synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setQueue(data?.queue || []);
    setSyncedAt(data?.synced_at || null);
  }, []);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  return { queue, syncedAt };
}
