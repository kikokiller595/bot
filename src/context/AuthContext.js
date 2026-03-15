import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncUser = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || !authService.isAuthenticated()) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const freshUser = await authService.getMe();
        if (isMounted) {
          setUser(freshUser);
        }
      } catch (error) {
        authService.logout();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleLogout = () => {
      if (isMounted) {
        setUser(null);
      }
    };

    syncUser();
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    setUser(response.user);
    return response;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isAdmin = () => user?.rol === 'admin';
  const isPuntoVenta = () => user?.rol === 'punto_venta';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin,
        isPuntoVenta,
        isAuthenticated: !!user
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
