import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext(undefined);
const PENDING_OAUTH_ROLE_KEY = 'polyfauna.pendingOAuthRole';

function getOauthRedirect(nextPath = '/') {
  if (typeof window === 'undefined') return undefined;
  const safePath = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  return `${window.location.origin}${safePath}`;
}

// Una llamada de red que nunca resuelve (comun en movil con señal
// inestable) deja colgada cualquier promesa que la espere — ningun
// try/catch/finally salva eso, porque "finally" tampoco corre hasta que
// la promesa se resuelve o rechaza. Este timeout le pone un limite para
// que la UI siempre pueda desbloquearse con un error en vez de quedar
// atascada para siempre.
function withTimeout(promise, ms = 15000, message = 'La operación tardó demasiado. Intenta de nuevo.') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// El cliente de Supabase procesa el token del enlace de recuperación durante
// su propia inicialización interna (detectSessionInUrl), que arranca en cuanto
// se crea el cliente — es decir, antes de que este provider llegue a montar y
// suscribirse con onAuthStateChange. Si esa inicialización resuelve primero
// (variable según qué tan rápido carga/parsea el JS en cada dispositivo), el
// evento PASSWORD_RECOVERY se emite sin nadie escuchando y se pierde para
// siempre: el usuario ve el login normal, "atascado" en Ingresando… mientras
// isLoading se resuelve. Leer el hash/query directamente en el primer render
// evita depender de ganar esa carrera.
function isRecoveryUrl() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
}

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recoveryMode, setRecoveryModeState] = useState(isRecoveryUrl);
  const recoveryModeRef = useRef(isRecoveryUrl());
  const setRecoveryMode = useCallback((value) => {
    recoveryModeRef.current = value;
    setRecoveryModeState(value);
  }, []);
  // ResetPasswordView llama esto recien despues de mostrar la confirmacion
  // de "contraseña actualizada" — updatePassword() ya no apaga recoveryMode
  // por su cuenta apenas termina, porque hacerlo de inmediato disparaba el
  // efecto de LoginPage que redirige en cuanto currentUser existe y
  // recoveryMode es false, saltandose la confirmacion visual.
  const exitRecoveryMode = useCallback(() => setRecoveryMode(false), [setRecoveryMode]);
  const [justVerified, setJustVerified] = useState(false);
  const clearJustVerified = useCallback(() => setJustVerified(false), []);
  const roleNotificationIds = useRef(new Set());

  const fetchUserProfile = useCallback(async (authUser) => {
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      // .single() no lanza excepcion en un error de Supabase (RLS, red, etc.),
      // solo la devuelve en `error` — sin este log, un fallo silencioso caia
      // a role 'citizen' sin ningun rastro, ocultando por completo secciones
      // de promoter/club/collective para esa sesion.
      if (profileError) console.error('Error fetching profile:', profileError);

      const profile = data || {};
      setCurrentUser({
        id: authUser.id,
        email: authUser.email,
        ...profile,
      });
      setUserRole(profile.role || 'citizen');
    } catch (err) {
      // Profile might not exist yet on first login — keep auth user active anyway
      setCurrentUser({ id: authUser.id, email: authUser.email });
      setUserRole('citizen');
      console.error('Error fetching profile:', err);
    }
  }, []);

  const consumePendingOAuthRole = useCallback(async (authUser) => {
    if (typeof window === 'undefined' || !authUser?.id) return;
    const role = window.localStorage.getItem(PENDING_OAUTH_ROLE_KEY);
    if (!role || role === 'citizen') {
      window.localStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
      return;
    }

    const requestedRole = role === 'collective' ? 'promoter' : role;
    const organizerType = role === 'collective' ? 'collective' : role === 'promoter' ? 'promoter' : role === 'club' ? 'club' : null;
    if (organizerType) {
      await supabase
        .from('profiles')
        .update({ organizer_type: organizerType })
        .eq('id', authUser.id)
        .is('organizer_type', null);
    }
    const { data: existing } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existing?.id) {
      const displayName = authUser.user_metadata?.name
        || authUser.user_metadata?.full_name
        || authUser.email?.split('@')[0]
        || 'Usuario';
      const { data: request } = await supabase
        .from('role_requests')
        .insert({
          user_id: authUser.id,
          requested_role: requestedRole,
          form_data: {
            name: displayName,
            source: 'oauth',
            provider: authUser.app_metadata?.provider || 'social',
            organizer_type: organizerType,
          },
        })
        .select('id')
        .single();

      if (request?.id) {
        supabase.functions.invoke('send-role-request', {
          body: { requestId: request.id },
        }).catch(() => {});
      }
    }

    window.localStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
  }, []);

  const notifyPendingRoleRequest = useCallback(async (authUser) => {
    if (!authUser?.id) return;
    const { data: roleRequest } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('status', 'pending')
      .is('notification_sent_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roleRequest?.id) {
      if (roleNotificationIds.current.has(roleRequest.id)) return;
      roleNotificationIds.current.add(roleRequest.id);
      supabase.functions.invoke('send-role-request', {
        body: { requestId: roleRequest.id },
      }).catch(() => {
        roleNotificationIds.current.delete(roleRequest.id);
      });
    }
  }, []);

  const hydrateAuthenticatedUser = useCallback(async (authUser) => {
    if (!authUser?.id) return;
    await consumePendingOAuthRole(authUser);
    await notifyPendingRoleRequest(authUser);
    await fetchUserProfile(authUser);
  }, [consumePendingOAuthRole, fetchUserProfile, notifyPendingRoleRequest]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await hydrateAuthenticatedUser(session.user);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // El callback debe permanecer sincrónico: ejecutar consultas de Supabase
    // dentro de onAuthStateChange puede bloquear internamente el cliente. La
    // hidratación se difiere al siguiente ciclo del event loop.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setIsLoading(false);
        return;
      }
        // Supabase puede emitir SIGNED_IN o TOKEN_REFRESHED justo después de
        // PASSWORD_RECOVERY al procesar el mismo enlace de recuperación —
        // sin este guard, ese segundo evento apagaba recoveryMode y el
        // usuario volvía a ver el login normal en vez del formulario de
        // nueva contraseña (quedándose en "Ingresando…" si además fallaba
        // alguna llamada de las de abajo, ver catch/finally).
      if (recoveryModeRef.current && event !== 'SIGNED_OUT') {
        setIsLoading(false);
        return;
      }
      setRecoveryMode(false);
      if (session?.user) {
          // El enlace de confirmación de correo redirige a
          // `${origin}/?verified=1` (ver signup()); si ese parámetro sigue
          // en la URL cuando la sesión recién se establece, es que el
          // usuario acaba de verificar su cuenta — se lo mostramos con un
          // modal en vez de dejarlo aterrizar en la plataforma sin ninguna
          // confirmación visible, y limpiamos la URL para no repetirlo.
        if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('verified') === '1') {
            setJustVerified(true);
            params.delete('verified');
            const newSearch = params.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`);
          }
        }
        setCurrentUser(prev => prev?.id === session.user.id
          ? prev
          : { id: session.user.id, email: session.user.email });
        setIsLoading(false);
        window.setTimeout(() => {
          hydrateAuthenticatedUser(session.user).catch(err => {
            console.error('Error hydrating authenticated user:', err);
          });
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserRole(null);
        setIsLoading(false);
      }
    });

    // iOS/Android pueden congelar JavaScript durante minutos. Al regresar,
    // reconciliamos el token y el perfil sin expulsar al usuario si la red
    // todavía no volvió.
    let reconciling = false;
    const reconcileSession = async () => {
      if (reconciling || document.visibilityState === 'hidden') return;
      reconciling = true;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (session?.user) await hydrateAuthenticatedUser(session.user);
      } catch (err) {
        console.warn('Session resume deferred until connectivity returns:', err);
      } finally {
        reconciling = false;
        setIsLoading(false);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconcileSession();
    };
    window.addEventListener('pageshow', reconcileSession);
    window.addEventListener('focus', reconcileSession);
    window.addEventListener('online', reconcileSession);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pageshow', reconcileSession);
      window.removeEventListener('focus', reconcileSession);
      window.removeEventListener('online', reconcileSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hydrateAuthenticatedUser, setRecoveryMode]);

  const signup = useCallback(async (email, password, name, role = 'citizen') => {
    setError(null);
    setIsLoading(true);
    try {
      const requestedRole = role === 'collective' ? 'promoter' : role;
      const organizerType = role === 'collective' ? 'collective' : role === 'promoter' ? 'promoter' : role === 'club' ? 'club' : null;
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, requested_role: requestedRole, organizer_type: organizerType },
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/?verified=1` : undefined,
          },
        }),
        20000,
        'El registro tardó demasiado. Revisa tu correo antes de volver a intentarlo.'
      );
      if (error) throw error;

      // The database trigger creates the request even when email confirmation
      // means Supabase has not issued a session yet. The function verifies the
      // fresh signup against the auth user before sending either notification.
      if (role !== 'citizen' && data?.user?.id) {
        // La solicitud ya quedó guardada por el trigger de base de datos. El
        // correo es secundario y no debe retener al usuario en el formulario
        // si Resend o la Edge Function están lentos.
        supabase.functions.invoke('send-role-request', {
          body: { userId: data.user.id, email },
        }).then(({ error: notificationError }) => {
          if (!notificationError) return;
          console.error('Role request notification could not be sent:', notificationError);
          toast({
            title: 'Solicitud registrada',
            description: 'La notificación será reintentada cuando inicies sesión.',
          });
        }).catch((notificationError) => {
          console.error('Role request notification could not be sent:', notificationError);
        });
      }

      // Send welcome email
      supabase.functions.invoke('send-welcome', {
        body: { userId: data?.user?.id, name },
      }).catch(() => {});

      toast({ title: '¡Cuenta creada!', description: 'Bienvenido a POLYFAUNA.' });
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Error al registrarse', description: err.message });
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: '¡Bienvenido de vuelta!', description: 'Has iniciado sesión.' });
      return { data, error: null };
    } catch (err) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Error al iniciar sesión', description: err.message });
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const signInWithProvider = useCallback(async (provider, nextPath = '/', role = 'citizen') => {
    setError(null);
    try {
      if (typeof window !== 'undefined') {
        if (role && role !== 'citizen') window.localStorage.setItem(PENDING_OAUTH_ROLE_KEY, role);
        else window.localStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getOauthRedirect(nextPath),
          queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
        },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      if (typeof window !== 'undefined') window.localStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
      setError(err.message);
      toast({ variant: 'destructive', title: 'No se pudo continuar', description: err.message });
      return { data: null, error: err };
    }
  }, [toast]);

  const updatePassword = useCallback(async (newPassword) => {
    setIsLoading(true);
    try {
      const { error } = await withTimeout(supabase.auth.updateUser({ password: newPassword }));
      if (!error) {
        toast({ title: 'Contraseña actualizada', description: 'Ya puedes continuar en la plataforma.' });
        // No se apaga recoveryMode ni se cierra sesión aca: la sesion de
        // recuperacion ya es una sesion valida para este usuario (probo
        // ser el dueño de la cuenta al abrir el enlace del correo), asi
        // que no hace falta forzarlo a loguearse de nuevo. ResetPasswordView
        // llama a exitRecoveryMode() luego de mostrar la confirmacion, para
        // no saltarse ese mensaje con una redireccion instantanea.
      } else {
        toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
      }
      return { error };
    } catch (err) {
      // Sin try/catch (y sin el timeout de arriba), una excepcion o un
      // updateUser() colgado en una red inestable dejaba isLoading
      // atascado en true para siempre — el boton de "Guardar contraseña"
      // se quedaba en "Guardando..." y los campos, deshabilitados.
      toast({ variant: 'destructive', title: 'Error al actualizar', description: err.message });
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCurrentUser(null);
      setUserRole(null);
      toast({ title: 'Sesión cerrada', description: '¡Hasta pronto!' });
      return { error: null };
    } catch (err) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Error al cerrar sesión', description: err.message });
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, isLoading, error, signup, login, signInWithProvider, logout, recoveryMode, updatePassword, exitRecoveryMode, justVerified, clearJustVerified }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
