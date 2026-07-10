import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null); // { modules: {}, special: [] }
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);

        // Carrega o perfil de permissões do usuário (admins ignoram — têm acesso total).
        if (currentUser?.role !== 'admin' && currentUser?.profile_key) {
          try {
            const profiles = await base44.entities.Profile.filter({ key: currentUser.profile_key });
            const p = profiles?.[0];
            setPermissions({
              modules: p?.module_permissions || {},
              special: p?.special_permissions || [],
            });
          } catch {
            setPermissions({ modules: {}, special: [] });
          }
        } else {
          setPermissions(null); // admin ou sem perfil -> resolvido por isAdmin
        }
      } else {
        setUser(null);
        setPermissions(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setPermissions(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const isAdmin = user?.role === 'admin';

  // Verifica permissão de módulo (ex.: hasModule('reports', 'view')).
  const hasModule = useCallback((moduleKey, action = 'view') => {
    if (isAdmin) return true;
    const actions = permissions?.modules?.[moduleKey];
    return Array.isArray(actions) && actions.includes(action);
  }, [isAdmin, permissions]);

  // Verifica permissão especial (ex.: hasSpecial('access_financial_data')).
  const hasSpecial = useCallback((key) => {
    if (isAdmin) return true;
    return Array.isArray(permissions?.special) && permissions.special.includes(key);
  }, [isAdmin, permissions]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      isAdmin,
      hasModule,
      hasSpecial,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
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