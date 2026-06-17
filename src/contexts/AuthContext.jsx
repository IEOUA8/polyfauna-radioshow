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

  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setCurrentUser(data);
      setUserRole(data?.role || 'user');
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await fetchUserProfile(session.user.id);
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
      if (session?.user) {
        await fetchUserProfile(session.user.id);
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
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "Welcome to Radio Eje. You're now logged in.",
      });

      return { data, error: null };
    } catch (err) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: err.message,
      });
      return { data: null, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });

      return { data, error: null };
    } catch (err) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: err.message,
      });
      return { data: null, error: err };
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

      toast({
        title: "Logged out",
        description: "See you soon!",
      });

      return { error: null };
    } catch (err) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: err.message,
      });
      return { error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const value = {
    currentUser,
    userRole,
    isLoading,
    error,
    signup,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};