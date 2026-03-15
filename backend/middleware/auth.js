const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const normalizarRol = (rol) => {
  const valor = String(rol || '').trim().toLowerCase();
  return valor === 'vendedor' ? 'punto_venta' : valor;
};

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado para acceder a esta ruta'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).populate('puntoVenta');

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    const rolNormalizado = normalizarRol(usuario.rol);
    if (rolNormalizado !== usuario.rol) {
      usuario.rol = rolNormalizado;
      await usuario.save();
    }

    req.user = usuario;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token invalido o expirado'
    });
  }
};

exports.authorize = (...roles) => {
  const rolesPermitidos = roles.map(normalizarRol);

  return (req, res, next) => {
    const rolUsuario = normalizarRol(req.user?.rol);
    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        success: false,
        message: `El rol ${rolUsuario} no esta autorizado para acceder a esta ruta`
      });
    }
    return next();
  };
};
