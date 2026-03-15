import api from './api';
import {
  extractData,
  normalizePuntoVenta,
  normalizePuntosVenta
} from './normalizers';

const puntosVentaService = {
  getPuntosVenta: async () => {
    const response = await api.get('/puntos-venta');
    return normalizePuntosVenta(extractData(response.data));
  },

  getMiPuntoVenta: async () => {
    const response = await api.get('/puntos-venta/mi');
    return normalizePuntoVenta(extractData(response.data));
  },

  createPuntoVenta: async (data) => {
    const response = await api.post('/puntos-venta', data);
    return normalizePuntoVenta(extractData(response.data));
  },

  updatePuntoVenta: async (id, data) => {
    const response = await api.put(`/puntos-venta/${id}`, data);
    return normalizePuntoVenta(extractData(response.data));
  },

  deletePuntoVenta: async (id) => {
    const response = await api.delete(`/puntos-venta/${id}`);
    return response.data;
  }
};

export default puntosVentaService;
