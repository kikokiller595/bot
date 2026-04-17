import api from './api';
import { extractData } from './normalizers';

const normalizeSlot = (slot = {}) => ({
  key: String(slot.key || '').trim(),
  state: String(slot.state || '').trim().toLowerCase(),
  stateName: String(slot.stateName || '').trim(),
  game: String(slot.game || '').trim().toLowerCase(),
  drawName: String(slot.drawName || '').trim(),
  label: String(slot.label || '').trim()
});

const normalizeStatus = (payload = {}) => ({
  baseUrl: String(payload.baseUrl || '').trim(),
  healthy: Boolean(payload.healthy),
  lastAttemptAt: payload.lastAttemptAt || null,
  lastSuccessAt: payload.lastSuccessAt || null,
  lastError: String(payload.lastError || '').trim(),
  lastSummary: payload.lastSummary || null,
  slots: Array.isArray(payload.slots) ? payload.slots.map(normalizeSlot) : []
});

const resultadosBotService = {
  getStatus: async () => {
    const response = await api.get('/resultados-bot/status');
    return normalizeStatus(extractData(response.data));
  },

  syncNow: async () => {
    const response = await api.post('/resultados-bot/sync');
    const data = extractData(response.data);
    return {
      summary: data?.summary || null,
      status: normalizeStatus(data?.status || {})
    };
  }
};

export default resultadosBotService;
