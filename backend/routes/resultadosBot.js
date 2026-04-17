const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getBotSyncStatus,
  syncBotResults
} = require('../services/resultadosBotService');

const router = express.Router();

router.get('/status', protect, authorize('admin'), async (req, res) => {
  try {
    const status = await getBotSyncStatus();
    return res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error al consultar estado del bot:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'No se pudo consultar el bot de resultados'
    });
  }
});

router.post('/sync', protect, authorize('admin'), async (req, res) => {
  try {
    const summary = await syncBotResults({ trigger: 'manual' });
    const status = await getBotSyncStatus();

    return res.json({
      success: true,
      data: {
        summary,
        status
      }
    });
  } catch (error) {
    console.error('Error al sincronizar resultados del bot:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'No se pudo sincronizar resultados del bot'
    });
  }
});

module.exports = router;
