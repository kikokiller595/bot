const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Usuario = require('../models/Usuario');
const PuntoVenta = require('../models/PuntoVenta');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const normalizarRol = (rol) => {
  const valor = String(rol || '').trim().toLowerCase();
  return valor === 'vendedor' ? 'punto_venta' : valor;
};

const normalizarUsername = (valor = '') =>
  String(valor || '').trim().toLowerCase();

const escaparRegex = (valor = '') =>
  String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });

const formatearUsuario = (usuario) => {
  const puntoVenta =
    usuario?.puntoVenta && typeof usuario.puntoVenta === 'object'
      ? usuario.puntoVenta
      : null;

  return {
    id: usuario._id,
    nombre: usuario.nombre,
    username: usuario.username || '',
    email: usuario.email || '',
    rol: normalizarRol(usuario.rol),
    activo: Boolean(usuario.activo),
    puntoVentaId: puntoVenta?._id || usuario.puntoVenta || null,
    puntoVentaNombre: puntoVenta?.nombre || '',
    puntoVentaCodigo: puntoVenta?.codigo || '',
    ultimoAcceso: usuario.ultimoAcceso || null
  };
};

const validarRequest = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }

  return res.status(400).json({
    success: false,
    errors: errors.array()
  });
};

const obtenerPuntoVenta = async (puntoVentaId) => {
  if (!puntoVentaId) {
    return null;
  }

  const puntoVenta = await PuntoVenta.findById(puntoVentaId);
  if (!puntoVenta) {
    throw new Error('Punto de venta no encontrado');
  }

  return puntoVenta;
};

router.post(
  '/register',
  protect,
  authorize('admin'),
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('username')
      .trim()
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('El username debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('rol').isIn(['admin', 'punto_venta']).withMessage('Rol invalido'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Email invalido'),
    body('puntoVentaId')
      .optional({ nullable: true, checkFalsy: true })
      .isMongoId()
      .withMessage('Punto de venta invalido')
  ],
  async (req, res) => {
    const errorResponse = validarRequest(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const {
        nombre,
        username,
        password,
        rol,
        email,
        puntoVentaId
      } = req.body;

      const usernameNormalizado = normalizarUsername(username);
      const rolNormalizado = normalizarRol(rol);

      const usuarioExistente = await Usuario.findOne({
        username: usernameNormalizado
      });
      if (usuarioExistente) {
        return res.status(400).json({
          success: false,
          message: 'El username ya esta registrado'
        });
      }

      if (email) {
        const emailExiste = await Usuario.findOne({
          email: String(email).trim().toLowerCase()
        });
        if (emailExiste) {
          return res.status(400).json({
            success: false,
            message: 'El email ya esta registrado'
          });
        }
      }

      let puntoVenta = null;
      if (rolNormalizado === 'punto_venta') {
        if (!puntoVentaId) {
          return res.status(400).json({
            success: false,
            message: 'Debe seleccionar un punto de venta'
          });
        }
        puntoVenta = await obtenerPuntoVenta(puntoVentaId);
      }

      const usuario = await Usuario.create({
        nombre: String(nombre).trim(),
        username: usernameNormalizado,
        email: email ? String(email).trim().toLowerCase() : undefined,
        password,
        rol: rolNormalizado,
        puntoVenta: puntoVenta?._id || null
      });

      await usuario.populate('puntoVenta');

      return res.status(201).json({
        success: true,
        data: formatearUsuario(usuario)
      });
    } catch (error) {
      console.error('Error en registro:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al registrar usuario'
      });
    }
  }
);

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('El usuario es requerido'),
    body('password').notEmpty().withMessage('La contrasena es requerida')
  ],
  async (req, res) => {
    const errorResponse = validarRequest(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const usernameEntrada = normalizarUsername(req.body.username);
      const password = req.body.password;
      const emailRegex = new RegExp(`^${escaparRegex(usernameEntrada)}@`, 'i');

      const usuario = await Usuario.findOne({
        $or: [
          { username: usernameEntrada },
          { email: usernameEntrada },
          { email: emailRegex }
        ]
      })
        .select('+password')
        .populate('puntoVenta');

      if (!usuario) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales invalidas'
        });
      }

      if (!usuario.activo) {
        return res.status(401).json({
          success: false,
          message: 'Usuario inactivo. Contacte al administrador'
        });
      }

      const isMatch = await usuario.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales invalidas'
        });
      }

      usuario.ultimoAcceso = new Date();
      const rolNormalizado = normalizarRol(usuario.rol);
      if (rolNormalizado !== usuario.rol) {
        usuario.rol = rolNormalizado;
      }
      await usuario.save();

      return res.json({
        success: true,
        token: generarToken(usuario._id),
        user: formatearUsuario(usuario)
      });
    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al iniciar sesion'
      });
    }
  }
);

