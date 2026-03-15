const express = require('express');
const { body, validationResult } = require('express-validator');
const PuntoVenta = require('../models/PuntoVenta');
const Usuario = require('../models/Usuario');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const formatearPuntoVenta = (puntoVenta) => ({
  id: puntoVenta._id,
  codigo: puntoVenta.codigo,
  nombre: puntoVenta.nombre,
  ubicacion: puntoVenta.ubicacion || '',
  telefono: puntoVenta.telefono || '',
  responsable: puntoVenta.responsable || '',
  activo: Boolean(puntoVenta.activo),
  createdAt: puntoVenta.createdAt || null,
  updatedAt: puntoVenta.updatedAt || null
});

const validar = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(400).json({
    success: false,
    errors: errors.array()
  });
};

router.get('/mi', protect, async (req, res) => {
  try {
    if (!req.user.puntoVenta) {
      return res.json({
        success: true,
        data: null
      });
    }

    const puntoVenta = await PuntoVenta.findById(req.user.puntoVenta);
    return res.json({
      success: true,
      data: puntoVenta ? formatearPuntoVenta(puntoVenta) : null
    });
  } catch (error) {
    console.error('Error al obtener punto de venta actual:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener punto de venta'
    });
  }
});

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const puntosVenta = await PuntoVenta.find().sort({ nombre: 1 });

    return res.json({
      success: true,
      count: puntosVenta.length,
      data: puntosVenta.map(formatearPuntoVenta)
    });
  } catch (error) {
    console.error('Error al obtener puntos de venta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener puntos de venta'
    });
  }
});

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('codigo').trim().notEmpty().withMessage('El codigo es requerido'),
    body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('ubicacion').optional({ checkFalsy: true }).trim(),
    body('telefono').optional({ checkFalsy: true }).trim(),
    body('responsable').optional({ checkFalsy: true }).trim()
  ],
  async (req, res) => {
    const errorResponse = validar(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const codigo = String(req.body.codigo).trim().toUpperCase();
      const existe = await PuntoVenta.findOne({ codigo });
      if (existe) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un punto de venta con ese codigo'
        });
      }

      const puntoVenta = await PuntoVenta.create({
        codigo,
        nombre: String(req.body.nombre).trim(),
        ubicacion: String(req.body.ubicacion || '').trim(),
        telefono: String(req.body.telefono || '').trim(),
        responsable: String(req.body.responsable || '').trim(),
        activo: typeof req.body.activo === 'undefined' ? true : Boolean(req.body.activo)
      });

      return res.status(201).json({
        success: true,
        data: formatearPuntoVenta(puntoVenta)
      });
    } catch (error) {
      console.error('Error al crear punto de venta:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al crear punto de venta'
      });
    }
  }
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  [
    body('codigo').optional({ checkFalsy: true }).trim(),
    body('nombre').optional({ checkFalsy: true }).trim(),
    body('ubicacion').optional().trim(),
    body('telefono').optional().trim(),
    body('responsable').optional().trim()
  ],
  async (req, res) => {
    const errorResponse = validar(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const puntoVenta = await PuntoVenta.findById(req.params.id);
      if (!puntoVenta) {
        return res.status(404).json({
          success: false,
          message: 'Punto de venta no encontrado'
        });
      }

      if (req.body.codigo) {
        const codigo = String(req.body.codigo).trim().toUpperCase();
        const codigoExiste = await PuntoVenta.findOne({
          codigo,
          _id: { $ne: puntoVenta._id }
        });
        if (codigoExiste) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un punto de venta con ese codigo'
          });
        }
        puntoVenta.codigo = codigo;
      }

      if (req.body.nombre) puntoVenta.nombre = String(req.body.nombre).trim();
      if (typeof req.body.ubicacion !== 'undefined') puntoVenta.ubicacion = String(req.body.ubicacion || '').trim();
      if (typeof req.body.telefono !== 'undefined') puntoVenta.telefono = String(req.body.telefono || '').trim();
      if (typeof req.body.responsable !== 'undefined') puntoVenta.responsable = String(req.body.responsable || '').trim();
      if (typeof req.body.activo !== 'undefined') puntoVenta.activo = Boolean(req.body.activo);

      await puntoVenta.save();

      return res.json({
        success: true,
        data: formatearPuntoVenta(puntoVenta)
      });
    } catch (error) {
      console.error('Error al actualizar punto de venta:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar punto de venta'
      });
    }
  }
);

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const puntoVenta = await PuntoVenta.findById(req.params.id);
    if (!puntoVenta) {
      return res.status(404).json({
        success: false,
        message: 'Punto de venta no encontrado'
      });
    }

    puntoVenta.activo = false;
    await puntoVenta.save();

    await Usuario.updateMany(
      { puntoVenta: puntoVenta._id, rol: { $in: ['punto_venta', 'vendedor'] } },
      { $set: { activo: false } }
    );

    return res.json({
      success: true,
      message: 'Punto de venta desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar punto de venta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar punto de venta'
    });
  }
});

module.exports = router;
