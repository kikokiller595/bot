const mongoose = require('mongoose');
const Loteria = require('../models/Loteria');

const DEFAULT_BOT_BASE_URL = 'https://lottery-bot-production.up.railway.app';
const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const stateNames = {
  ct: 'Connecticut',
  fl: 'Florida',
  ga: 'Georgia',
  nj: 'New Jersey',
  ny: 'New York',
  pa: 'Pennsylvania'
};

let schedulerStarted = false;
let currentSyncPromise = null;
let lastKnownSlots = [];

const syncState = {
  baseUrl: '',
  healthy: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: '',
  lastSummary: null
};

const getBotBaseUrl = () =>
  String(process.env.LOTTERY_BOT_BASE_URL || DEFAULT_BOT_BASE_URL)
    .trim()
    .replace(/\/+$/, '');

const normalizeDate = (value) => {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const normalizeDrawName = (value = '') =>
  String(value || '').trim().toLowerCase();

const normalizeGame = (value = '') =>
  String(value || '').trim().toLowerCase();

const normalizeState = (value = '') =>
  String(value || '').trim().toLowerCase();

const formatTimestamp = (value = new Date()) =>
  new Date(value).toLocaleString('es-ES');

const buildSlotKey = (slot = {}) =>
  [normalizeState(slot.state), normalizeGame(slot.game), normalizeDrawName(slot.drawName)]
    .filter(Boolean)
    .join(':');

const buildResultKey = (result = {}) =>
  [normalizeState(result.state), normalizeGame(result.game), normalizeDrawName(result.draw_name)]
    .filter(Boolean)
    .join(':');

const buildSlotLabel = ({ state, drawName }) => {
  const stateLabel = stateNames[normalizeState(state)] || String(state || '').toUpperCase();
  return `${stateLabel} / ${String(drawName || '').trim()}`;
};

const withTimeout = async (url) => {
  const controller = new AbortController();
  const timeoutMs = Number(
    process.env.LOTTERY_BOT_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS
  );
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Bot respondio ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const extractSlotOptions = (payload = {}) => {
  const unique = new Map();

  for (const result of Array.isArray(payload.results) ? payload.results : []) {
    const state = normalizeState(result.state);
    const game = normalizeGame(result.game);
    const drawName = String(result.draw_name || '').trim();
    if (!state || !drawName || !['pick3', 'pick4'].includes(game)) {
      continue;
    }

    const key = `${state}:${game}:${normalizeDrawName(drawName)}`;
    if (!unique.has(key)) {
      unique.set(key, {
        key,
        state,
        stateName: result.state_name || stateNames[state] || state.toUpperCase(),
        game,
        drawName,
        label: buildSlotLabel({ state, drawName })
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    const labelCompare = a.label.localeCompare(b.label, 'es');
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return a.game.localeCompare(b.game, 'es');
  });
};

const fetchSharedResults = async () => {
  const baseUrl = getBotBaseUrl();
  const payload = await withTimeout(`${baseUrl}/shared-results`);
  const slots = extractSlotOptions(payload);
  lastKnownSlots = slots;
  return { payload, slots, baseUrl };
};

const probeBot = async () => {
  const baseUrl = getBotBaseUrl();

  try {
    const [health, shared] = await Promise.all([
      withTimeout(`${baseUrl}/health`),
      fetchSharedResults()
    ]);

    return {
      baseUrl,
      healthy: String(health?.status || '').toLowerCase() === 'ok',
      slots: shared.slots
    };
  } catch (error) {
    return {
      baseUrl,
      healthy: false,
      error: error.message,
      slots: lastKnownSlots
    };
  }
};

const buildImportedNumber = (result) => {
  const numero = Array.isArray(result?.numbers)
    ? result.numbers.join('')
    : String(result?.number || '').trim();

  return {
    id: new mongoose.Types.ObjectId().toString(),
    numero,
    fecha: normalizeDate(result.draw_date),
    fechaRegistro: formatTimestamp(result.published_at || result.fetched_at || new Date()),
    premio: 0,
    fuente: 'bot',
    game: normalizeGame(result.game),
    drawId: String(result.draw_id || '').trim(),
    sourceUrl: String(result.source_url || '').trim(),
    sincronizadoEn: formatTimestamp(new Date())
  };
};

const inferStoredGame = (item = {}) => {
  const explicitGame = normalizeGame(item.game);
  if (['pick3', 'pick4'].includes(explicitGame)) {
    return explicitGame;
  }

  const numero = String(item.numero || '').trim();
  if (numero.length === 3) return 'pick3';
  if (numero.length === 4) return 'pick4';
  return '';
};

const hasManualConflict = (numerosGanadores, result) => {
  const fecha = normalizeDate(result.draw_date);
  const game = normalizeGame(result.game);

  return numerosGanadores.some((item) => {
    const fuente = String(item.fuente || 'manual').trim().toLowerCase();
    return (
      fuente !== 'bot' &&
      normalizeDate(item.fecha) === fecha &&
      inferStoredGame(item) === game
    );
  });
};

const findExistingImportedIndex = (numerosGanadores, result) => {
  const drawId = String(result.draw_id || '').trim();
  const fecha = normalizeDate(result.draw_date);
  const game = normalizeGame(result.game);

  return numerosGanadores.findIndex((item) => {
    const fuente = String(item.fuente || '').trim().toLowerCase();
    if (fuente !== 'bot') {
      return false;
    }

    if (drawId && String(item.drawId || '').trim() === drawId) {
      return true;
    }

    return normalizeDate(item.fecha) === fecha && inferStoredGame(item) === game;
  });
};

const updateLoteriaSyncStatus = (loteria, partial = {}) => {
  loteria.botSyncStatus = {
    lastAttemptAt: partial.lastAttemptAt || loteria.botSyncStatus?.lastAttemptAt || null,
    lastSuccessAt: partial.lastSuccessAt || loteria.botSyncStatus?.lastSuccessAt || null,
    lastError:
      typeof partial.lastError === 'string'
        ? partial.lastError
        : loteria.botSyncStatus?.lastError || ''
  };
};

const applyResultToLoteria = (loteria, result) => {
  const numerosGanadores = Array.isArray(loteria.numerosGanadores)
    ? [...loteria.numerosGanadores]
    : [];

  if (hasManualConflict(numerosGanadores, result)) {
    console.warn(
      `[bot-sync] conflicto manual preservado en loteria "${loteria.nombre}" para ${result.game} ${result.draw_date}`
    );
    return { changed: false, conflict: true };
  }

  const imported = buildImportedNumber(result);
  const existingIndex = findExistingImportedIndex(numerosGanadores, result);

  if (existingIndex >= 0) {
    numerosGanadores[existingIndex] = {
      ...numerosGanadores[existingIndex].toObject?.(),
      ...numerosGanadores[existingIndex],
      ...imported,
      id:
        numerosGanadores[existingIndex].id ||
        numerosGanadores[existingIndex]._id ||
        imported.id
    };
  } else {
    numerosGanadores.push(imported);
  }

  loteria.numerosGanadores = numerosGanadores;
  return { changed: true, conflict: false };
};

const resolveConfiguredResult = (resultsByKey, slot) => {
  const slotKey = buildSlotKey(slot);
  if (!slotKey) {
    return null;
  }

  return resultsByKey.get(slotKey) || null;
};

const performSync = async ({ trigger = 'manual' } = {}) => {
  syncState.baseUrl = getBotBaseUrl();
  syncState.lastAttemptAt = new Date().toISOString();

  if (mongoose.connection.readyState !== 1) {
    const message = 'MongoDB no esta conectado';
    syncState.lastError = message;
    throw new Error(message);
  }

  const loterias = await Loteria.find({
    activa: true,
    botSyncEnabled: true
  });

  const { payload, slots } = await fetchSharedResults();
  const resultsByKey = new Map();

  for (const result of Array.isArray(payload.results) ? payload.results : []) {
    const key = buildResultKey(result);
    if (key) {
      resultsByKey.set(key, result);
    }
  }

  const stats = {
    trigger,
    loteriasEvaluadas: loterias.length,
    loteriasActualizadas: 0,
    resultadosImportados: 0,
    conflictosManual: 0,
    slotsDisponibles: slots.length
  };

  for (const loteria of loterias) {
    let changed = false;
    const now = new Date();
    updateLoteriaSyncStatus(loteria, {
      lastAttemptAt: now,
      lastError: ''
    });

    for (const game of ['pick3', 'pick4']) {
      const slot = loteria.botSlots?.[game];
      const result = resolveConfiguredResult(resultsByKey, slot);
      if (!result) {
        continue;
      }

      const outcome = applyResultToLoteria(loteria, result);
      if (outcome.conflict) {
        stats.conflictosManual += 1;
        continue;
      }

      if (outcome.changed) {
        changed = true;
        stats.resultadosImportados += 1;
      }
    }

    updateLoteriaSyncStatus(loteria, {
      lastAttemptAt: now,
      lastSuccessAt: now,
      lastError: ''
    });

    if (changed) {
      stats.loteriasActualizadas += 1;
    }

    await loteria.save();
  }

  syncState.healthy = true;
  syncState.lastSuccessAt = new Date().toISOString();
  syncState.lastError = '';
  syncState.lastSummary = stats;

  return stats;
};

const syncBotResults = async (options = {}) => {
  if (currentSyncPromise) {
    return currentSyncPromise;
  }

  currentSyncPromise = performSync(options)
    .catch((error) => {
      syncState.healthy = false;
      syncState.lastError = error.message || 'No se pudo sincronizar con el bot';
      throw error;
    })
    .finally(() => {
      currentSyncPromise = null;
    });

  return currentSyncPromise;
};

const getBotSyncStatus = async () => {
  const probe = await probeBot();

  return {
    baseUrl: probe.baseUrl,
    healthy: probe.healthy,
    lastAttemptAt: syncState.lastAttemptAt,
    lastSuccessAt: syncState.lastSuccessAt,
    lastError: syncState.lastError || probe.error || '',
    lastSummary: syncState.lastSummary,
    slots: probe.slots
  };
};

const startBotSyncScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const intervalMs = Number(
    process.env.LOTTERY_BOT_SYNC_INTERVAL_MS || DEFAULT_SYNC_INTERVAL_MS
  );

  setInterval(async () => {
    try {
      await syncBotResults({ trigger: 'auto' });
    } catch (error) {
      console.error(`[bot-sync] ${error.message}`);
    }
  }, intervalMs);
};

module.exports = {
  getBotSyncStatus,
  syncBotResults,
  startBotSyncScheduler
};
