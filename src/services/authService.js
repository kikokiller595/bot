import api from './api';
import { extractData, normalizeUser, normalizeUsers } from './normalizers';

const LOGOUT_REASON_KEY = 'tby_logout_reason';

const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });

    if (response.data.success) {
      const user = normalizeUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.removeItem(LOGOUT_REASON_KEY);
      return {
        ...response.data,
        user
      };
    }

    throw new Error('Error en el login');
  },

  logout: (reason = 'manual') => {
    localStorage.setItem(LOGOUT_REASON_KEY, reason);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason } }));
    }
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }

    try {
      return normalizeUser(JSON.parse(userStr));
    } catch (error) {
      return null;
    }
  },

  isAuthenticated: () => !!localStorage.getItem('token'),

  getMe: async () => {
    const response = await api.get('/auth/me');
    const user = normalizeUser(extractData(response.data));
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return normalizeUser(extractData(response.data));
  },

  getUsuarios: async () => {
    const response = await api.get('/auth/usuarios');
    return normalizeUsers(extractData(response.data));
  },

  updateUsuario: async (id, userData) => {
    const response = await api.put(`/auth/usuarios/${id}`, userData);
    return normalizeUser(extractData(response.data));
  },

  deleteUsuario: async (id) => {
    const response = await api.delete(`/auth/usuarios/${id}`);
    return response.data;
  },

  consumeLogoutReason: () => {
    const reason = localStorage.getItem(LOGOUT_REASON_KEY);
    localStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
  }
};

export default authService;
