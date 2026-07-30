const express = require('express');
const router = express.Router();
const Sorteo = require('../models/Sorteo');
const PagoPremio = require('../models/PagoPremio');
const Usuario = require('../models/Usuario');
const { protect, authorize } = require('../middleware/auth');

// Reinicia los datos operativos del sistema: elimina TODOS los tickets/ventas
// y los pagos de premios. Mantiene intactas las loterias, los puntos de venta,
// los usuarios y las recogidas. Requiere rol admin y confirmar la contrasena.
router.post('/reiniciar-ventas', protect, authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar su contrasena para confirmar'
      });
    }

    const admin = await Usuario.findById(req.user.id).select('+password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const passwordValida = await admin.matchPassword(password);
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'Contrasena incorrecta'
      });
    }

    const [sorteosEliminados, pagosEliminados] = await Promise.all([
      Sorteo.deleteMany({}),
      PagoPremio.deleteMany({})
    ]);

    console.warn(
      `[reset] ${req.user.username || req.user.nombre} reinicio las ventas: ` +
        `${sorteosEliminados.deletedCount || 0} tickets y ` +
        `${pagosEliminados.deletedCount || 0} pagos eliminados`
    );

    return res.json({
      success: true,
      message: 'Ventas y premios eliminados correctamente',
      data: {
        ticketsEliminados: sorteosEliminados.deletedCount || 0,
        pagosEliminados: pagosEliminados.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Error al reiniciar ventas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al reiniciar las ventas'
    });
  }
});

module.exports = router;
