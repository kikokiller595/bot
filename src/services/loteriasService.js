import api from './api';
import {
  extractData,
  normalizeLoteria,
  normalizeLoterias
} from './normalizers';

const loteriasService = {
  getLoterias: async () => {
    const response = await api.get('/loterias');
    return normalizeLoterias(extractData(response.data));
  },

  obtenerLoterias: async () => {
    return loteriasService.getLoterias();
  },

  getLoteria: async (id) => {
    const response = await api.get(`/loterias/${id}`);
    return normalizeLoteria(extractData(response.data));
  },

  obtenerLoteria: async (id) => {
    return loteriasService.getLoteria(id);
  },

  createLoteria: async (loteriaData) => {
    const response = await api.post('/loterias', loteriaData);
    return normalizeLoteria(extractData(response.data));
  },

  crearLoteria: async (loteriaData) => {
    return loteriasService.createLoteria(loteriaData);
  },

  updateLoteria: async (id, loteriaData) => {
    const response = await api.put(`/loterias/${id}`, loteriaData);
    return normalizeLoteria(extractData(response.data));
  },

  actualizarLoteria: async (id, loteriaData) => {
    return loteriasService.updateLoteria(id, loteriaData);
  },

  deleteLoteria: async (id) => {
    const response = await api.delete(`/loterias/${id}`);
    return response.data;
  },

  eliminarLoteria: async (id) => {
    return loteriasService.deleteLoteria(id);
  }
};

export default loteriasService;
