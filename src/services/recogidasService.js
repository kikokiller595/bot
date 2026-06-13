import api from './api';

const extractData = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return payload.data || payload;
};

const recogidasService = {
  getRecogidas: async () => {
    const response = await api.get('/recogidas');
    return extractData(response.data);
  },

  registrarRecogida: async (data) => {
    const response = await api.post('/recogidas', data);
    return response.data?.data || response.data;
  },

  eliminarRecogida: async (id) => {
    const response = await api.delete(`/recogidas/${id}`);
    return response.data;
  }
};

export default recogidasService;
