require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Conectar a la base de datos
connectDB();

const app = express();

// Middleware - CORS configurado para múltiples orígenes
const parseAllowedOrigins = () => {
  const defaults = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://localhost:3001'];

  const envOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...envOrigins])];
};

const allowedOrigins = parseAllowedOrigins();

app.use(cors({
  origin: function(origin, callback) {
    // Permitir peticiones sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    // Permitir cualquier origen en desarrollo/producción (temporal)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/init', require('./routes/init'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/puntos-venta', require('./routes/puntosVenta'));
app.use('/api/loterias', require('./routes/loterias'));
app.use('/api/sorteos', require('./routes/sorteos'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API de TBY Sistemas - Sistema de Lotería',
    version: '1.0.0'
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error del servidor'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  const frontendInfo =
    allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'No configurado';

  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 TBY SISTEMAS - API DE LOTERÍA                    ║
║                                                        ║
║   ✅ Servidor corriendo en puerto ${PORT}                 ║
║   ✅ Entorno: ${process.env.NODE_ENV || 'development'}                      ║
║   ✅ Frontend URL(s): ${frontendInfo}         ║
║                                                        ║
║   📡 API disponible en: http://localhost:${PORT}         ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
  process.exit(1);
});
