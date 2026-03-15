import api from './api';
import { extractData, normalizeSorteo, normalizeSorteos } from './normalizers';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

const sorteosService = {
  getSorteos: async (filters = {}) => {
    const response = await api.get(`/sorteos${buildQuery(filters)}`);
    return normalizeSorteos(extractData(response.data));
  },

  obtenerSorteos: async (filters = {}) => {
    return sorteosService.getSorteos(filters);
  },

  obtenerSorteosPorVendedor: async (vendedor) => {
    return sorteosService.getSorteos({ vendedor });
  },

  getReporte: async (filters = {}) => {
    const response = await api.get(`/sorteos/reporte${buildQuery(filters)}`);
    return extractData(response.data);
  },

  createSorteo: async (sorteoData) => {
    const response = await api.post('/sorteos', sorteoData);
    return normalizeSorteo(extractData(response.data));
  },

  crearSorteo: async (sorteoData) => {
    return sorteosService.createSorteo(sorteoData);
  },

  createMultipleSorteos: async (sorteos) => {
    const response = await api.post('/sorteos/multiple', { sorteos });
    return normalizeSorteos(extractData(response.data));
  },

  crearMultiplesSorteos: async (sorteos) => {
    return sorteosService.createMultipleSorteos(sorteos);
  },

  deleteSorteo: async (id) => {
    const response = await api.delete(`/sorteos/${id}`);
    return response.data;
  },

  eliminarSorteo: async (id) => {
    return sorteosService.deleteSorteo(id);
  },

  deleteGrupoSorteos: async (grupoId) => {
    const response = await api.delete(`/sorteos/grupo/${grupoId}`);
    return response.data;
  },

  eliminarGrupoSorteos: async (grupoId) => {
    return sorteosService.deleteGrupoSorteos(grupoId);
  },

  marcarGanador: async (id, numeroGanador, posicion) => {
    const response = await api.put(`/sorteos/${id}/ganador`, {
      numeroGanador,
      posicion
    });
    return normalizeSorteo(extractData(response.data));
  },

  marcarTicketPagado: async ({ id, ticketId, grupoId, pagado }) => {
    const response = await api.put('/sorteos/ticket/pagado', {
      id,
      ticketId,
      grupoId,
      pagado
    });
    return extractData(response.data);
  }
};

export default sorteosService;
