const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');

const ADMIN_DEFAULT = {
  nombre: 'Administrador',
  username: 'admin',
  email: 'admin@tbysistemas.com',
  password: 'admin123',
  rol: 'admin'
};

const formatearAdmin = (admin) => ({
  id: admin._id,
  nombre: admin.nombre,
  username: admin.username || ADMIN_DEFAULT.username,
  email: admin.email || ADMIN_DEFAULT.email,
  rol: 'admin'
});

router.post('/admin', async (req, res) => {
  try {
    const usuariosCount = await Usuario.countDocuments();

    if (usuariosCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existen usuarios en el sistema. Use el registro normal.'
      });
    }

    const admin = await Usuario.create(ADMIN_DEFAULT);

    return res.status(201).json({
      success: true,
      message: 'Usuario administrador creado exitosamente',
      data: formatearAdmin(admin),
      credentials: {
        username: ADMIN_DEFAULT.username,
        password: ADMIN_DEFAULT.password,
        warning: 'IMPORTANTE: Cambia esta contrasena despues del primer login'
      }
    });
  } catch (error) {
    console.error('Error al crear administrador inicial:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear usuario administrador',
      error: error.message
    });
  }
});

router.post('/reset-admin', async (req, res) => {
  try {
    if (process.env.ALLOW_RESET_ADMIN !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Reset de administrador deshabilitado'
      });
    }

    await Usuario.deleteMany({ rol: 'admin' });
    const admin = await Usuario.create(ADMIN_DEFAULT);

    return res.status(201).json({
      success: true,
      message: 'Usuario administrador recreado exitosamente',
      data: formatearAdmin(admin),
      credentials: {
        username: ADMIN_DEFAULT.username,
        password: ADMIN_DEFAULT.password,
        warning: 'IMPORTANTE: Cambia esta contrasena despues del primer login'
      }
    });
  } catch (error) {
    console.error('Error al recrear administrador:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recrear usuario administrador',
      error: error.message
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const usuariosCount = await Usuario.countDocuments();

    return res.json({
      success: true,
      initialized: usuariosCount > 0,
      usersCount: usuariosCount,
      defaultAdminUsername: ADMIN_DEFAULT.username,
      message:
        usuariosCount === 0
          ? 'Sistema no inicializado. Use POST /api/init/admin para crear el primer administrador.'
          : 'Sistema inicializado correctamente.'
    });
  } catch (error) {
    console.error('Error al verificar estado:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar estado del sistema'
    });
  }
});

module.exports = router;
