import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const READ_KEY = 'pf_notif_read_v2';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NotificationsContext = createContext(null);

function storageKey(userId) {
  return `${READ_KEY}:${userId || 'guest'}`;
}

function getReadIds(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(storageKey(userId)) || '[]')); }
  catch { return new Set(); }
}

function saveReadIds(userId, set) {
  localStorage.setItem(storageKey(userId), JSON.stringify([...set]));
}

export function NotificationProvider({ children }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || null;
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => getReadIds(userId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setReadIds(getReadIds(userId));
  }, [userId]);

  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [podRes, eventRes, blogRes, albumRes, dbRes, readsRes] = await Promise.all([
        supabase
          .from('podcasts')
          .select('id, title, cover_url, created_at, artists:artists!podcasts_artist_id_fkey(name)')
          .eq('is_public', true)
          .eq('creator_is_public', true)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('events')
          .select('id, title, image_url, date, venue')
          .eq('is_public', true)
          .eq('creator_is_public', true)
          .gte('date', now)
          .lte('date', sevenDaysLater)
          .order('date', { ascending: true })
          .limit(3),
        supabase
          .from('blog_articles')
          .select('id, title, featured_image_url, created_at, category')
          .eq('is_public', true)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(2),
        supabase
          .from('albums')
          .select('id, title, cover_url, created_at, artists:artists!albums_artist_id_fkey(name)')
          .eq('is_public', true)
          .eq('creator_is_public', true)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(3),
        // RLS limita a las propias (user_id = auth.uid()) o globales (user_id IS NULL).
        supabase
          .from('notifications')
          .select('id, type, title, body, image_url, action_section, action_id, action_url, tag, created_at')
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(30),
        userId
          ? supabase.from('notification_reads').select('notification_id').eq('user_id', userId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const queryError = [podRes, eventRes, blogRes, albumRes, dbRes, readsRes]
        .map((result) => result.error)
        .find(Boolean);
      if (queryError) throw queryError;

      if (readsRes.data?.length) {
        setReadIds((previous) => {
          const next = new Set([...previous, ...readsRes.data.map((row) => row.notification_id)]);
          saveReadIds(userId, next);
          return next;
        });
      }

      const notifs = [];
      (dbRes.data || []).forEach((notification) => {
        notifs.push({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          time: notification.created_at,
          image: notification.image_url,
          section: notification.action_section,
          actionId: notification.action_id,
          actionUrl: notification.action_url,
          tag: notification.tag,
          persisted: true,
        });
      });

      (podRes.data || []).forEach((podcast) => {
        notifs.push({
          id: `podcast-${podcast.id}`,
          type: 'podcast',
          title: 'Nuevo podcast disponible',
          body: podcast.title + (podcast.artists?.name ? ` — ${podcast.artists.name}` : ''),
          time: podcast.created_at,
          image: podcast.cover_url,
          section: 'podcasts',
          actionId: podcast.id,
        });
      });

      (eventRes.data || []).forEach((event) => {
        const dateStr = new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        notifs.push({
          id: `event-${event.id}`,
          type: 'event',
          title: 'Evento próximo',
          body: event.title + (event.venue ? ` · ${event.venue}` : '') + ` — ${dateStr}`,
          time: event.date,
          image: event.image_url,
          section: 'events',
          actionId: event.id,
        });
      });

      (blogRes.data || []).forEach((article) => {
        notifs.push({
          id: `blog-${article.id}`,
          type: 'blog',
          title: 'Nuevo artículo',
          body: article.title,
          time: article.created_at,
          image: article.featured_image_url,
          section: 'blog',
          actionId: article.id,
        });
      });

      (albumRes.data || []).forEach((album) => {
        notifs.push({
          id: `album-${album.id}`,
          type: 'music',
          title: 'Nuevo lanzamiento',
          body: album.title + (album.artists?.name ? ` — ${album.artists.name}` : ''),
          time: album.created_at,
          image: album.cover_url,
          section: 'music',
          actionId: album.id,
        });
      });

      const unique = new Map();
      notifs.forEach((notification) => {
        const semanticKey = notification.actionId
          ? `${notification.section || notification.type}:${notification.actionId}`
          : notification.id;
        const existing = unique.get(semanticKey);
        if (!existing || notification.persisted) unique.set(semanticKey, notification);
      });

      setNotifications([...unique.values()].sort((a, b) => new Date(b.time) - new Date(a.time)));
    } catch (fetchError) {
      setError(fetchError?.message || 'No fue posible actualizar las notificaciones');
      if (!silent) setNotifications([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel(`notification-center:${userId || 'guest'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications({ silent: true });
      });

    if (userId) {
      channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications({ silent: true }));
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, userId]);

  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications({ silent: true });
    };
    document.addEventListener('visibilitychange', refreshVisible);
    return () => document.removeEventListener('visibilitychange', refreshVisible);
  }, [fetchNotifications]);

  const markRead = useCallback(async (id) => {
    setReadIds((previous) => {
      const next = new Set([...previous, id]);
      saveReadIds(userId, next);
      return next;
    });

    if (userId && UUID_RE.test(id)) {
      const { error: readError } = await supabase.from('notification_reads').upsert({
        notification_id: id,
        user_id: userId,
        read_at: new Date().toISOString(),
      }, { onConflict: 'notification_id,user_id' });
      if (readError) setError(readError.message);
    }
  }, [userId]);

  const markAllRead = useCallback(async (ids) => {
    setReadIds((previous) => {
      const next = new Set([...previous, ...ids]);
      saveReadIds(userId, next);
      return next;
    });

    const persistentIds = ids.filter((id) => UUID_RE.test(id));
    if (userId && persistentIds.length > 0) {
      const readAt = new Date().toISOString();
      const { error: readError } = await supabase.from('notification_reads').upsert(
        persistentIds.map((notificationId) => ({
          notification_id: notificationId,
          user_id: userId,
          read_at: readAt,
        })),
        { onConflict: 'notification_id,user_id' },
      );
      if (readError) setError(readError.message);
    }
  }, [userId]);

  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length;

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const updateBadge = unreadCount > 0
      ? navigator.setAppBadge(unreadCount)
      : navigator.clearAppBadge?.();
    Promise.resolve(updateBadge).catch(() => {});
  }, [unreadCount]);

  const value = useMemo(() => ({
    notifications,
    loading,
    error,
    unreadCount,
    isRead: (id) => readIds.has(id),
    markRead,
    markAllRead,
    refetch: fetchNotifications,
  }), [notifications, loading, error, unreadCount, readIds, markRead, markAllRead, fetchNotifications]);

  return React.createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  return context;
}
