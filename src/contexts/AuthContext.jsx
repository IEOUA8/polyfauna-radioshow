import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext(undefined);
const PENDING_OAUTH_ROLE_KEY = 'polyfauna.pendingOAuthRole';

function getOauthRedirect(nextPath = '/') {
  if (typeof window === 'undefined') return undefined;
  const safePath = nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  return `${window.location.origin}${safePath}`;
}

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const fetchUserProfile = useCallback(async (authUser) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

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
          requested_role: role,
          form_data: {
            name: displayName,
            source: 'oauth',
            provider: authUser.app_metadata?.provider || 'social',
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await consumePendingOAuthRole(session.user);
          await fetchUserProfile(session.user);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setIsLoading(false);
        return;
      }
      setRecoveryMode(false);
      if (session?.user) {
        await consumePendingOAuthRole(session.user);
        await fetchUserProfile(session.user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [consumePendingOAuthRole, fetchUserProfile]);

  const signup = useCallback(async (email, password, name, role = 'citizen') => {
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, requested_role: role } },
      });
      if (error) throw error;

      // The database trigger creates the request even when email confirmation
      // means Supabase has not issued a session yet.
      if (role !== 'citizen' && data?.session) {
        const { data: roleRequest } = await supabase
          .from('role_requests')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (roleRequest?.id) {
          supabase.functions.invoke('send-role-request', {
            body: { requestId: roleRequest.id },
          }).catch(() => {});
        }
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
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      toast({ title: 'Contraseña actualizada', description: 'Inicia sesión con tu nueva contraseña.' });
      setRecoveryMode(false);
      await supabase.auth.signOut();
    } else {
      toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message });
    }
    setIsLoading(false);
    return { error };
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
    <AuthContext.Provider value={{ currentUser, userRole, isLoading, error, signup, login, signInWithProvider, logout, recoveryMode, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
