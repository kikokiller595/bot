require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, getMongoStatus } = require('./config/db');
const { startBotSyncScheduler } = require('./services/resultadosBotService');

const frontendBuildPath = path.join(__dirname, '..', 'build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

const parseAllowedOrigins = () => {
  const defaults =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:3001'];

  const envOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...envOrigins])];
};

const createApp = () => {
  const app = express();
  const allowedOrigins = parseAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';
  const helmetOptions = {
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups'
    },
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: isProduction ? [] : null
      }
    }
  };

  if (!isProduction) {
    helmetOptions.strictTransportSecurity = false;
  }

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet(helmetOptions));

  const getRequestOrigin = (req) => {
    const protocol =
      req.headers['x-forwarded-proto'] ||
      req.protocol ||
      (process.env.NODE_ENV === 'production' ? 'https' : 'http');

    return `${protocol}://${req.headers.host}`;
  };

  app.use((req, res, next) => {
    const corsMiddleware = cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }

        try {
          const sameHost = new URL(origin).origin === getRequestOrigin(req);
          if (sameHost || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
        } catch (error) {
          return callback(new Error('Origen invalido'));
        }

        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
      },
      credentials: true
    });

    return corsMiddleware(req, res, next);
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Healthcheck simple para Railway. Debe responder aunque Mongo tarde.
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      database: getMongoStatus()
    });
  });

  app.get('/ready', (req, res) => {
    const database = getMongoStatus();
    const ready = database === 'connected';

    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? 'ready' : 'not_ready',
      database
    });
  });

  app.use('/api/init', require('./routes/init'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/puntos-venta', require('./routes/puntosVenta'));
  app.use('/api/loterias', require('./routes/loterias'));
  app.use('/api/sorteos', require('./routes/sorteos'));
  app.use('/api/recogidas', require('./routes/recogidas'));
  app.use('/api/resultados-bot', require('./routes/resultadosBot'));

  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'API de TBY Sistemas - Sistema de Loteria',
      version: '1.0.0'
    });
  });

  if (hasFrontendBuild) {
    app.use(express.static(frontendBuildPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      return res.sendFile(frontendIndexPath);
    });
  } else {
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'API de TBY Sistemas - Sistema de Loteria',
        version: '1.0.0'
      });
    });
  }

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Ruta no encontrada'
    });
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    console.error('Error:', err);
    res.status(status).json({
      success: false,
      message: status < 500 ? err.message : 'Error del servidor'
    });
  });

  return { app, allowedOrigins };
};

const validarConfiguracionProduccion = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const errores = [];
  const mongodbUri = String(process.env.MONGODB_URI || '').trim();
  const jwtSecret = String(process.env.JWT_SECRET || '');
  const esValorDeEjemplo = (valor) =>
    /^(tu_|reemplaza|cambia|change|example)/i.test(String(valor || '').trim());

  if (!mongodbUri || esValorDeEjemplo(mongodbUri)) {
    errores.push('MONGODB_URI');
  }
  if (jwtSecret.length < 32 || esValorDeEjemplo(jwtSecret)) {
    errores.push('JWT_SECRET de al menos 32 caracteres');
  }

  if (errores.length > 0) {
    throw new Error(
      `Configuracion de produccion invalida: ${errores.join(', ')}`
    );
  }
};

const startServer = async () => {
  validarConfiguracionProduccion();
  const { app, allowedOrigins } = createApp();
  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';

  startBotSyncScheduler();

  app.listen(PORT, HOST, () => {
    const frontendInfo =
      allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'mismo dominio';

    console.log('==============================================');
    console.log('TBY SISTEMAS - API DE LOTERIA');
    console.log(`Servidor corriendo en ${HOST}:${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend permitido: ${frontendInfo}`);
    console.log(`Build frontend detectado: ${hasFrontendBuild ? 'si' : 'no'}`);
    console.log(`Estado inicial MongoDB: ${getMongoStatus()}`);
    console.log('==============================================');
  });

  await connectDB();
};

startServer().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Error no manejado:', err);
  process.exit(1);
});