router.get('/me', protect, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id).populate('puntoVenta');

    return res.json({
      success: true,
      data: formatearUsuario(usuario)
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener informacion del usuario'
    });
  }
});

router.get('/usuarios', protect, authorize('admin'), async (req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select('-password')
      .populate('puntoVenta')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: usuarios.length,
      data: usuarios.map(formatearUsuario)
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

router.put(
  '/usuarios/:id',
  protect,
  authorize('admin'),
  [
    body('nombre')
      .optional({ checkFalsy: true })
      .trim()
      .notEmpty()
      .withMessage('El nombre es requerido'),
    body('username')
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^[a-zA-Z0-9._-]{3,30}$/)
      .withMessage('Username invalido'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('La contrasena debe tener al menos 6 caracteres'),
    body('rol')
      .optional({ checkFalsy: true })
      .isIn(['admin', 'punto_venta'])
      .withMessage('Rol invalido'),
    body('email')
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage('Email invalido'),
    body('puntoVentaId')
      .optional({ nullable: true, checkFalsy: true })
      .isMongoId()
      .withMessage('Punto de venta invalido')
  ],
  async (req, res) => {
    const errorResponse = validarRequest(req, res);
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const usuario = await Usuario.findById(req.params.id).populate('puntoVenta');
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const {
        nombre,
        username,
        password,
        rol,
        activo,
        email,
        puntoVentaId
      } = req.body;

      if (nombre) {
        usuario.nombre = String(nombre).trim();
      }

      if (typeof username === 'string' && username.trim()) {
        const usernameNormalizado = normalizarUsername(username);
        const usernameExiste = await Usuario.findOne({
          username: usernameNormalizado,
          _id: { $ne: usuario._id }
        });
        if (usernameExiste) {
          return res.status(400).json({
            success: false,
            message: 'El username ya esta registrado'
          });
        }
        usuario.username = usernameNormalizado;
      }

      if (typeof email !== 'undefined') {
        if (email) {
          const emailNormalizado = String(email).trim().toLowerCase();
          const emailExiste = await Usuario.findOne({
            email: emailNormalizado,
            _id: { $ne: usuario._id }
          });
          if (emailExiste) {
            return res.status(400).json({
              success: false,
              message: 'El email ya esta registrado'
            });
          }
          usuario.email = emailNormalizado;
        } else {
          usuario.email = undefined;
        }
      }

      const rolNormalizado = rol ? normalizarRol(rol) : normalizarRol(usuario.rol);
      usuario.rol = rolNormalizado;

      if (rolNormalizado === 'punto_venta') {
        const puntoIdFinal = puntoVentaId || usuario.puntoVenta?._id || usuario.puntoVenta;
        if (!puntoIdFinal) {
          return res.status(400).json({
            success: false,
            message: 'El usuario de punto de venta debe tener un local asignado'
          });
        }
        const puntoVenta = await obtenerPuntoVenta(puntoIdFinal);
        usuario.puntoVenta = puntoVenta._id;
      } else if (typeof puntoVentaId !== 'undefined') {
        usuario.puntoVenta = puntoVentaId || null;
      }

      if (typeof activo !== 'undefined') {
        usuario.activo = Boolean(activo);
      }

      if (password) {
        usuario.password = password;
      }

      await usuario.save();
      await usuario.populate('puntoVenta');

      return res.json({
        success: true,
        data: formatearUsuario(usuario)
      });
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar usuario'
      });
    }
  }
);

router.delete('/usuarios/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (normalizarRol(usuario.rol) === 'admin') {
      const adminCount = await Usuario.countDocuments({ rol: 'admin', activo: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el ultimo administrador'
        });
      }
    }

    await usuario.deleteOne();

    return res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});

module.exports = router;
