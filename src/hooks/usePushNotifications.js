import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';

// The VAPID public key is safe to expose in the browser.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  || 'BOcrLjXe3bdPEc7kZV3XTEYbxOTQxGACDwiIzHTM6RB7Z39KE-NzTQINgpyidJ1n0thI--vXJpWCsfF8kiIEv34';

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw      = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId) {
  const [supported,    setSupported]    = useState(false);
  const [permission,   setPermission]   = useState('default');
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  // Register service worker and detect initial state
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        setSwRegistered(true);
        if (Notification.permission === 'granted') {
          const sub = await reg.pushManager.getSubscription();
          setSubscribed(!!sub);
        }
      })
      .catch(console.error);
  }, []);

  // Check if user already has a subscription stored
  useEffect(() => {
    if (!userId || !swRegistered) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setSubscribed(false); return; }
      const { count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);
      setSubscribed((count ?? 0) > 0);
    });
  }, [userId, swRegistered]);

  const subscribe = useCallback(async () => {
    if (!supported || !userId) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:     true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const key  = sub.getKey('p256dh');
      const auth = sub.getKey('auth');

      await supabase.from('push_subscriptions').upsert({
        user_id:  userId,
        endpoint: sub.endpoint,
        p256dh:   btoa(String.fromCharCode(...new Uint8Array(key))),
        auth_key: btoa(String.fromCharCode(...new Uint8Array(auth))),
      }, { onConflict: 'user_id,endpoint' });

      setSubscribed(true);
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !userId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  const toggle = subscribed ? unsubscribe : subscribe;

  return { supported, permission, subscribed, loading, toggle };
}
