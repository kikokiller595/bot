const express = require('express');
const { body, validationResult } = require('express-validator');
const PuntoVenta = require('../models/PuntoVenta');
const Usuario = require('../models/Usuario');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const ROLES_TERMINAL = ['punto_venta', 'vendedor'];

const normalizarUsername = (valor = '') =>
  String(valor || '').trim().toLowerCase();

const normalizarCodigo = (valor = '') =>
  String(valor || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const generarCodigoBase = (valor = '') => {
  const base = normalizarCodigo(valor).slice(0, 18);
  return base || 'PV';
};

const generarCodigoUnico = async (sugerencia, excludeId = null) => {
  const base = generarCodigoBase(sugerencia);
  let candidato = base;
  let contador = 1;

  while (true) {
    const query = { codigo: candidato };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existe = await PuntoVenta.findOne(query).select('_id');
    if (!existe) {
      return candidato;
    }

    contador += 1;
    candidato = `${base}-${contador}`.slice(0, 24);
  }
};

const formatearPuntoVenta = (puntoVenta, usuario = null) => ({
  id: puntoVenta._id,
  codigo: puntoVenta.codigo,
  nombre: puntoVenta.nombre,
  tipo: puntoVenta.tipo || '',
  ubicacion: puntoVenta.ubicacion || '',
  telefono: puntoVenta.telefono || '',
  porcentajeSocio: Number(puntoVenta.porcentajeSocio) || 0,
  responsable: puntoVenta.responsable || '',
  username: usuario?.username || '',
  usuarioId: usuario?._id || null,
  activo: Boolean(puntoVenta.activo),
  createdAt: puntoVenta.createdAt || null,
  updatedAt: puntoVenta.updatedAt || null
});

const obtenerMapaUsuariosPorPuntoVenta = async (puntosVentaIds = []) => {
  if (!Array.isArray(puntosVentaIds) || puntosVentaIds.length === 0) {
    return new Map();
  }

  const usuarios = await Usuario.find({
    puntoVenta: { $in: puntosVentaIds },
    rol: { $in: ROLES_TERMINAL }
  })
    .select('username puntoVenta')
    .sort({ createdAt: 1 });

  return usuarios.reduce((mapa, usuario) => {
    const clave = String(usuario.puntoVenta);
    if (!mapa.has(clave)) {
      mapa.set(clave, usuario);
    }
    return mapa;
  }, new Map());
};

const obtenerUsuarioTerminal = async (puntoVentaId) => {
  if (!puntoVentaId) {
    return null;
  }

  return Usuario.findOne({
    puntoVenta: puntoVentaId,
    rol: { $in: ROLES_TERMINAL }
  }).sort({ createdAt: 1 });
};

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
    const usuarioTerminal = await obtenerUsuarioTerminal(req.user.puntoVenta);

    return res.json({
      success: true,
      data: puntoVenta ? formatearPuntoVenta(puntoVenta, usuarioTerminal) : null
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
    const mapaUsuarios = await obtenerMapaUsuariosPorPuntoVenta(
      puntosVenta.map((puntoVenta) => puntoVenta._id)
    );

    return res.json({
      success: true,
      count: puntosVenta.length,
      data: puntosVenta.map((puntoVenta) =>
        formatearPuntoVenta(
          puntoVenta,
          mapaUsuarios.get(String(puntoVenta._id)) || null
        )
      )
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
    body('codigo').optional({ checkFalsy: true }).trim(),
    body('nombre').optional({ checkFalsy: true }).trim(),
    body('tipo').optional({ checkFalsy: true }).trim(),
    body('ubicacion').optional({ checkFalsy: true }).trim(),
    body('telefono').optional({ checkFalsy: true }).trim(),
    body('porcentajeSocio')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 })
      .withMessage('El porcentaje del socio debe estar entre 0 y 100'),
    body('responsable').optional({ checkFalsy: true }).trim(),
    body('username')
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('El usuario debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres')
  ],
  async (req, res) => {
    const errorResponse = validar(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    let puntoVenta = null;

    try {
      const username = normalizarUsername(req.body.username);
      const password = String(req.body.password || '').trim();
      const activo = typeof req.body.activo === 'undefined' ? true : Boolean(req.body.activo);
      const nombre =
        String(req.body.nombre || '').trim() ||
        username ||
        String(req.body.codigo || '').trim();

      if (!nombre) {
        return res.status(400).json({
          success: false,
          message: 'Debes indicar un nombre o un usuario para la terminal'
        });
      }

      if ((username && !password) || (!username && password)) {
        return res.status(400).json({
          success: false,
          message: 'Para crear la terminal con acceso debes indicar usuario y contrasena'
        });
      }

      if (username) {
        const usuarioExistente = await Usuario.findOne({ username });
        if (usuarioExistente) {
          return res.status(400).json({
            success: false,
            message: 'Ese nombre de usuario ya esta registrado'
          });
        }
      }

      const codigoSolicitado = String(req.body.codigo || '').trim();
      const codigo = codigoSolicitado
        ? normalizarCodigo(codigoSolicitado)
        : await generarCodigoUnico(username || nombre);

      if (!codigo) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo generar un codigo valido para la terminal'
        });
      }

      if (codigoSolicitado) {
        const existe = await PuntoVenta.findOne({ codigo });
        if (existe) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un punto de venta con ese codigo'
          });
        }
      }

      puntoVenta = await PuntoVenta.create({
        codigo,
        nombre,
        tipo: String(req.body.tipo || '').trim(),
        ubicacion: String(req.body.ubicacion || '').trim(),
        telefono: String(req.body.telefono || '').trim(),
        porcentajeSocio: Number(req.body.porcentajeSocio) || 0,
        responsable: String(req.body.responsable || username || nombre).trim(),
        activo
      });

      let usuarioTerminal = null;
      if (username && password) {
        usuarioTerminal = await Usuario.create({
          nombre,
          username,
          password,
          rol: 'punto_venta',
          puntoVenta: puntoVenta._id,
          activo
        });
      }

      return res.status(201).json({
        success: true,
        data: formatearPuntoVenta(puntoVenta, usuarioTerminal)
      });
    } catch (error) {
      if (puntoVenta?._id) {
        await PuntoVenta.deleteOne({ _id: puntoVenta._id }).catch(() => null);
      }

      console.error('Error al crear punto de venta:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al crear punto de venta'
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
    body('tipo').optional().trim(),
    body('ubicacion').optional().trim(),
    body('telefono').optional().trim(),
    body('porcentajeSocio')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 })
      .withMessage('El porcentaje del socio debe estar entre 0 y 100'),
    body('responsable').optional().trim(),
    body('username')
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('Usuario invalido'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres')
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

      const usuarioTerminal = await obtenerUsuarioTerminal(puntoVenta._id);
      const username = normalizarUsername(req.body.username);
      const password = String(req.body.password || '').trim();

      if (req.body.codigo) {
        const codigo = normalizarCodigo(req.body.codigo);
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

      if (req.body.nombre) {
        puntoVenta.nombre = String(req.body.nombre).trim();
      } else if (username) {
        puntoVenta.nombre = username;
      }

      if (typeof req.body.tipo !== 'undefined') {
        puntoVenta.tipo = String(req.body.tipo || '').trim();
      }
      if (typeof req.body.ubicacion !== 'undefined') {
        puntoVenta.ubicacion = String(req.body.ubicacion || '').trim();
      }
      if (typeof req.body.telefono !== 'undefined') {
        puntoVenta.telefono = String(req.body.telefono || '').trim();
      }
      if (typeof req.body.porcentajeSocio !== 'undefined') {
        puntoVenta.porcentajeSocio = Number(req.body.porcentajeSocio) || 0;
      }
      if (typeof req.body.responsable !== 'undefined') {
        puntoVenta.responsable = String(req.body.responsable || '').trim();
      } else if (username) {
        puntoVenta.responsable = username;
      }
      if (typeof req.body.activo !== 'undefined') {
        puntoVenta.activo = Boolean(req.body.activo);
      }

      let usuarioActualizado = usuarioTerminal;
      if (username) {
        const usernameExiste = await Usuario.findOne({
          username,
          _id: { $ne: usuarioTerminal?._id }
        });
        if (usernameExiste) {
          return res.status(400).json({
            success: false,
            message: 'Ese nombre de usuario ya esta registrado'
          });
        }

        if (usuarioTerminal) {
          usuarioTerminal.username = username;
          usuarioTerminal.nombre = puntoVenta.nombre;
        } else {
          if (!password) {
            return res.status(400).json({
              success: false,
              message: 'Si la terminal no tiene usuario, debes indicar una contrasena para crearle acceso'
            });
          }

          usuarioActualizado = await Usuario.create({
            nombre: puntoVenta.nombre,
            username,
            password,
            rol: 'punto_venta',
            puntoVenta: puntoVenta._id,
            activo: puntoVenta.activo
          });
        }
      }

      if (usuarioTerminal && typeof req.body.activo !== 'undefined') {
        usuarioTerminal.activo = Boolean(req.body.activo);
      }

      if (usuarioTerminal && password) {
        usuarioTerminal.password = password;
      }

      await puntoVenta.save();
      if (usuarioTerminal) {
        await usuarioTerminal.save();
        usuarioActualizado = usuarioTerminal;
      }

      return res.json({
        success: true,
        data: formatearPuntoVenta(puntoVenta, usuarioActualizado)
      });
    } catch (error) {
      console.error('Error al actualizar punto de venta:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar punto de venta'
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
      { puntoVenta: puntoVenta._id, rol: { $in: ROLES_TERMINAL } },
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
