import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_AZURACAST_API || 'http://72.60.121.90:8880/api';
const STATION = import.meta.env.VITE_AZURACAST_STATION || 'polyfauna';
const FALLBACK_ART = 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop';

export function useNowPlaying() {
  const [song, setSong] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [listeners, setListeners] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [streamerName, setStreamerName] = useState('');

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const res = await fetch(`${API_BASE}/nowplaying/${STATION}`);
        if (!res.ok) return;
        const data = await res.json();

        setIsOnline(data.is_online ?? false);
        setListeners(data.listeners?.current ?? 0);
        setIsLive(data.live?.is_live ?? false);
        setStreamerName(data.live?.streamer_name ?? '');

        const s = data.now_playing?.song;
        if (s && data.is_online) {
          setSong({
            title: s.title || 'PolyFauna Radio',
            artist: s.artist || '',
            album: s.album || '',
            art: s.art && !s.art.includes('generic_song') ? s.art : FALLBACK_ART,
          });
        } else {
          setSong(null);
        }
      } catch {
        // silent fail — last known state persists
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 15000);
    return () => clearInterval(interval);
  }, []);

  return { song, isOnline, listeners, isLive, streamerName };
}
