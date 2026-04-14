import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_SYNC_THROTTLE_MS = 30000;
const LAST_ACTIVITY_KEY = 'tby_last_activity';

const getLastActivity = () => {
  const rawValue = localStorage.getItem(LAST_ACTIVITY_KEY);
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const isSessionExpired = () => {
  const lastActivity = getLastActivity();
  return Boolean(lastActivity) && Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS;
};

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

        if (isSessionExpired()) {
          authService.logout('inactivity');
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

  useEffect(() => {
    if (!user) {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return undefined;
    }

    let timerId = null;
    let lastSyncAt = 0;

    const ejecutarLogoutPorInactividad = () => {
      authService.logout('inactivity');
      setUser(null);
    };

    const programarRevision = () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      const lastActivity = getLastActivity() || Date.now();
      const tiempoRestante = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivity);

      if (tiempoRestante <= 0) {
        ejecutarLogoutPorInactividad();
        return;
      }

      timerId = window.setTimeout(ejecutarLogoutPorInactividad, tiempoRestante);
    };

    const registrarActividad = (force = false) => {
      const ahora = Date.now();
      if (!force && ahora - lastSyncAt < ACTIVITY_SYNC_THROTTLE_MS) {
        return;
      }

      lastSyncAt = ahora;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(ahora));
      programarRevision();
    };

    const handleStorage = (event) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        programarRevision();
      }

      if (event.key === 'token' && !event.newValue) {
        setUser(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registrarActividad(true);
      }
    };

    registrarActividad(true);

    const eventosActividad = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    eventosActividad.forEach((eventName) => {
      window.addEventListener(eventName, registrarActividad, { passive: true });
    });
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      eventosActividad.forEach((eventName) => {
        window.removeEventListener(eventName, registrarActividad);
      });
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [user]);

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
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
