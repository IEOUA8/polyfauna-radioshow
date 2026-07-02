import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';

const READ_KEY = 'pf_notif_read_v1';

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveReadIds(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [podRes, eventRes, blogRes] = await Promise.all([
        supabase
          .from('podcasts')
          .select('id, title, cover_url, created_at, artists(name)')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('events')
          .select('id, title, image_url, date, venue')
          .gte('date', now)
          .lte('date', sevenDaysLater)
          .order('date', { ascending: true })
          .limit(3),
        supabase
          .from('blog_articles')
          .select('id, title, featured_image_url, created_at, category')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(2),
      ]);

      const notifs = [];

      (podRes.data || []).forEach(p => {
        notifs.push({
          id: `podcast-${p.id}`,
          type: 'podcast',
          title: 'Nuevo podcast disponible',
          body: p.title + (p.artists?.name ? ` — ${p.artists.name}` : ''),
          time: p.created_at,
          image: p.cover_url,
          section: 'podcasts',
        });
      });

      (eventRes.data || []).forEach(ev => {
        const dateStr = new Date(ev.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        notifs.push({
          id: `event-${ev.id}`,
          type: 'event',
          title: `Evento próximo`,
          body: ev.title + (ev.venue ? ` · ${ev.venue}` : '') + ` — ${dateStr}`,
          time: ev.date,
          image: ev.image_url,
          section: 'events',
        });
      });

      (blogRes.data || []).forEach(a => {
        notifs.push({
          id: `blog-${a.id}`,
          type: 'blog',
          title: 'Nuevo artículo',
          body: a.title,
          time: a.created_at,
          image: a.featured_image_url,
          section: 'blog',
        });
      });

      notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
      setNotifications(notifs);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set([...prev, id]);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids) => {
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      saveReadIds(next);
      return next;
    });
  }, []);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  return {
    notifications,
    loading,
    unreadCount,
    isRead: (id) => readIds.has(id),
    markRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
