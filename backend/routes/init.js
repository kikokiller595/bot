const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const Usuario = require('../models/Usuario');

const router = express.Router();
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Demasiados intentos de inicializacion. Intenta nuevamente mas tarde.'
  }
});

const obtenerConfiguracionAdmin = () => {
  const username = String(
    process.env.INITIAL_ADMIN_USERNAME || 'admin'
  ).trim().toLowerCase();
  const password = String(process.env.INITIAL_ADMIN_PASSWORD || '');
  const setupToken = String(process.env.INITIAL_ADMIN_SETUP_TOKEN || '');
  const nombre = String(
    process.env.INITIAL_ADMIN_NAME || 'Administrador'
  ).trim();
  const email = String(process.env.INITIAL_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const errores = [];
  const esValorDeEjemplo = (valor) =>
    /^(reemplaza|cambia|change|example|tu_)/i.test(String(valor || '').trim());

  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    errores.push('INITIAL_ADMIN_USERNAME es invalido');
  }
  if (password.length < 12 || esValorDeEjemplo(password)) {
    errores.push('INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }
  if (setupToken.length < 16 || esValorDeEjemplo(setupToken)) {
    errores.push('INITIAL_ADMIN_SETUP_TOKEN debe tener al menos 16 caracteres');
  }

  return {
    listo: errores.length === 0,
    errores,
    setupToken,
    usuario: {
      nombre: nombre || 'Administrador',
      username,
      email: email || undefined,
      password,
      rol: 'admin',
      puntoVenta: null,
      activo: true
    }
  };
};

const compararSecreto = (recibido, esperado) => {
  const valorRecibido = Buffer.from(String(recibido || ''));
  const valorEsperado = Buffer.from(String(esperado || ''));

  if (
    valorRecibido.length === 0 ||
    valorRecibido.length !== valorEsperado.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(valorRecibido, valorEsperado);
};

const autorizarInicializacion = (req, res) => {
  const configuracion = obtenerConfiguracionAdmin();
  if (!configuracion.listo) {
    res.status(503).json({
      success: false,
      message: 'La inicializacion administrativa no esta configurada'
    });
    return null;
  }

  const tokenRecibido = req.get('x-setup-token');
  if (!compararSecreto(tokenRecibido, configuracion.setupToken)) {
    res.status(403).json({
      success: false,
      message: 'Token de inicializacion invalido'
    });
    return null;
  }

  return configuracion;
};

const formatearAdmin = (admin) => ({
  id: admin._id,
  nombre: admin.nombre,
  username: admin.username,
  email: admin.email || '',
  rol: 'admin'
});

router.post('/admin', setupLimiter, async (req, res) => {
  const configuracion = autorizarInicializacion(req, res);
  if (!configuracion) {
    return;
  }

  try {
    const usuariosCount = await Usuario.countDocuments();

    if (usuariosCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existen usuarios en el sistema. Use el registro normal.'
      });
    }

    const admin = await Usuario.create(configuracion.usuario);

    return res.status(201).json({
      success: true,
      message: 'Usuario administrador creado exitosamente',
      data: formatearAdmin(admin)
    });
  } catch (error) {
    console.error('Error al crear administrador inicial:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear usuario administrador'
    });
  }
});

router.post('/reset-admin', setupLimiter, async (req, res) => {
  if (process.env.ALLOW_RESET_ADMIN !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'Reset de administrador deshabilitado'
    });
  }

  const configuracion = autorizarInicializacion(req, res);
  if (!configuracion) {
    return;
  }

  try {
    let admin = await Usuario.findOne({
      username: configuracion.usuario.username
    });

    if (!admin) {
      admin = await Usuario.findOne({ rol: 'admin' });
    }

    if (!admin) {
      admin = new Usuario();
    }

    Object.assign(admin, configuracion.usuario);
    await admin.save();

    await Usuario.updateMany(
      {
        _id: { $ne: admin._id },
        rol: 'admin'
      },
      {
        $set: { activo: false }
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario administrador recuperado exitosamente',
      data: formatearAdmin(admin)
    });
  } catch (error) {
    console.error('Error al recuperar administrador:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recuperar usuario administrador'
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const usuariosCount = await Usuario.countDocuments();
    const initialized = usuariosCount > 0;
    const setupReady = obtenerConfiguracionAdmin().listo;

    return res.json({
      success: true,
      initialized,
      setupReady,
      message: initialized
        ? 'Sistema inicializado correctamente.'
        : setupReady
          ? 'Sistema listo para crear el primer administrador.'
          : 'Configure las variables INITIAL_ADMIN_* antes de inicializar.'
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
