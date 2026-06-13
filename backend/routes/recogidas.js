const express = require('express');
const { body, validationResult } = require('express-validator');
const Recogida = require('../models/Recogida');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const formatearRecogida = (recogida) => ({
  id: recogida._id,
  puntoVentaId: recogida.puntoVentaId,
  puntoVentaNombre: recogida.puntoVentaNombre || '',
  semanaInicio: recogida.semanaInicio,
  semanaFin: recogida.semanaFin || '',
  montoVenta: Number(recogida.montoVenta) || 0,
  montoPremios: Number(recogida.montoPremios) || 0,
  montoComision: Number(recogida.montoComision) || 0,
  montoEsperado: Number(recogida.montoEsperado) || 0,
  montoRecogido: Number(recogida.montoRecogido) || 0,
  nota: recogida.nota || '',
  registradoPor: recogida.registradoPor || '',
  fechaRecogida: recogida.fechaRecogida || null,
  createdAt: recogida.createdAt || null,
  updatedAt: recogida.updatedAt || null
});

const validar = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }
  return res.status(400).json({ success: false, errors: errors.array() });
};

// Listar recogidas. Opcionalmente filtra por semana (?semanaInicio=YYYY-MM-DD).
router.get('/', protect, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const query = {};
    if (req.query.semanaInicio) {
      query.semanaInicio = String(req.query.semanaInicio).trim();
    }

    const recogidas = await Recogida.find(query).sort({ semanaInicio: -1, puntoVentaNombre: 1 });

    return res.json({
      success: true,
      count: recogidas.length,
      data: recogidas.map(formatearRecogida)
    });
  } catch (error) {
    console.error('Error al obtener recogidas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener recogidas' });
  }
});

// Registrar/actualizar una recogida (upsert por punto de venta + semana).
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('puntoVentaId').trim().notEmpty().withMessage('El punto de venta es requerido'),
    body('semanaInicio')
      .trim()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('La semana de inicio debe tener formato YYYY-MM-DD')
  ],
  async (req, res) => {
    const errorResponse = validar(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const puntoVentaId = String(req.body.puntoVentaId).trim();
      const semanaInicio = String(req.body.semanaInicio).trim();

      const datos = {
        puntoVentaId,
        puntoVentaNombre: String(req.body.puntoVentaNombre || '').trim(),
        semanaInicio,
        semanaFin: String(req.body.semanaFin || '').trim(),
        montoVenta: Number(req.body.montoVenta) || 0,
        montoPremios: Number(req.body.montoPremios) || 0,
        montoComision: Number(req.body.montoComision) || 0,
        montoEsperado: Number(req.body.montoEsperado) || 0,
        montoRecogido:
          typeof req.body.montoRecogido === 'undefined' || req.body.montoRecogido === null
            ? Number(req.body.montoEsperado) || 0
            : Number(req.body.montoRecogido) || 0,
        nota: String(req.body.nota || '').trim(),
        registradoPor: req.user?.username || req.user?.nombre || '',
        fechaRecogida: new Date()
      };

      const recogida = await Recogida.findOneAndUpdate(
        { puntoVentaId, semanaInicio },
        { $set: datos },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({ success: true, data: formatearRecogida(recogida) });
    } catch (error) {
      console.error('Error al registrar recogida:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al registrar recogida'
      });
    }
  }
);

// Deshacer una recogida.
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const recogida = await Recogida.findById(req.params.id);
    if (!recogida) {
      return res.status(404).json({ success: false, message: 'Recogida no encontrada' });
    }

    await recogida.deleteOne();

    return res.json({ success: true, message: 'Recogida eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar recogida:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar recogida' });
  }
});

module.exports = router;
