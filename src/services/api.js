import axios from 'axios';

const normalizeBaseUrl = (value, fallback) => {
  const base = (value || fallback || '').trim().replace(/\/+$/, '');
  return base;
};

const rawApiUrl = normalizeBaseUrl(
  process.env.REACT_APP_API_URL,
  'http://localhost:5000/api'
);

const API_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl}/api`;

const BACKEND_URL = normalizeBaseUrl(
  process.env.REACT_APP_BACKEND_URL,
  API_URL.replace(/\/api$/, '')
);

const PING_URL = `${BACKEND_URL}/api/init/status`;

const wakeUpBackend = async () => {
  try {
    const response = await fetch(PING_URL, {
      method: 'GET',
      mode: 'cors'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

const waitForBackend = async (maxAttempts = 6, delayMs = 3000) => {
  for (let index = 0; index < maxAttempts; index += 1) {
    const awake = await wakeUpBackend();
    if (awake) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return false;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined' && !window.backendAwake) {
      await waitForBackend();
      window.backendAwake = true;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      await waitForBackend(3, 2000);
      return api(originalRequest);
    }

    if (error.response) {
      const validationErrors = Array.isArray(error.response.data?.errors)
        ? error.response.data.errors
            .map(item => item?.msg)
            .filter(Boolean)
        : [];

      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
      }

      const message =
        validationErrors[0] ||
        error.response.data?.message ||
        'Error en la peticion';
      return Promise.reject(new Error(message));
    }

    if (error.request) {
      return Promise.reject(
        new Error(
          'No se pudo conectar con el servidor. Verifica que el backend local este encendido en el puerto 5000.'
        )
      );
    }

    return Promise.reject(error);
  }
);

export default api;
