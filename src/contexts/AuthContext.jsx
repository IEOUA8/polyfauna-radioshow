import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext(undefined);

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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
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
        await fetchUserProfile(session.user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signup = useCallback(async (email, password, name) => {
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
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
    <AuthContext.Provider value={{ currentUser, userRole, isLoading, error, signup, login, logout, recoveryMode, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
