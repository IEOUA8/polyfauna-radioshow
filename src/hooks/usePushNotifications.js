import { useState, useEffect, useCallback, useMemo } from 'react';
import supabase from '@/lib/customSupabaseClient';

// La llave pública puede exponerse, pero debe venir del mismo par VAPID que usa send-push.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '')
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function equalApplicationKeys(subscription, expectedKey) {
  const current = subscription?.options?.applicationServerKey;
  if (!current) return true;
  const currentBytes = new Uint8Array(current);
  return currentBytes.length === expectedKey.length
    && currentBytes.every((byte, index) => byte === expectedKey[index]);
}

export function usePushNotifications(userId) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const [error, setError] = useState(null);
  const [standalone, setStandalone] = useState(isStandaloneApp);
  const ios = useMemo(isIOSDevice, []);
  const configured = Boolean(VAPID_PUBLIC_KEY);
  const needsInstall = ios && !standalone;

  const inspectSubscription = useCallback(async () => {
    if (!userId || !swRegistered || !supported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscribed(false);
        return;
      }
      const { count, error: queryError } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
      if (queryError) throw queryError;
      setSubscribed((count ?? 0) > 0);
    } catch (inspectError) {
      setError(inspectError?.message || 'No fue posible revisar la suscripción');
    }
  }, [supported, swRegistered, userId]);

  useEffect(() => {
    setStandalone(isStandaloneApp());
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return;

    setSupported(true);
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => setSwRegistered(true))
      .catch((registrationError) => setError(registrationError?.message || 'No se pudo preparar Push'));
  }, []);

  useEffect(() => {
    inspectSubscription();
  }, [inspectSubscription]);

  useEffect(() => {
    const refreshState = () => {
      setStandalone(isStandaloneApp());
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
      inspectSubscription();
    };
    document.addEventListener('visibilitychange', refreshState);
    return () => document.removeEventListener('visibilitychange', refreshState);
  }, [inspectSubscription]);

  const subscribe = useCallback(async () => {
    if (!configured) {
      setError('Falta configurar la llave pública VAPID');
      return false;
    }
    if (needsInstall) {
      window.dispatchEvent(new CustomEvent('polyfauna-show-install', { detail: { notifications: true } }));
      return false;
    }
    if (!supported || !userId) return false;

    setLoading(true);
    setError(null);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        if (nextPermission === 'denied') setError('El permiso fue bloqueado en el navegador');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !equalApplicationKeys(subscription, applicationServerKey)) {
        await supabase.from('push_subscriptions').delete()
          .eq('user_id', userId).eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const key = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (!key || !auth) throw new Error('El navegador no entregó las llaves de la suscripción');

      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
        auth_key: btoa(String.fromCharCode(...new Uint8Array(auth))),
      }, { onConflict: 'user_id,endpoint' });
      if (saveError) throw saveError;

      setSubscribed(true);
      return true;
    } catch (subscribeError) {
      setSubscribed(false);
      setError(subscribeError?.message || 'No fue posible activar las notificaciones');
      return false;
    } finally {
      setLoading(false);
    }
  }, [configured, needsInstall, supported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !userId) return false;
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const { error: deleteError } = await supabase.from('push_subscriptions').delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
        if (deleteError) throw deleteError;
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (unsubscribeError) {
      setError(unsubscribeError?.message || 'No fue posible desactivar las notificaciones');
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  const sendTest = useCallback(async () => {
    if (!subscribed || !userId) throw new Error('Activa Push antes de enviar una prueba');
    setTesting(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-push', {
        body: {
          userId,
          persist: false,
          notificationType: 'system',
          title: 'Push de prueba · POLYFAUNA',
          body: 'La conexión con este dispositivo está funcionando.',
          url: `${window.location.origin}/?section=settings`,
          tag: `polyfauna-test-${Date.now()}`,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.sent) throw new Error('El servidor no encontró una suscripción activa para este dispositivo');
      return data;
    } catch (testError) {
      setError(testError?.message || 'No fue posible enviar la prueba');
      throw testError;
    } finally {
      setTesting(false);
    }
  }, [subscribed, userId]);

  const status = !configured
    ? 'misconfigured'
    : needsInstall
      ? 'needs-install'
      : !supported
        ? 'unsupported'
        : permission === 'denied'
          ? 'blocked'
          : subscribed
            ? 'subscribed'
            : 'available';

  return {
    supported,
    permission,
    subscribed,
    loading,
    testing,
    error,
    status,
    ios,
    standalone,
    needsInstall,
    subscribe,
    unsubscribe,
    toggle: subscribed ? unsubscribe : subscribe,
    sendTest,
    openInstallGuide: () => window.dispatchEvent(
      new CustomEvent('polyfauna-show-install', { detail: { notifications: true } }),
    ),
  };
}
