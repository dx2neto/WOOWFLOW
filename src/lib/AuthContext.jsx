import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { auth as supabaseAuth, clearProfileCache } from '@/api/supabaseData';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await supabaseAuth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      return currentUser;
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    // Carrega a sessão atual na montagem.
    loadUser();

    // Escuta mudanças de sessão (login, logout, refresh de token).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      clearProfileCache();
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadUser();
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [loadUser]);

  const logout = useCallback(async () => {
    await supabaseAuth.logout('redirect');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const refreshUser = useCallback(() => loadUser(), [loadUser]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authChecked,
        isAdmin,
        isSuperAdmin,
        logout,
        refreshUser,
        // compat: telas antigas ainda chamam checkUserAuth
        checkUserAuth: loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
