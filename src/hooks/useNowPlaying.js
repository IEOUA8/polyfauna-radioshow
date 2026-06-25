import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_AZURACAST_API || 'http://72.60.121.90:8880/api';
const STATION = import.meta.env.VITE_AZURACAST_STATION || 'polyfauna';
const FALLBACK_ART = 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop';
const REFRESH_INTERVAL_MS = 15000;
const RETRY_INTERVAL_MS = 30000;

const defaultNowPlaying = {
  song: null,
  isOnline: false,
  listeners: 0,
  isLive: false,
  streamerName: '',
  lastUpdatedAt: null,
  isStale: false,
};

const defaultMetrics = {
  endpoint: 'static',
  requestCount: 0,
  lastFetchAt: null,
  lastErrorAt: null,
  isStale: false,
};

const NowPlayingContext = createContext({
  ...defaultNowPlaying,
  metrics: defaultMetrics,
  refreshNowPlaying: async () => false,
});

function normalizeSong(data) {
  const song = data.now_playing?.song;

  if (!song || !data.is_online) return null;

  return {
    title: song.title || 'PolyFauna Radio',
    artist: song.artist || '',
    album: song.album || '',
    art: song.art && !song.art.includes('generic_song') ? song.art : FALLBACK_ART,
  };
}

function normalizeNowPlaying(data) {
  return {
    song: normalizeSong(data),
    isOnline: data.is_online ?? false,
    listeners: data.listeners?.current ?? 0,
    isLive: data.live?.is_live ?? false,
    streamerName: data.live?.streamer_name ?? '',
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NowPlaying request failed: ${response.status}`);
  return response.json();
}

async function requestNowPlaying() {
  try {
    const data = await fetchJson(`${API_BASE}/nowplaying_static/${STATION}.json`);
    return { data, endpoint: 'static' };
  } catch (_) {
    const data = await fetchJson(`${API_BASE}/nowplaying/${STATION}`);
    return { data, endpoint: 'dynamic' };
  }
}

function publishFetchMetric(detail) {
  if (typeof window === 'undefined') return;
  if (typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('polyfauna:nowplaying-fetch', { detail }));
  }
}

export function NowPlayingProvider({ children }) {
  const [nowPlaying, setNowPlaying] = useState(defaultNowPlaying);
  const [metrics, setMetrics] = useState(defaultMetrics);

  const refreshNowPlaying = useCallback(async () => {
    try {
      const { data, endpoint } = await requestNowPlaying();
      const fetchedAt = new Date().toISOString();

      setNowPlaying({
        ...normalizeNowPlaying(data),
        lastUpdatedAt: fetchedAt,
        isStale: false,
      });
      setMetrics((current) => ({
        endpoint,
        requestCount: current.requestCount + 1,
        lastFetchAt: fetchedAt,
        lastErrorAt: current.lastErrorAt,
        isStale: false,
      }));
      publishFetchMetric({ endpoint, fetchedAt });
      return true;
    } catch (_) {
      const failedAt = new Date().toISOString();

      setNowPlaying((current) => ({ ...current, isStale: true }));
      setMetrics((current) => ({
        ...current,
        requestCount: current.requestCount + 1,
        lastErrorAt: failedAt,
        isStale: true,
      }));
      publishFetchMetric({ endpoint: 'unavailable', failedAt });
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timerId;

    const schedule = (delay) => {
      timerId = window.setTimeout(run, delay);
    };

    const run = async () => {
      const ok = await refreshNowPlaying();
      if (active) schedule(ok ? REFRESH_INTERVAL_MS : RETRY_INTERVAL_MS);
    };

    run();

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [refreshNowPlaying]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__polyfaunaNowPlayingMetrics = metrics;
    }
  }, [metrics]);

  const value = useMemo(() => ({
    ...nowPlaying,
    metrics,
    refreshNowPlaying,
  }), [metrics, nowPlaying, refreshNowPlaying]);

  return React.createElement(NowPlayingContext.Provider, { value }, children);
}

export function useNowPlaying() {
  return useContext(NowPlayingContext);
}
