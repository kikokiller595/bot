require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB, getMongoStatus } = require('./config/db');

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

  app.set('trust proxy', 1);

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

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Healthcheck simple para Railway. Debe responder aunque Mongo tarde.
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      database: getMongoStatus()
    });
  });

  app.use('/api/init', require('./routes/init'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/puntos-venta', require('./routes/puntosVenta'));
  app.use('/api/loterias', require('./routes/loterias'));
  app.use('/api/sorteos', require('./routes/sorteos'));

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
    console.error('Error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Error del servidor'
    });
  });

  return { app, allowedOrigins };
};

const startServer = async () => {
  const { app, allowedOrigins } = createApp();
  const PORT = process.env.PORT || 8080;
  const HOST = process.env.HOST || '0.0.0.0';

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
