const mongoose = require('mongoose');

const getMongoStatus = () => {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
};

const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const retryDelay = Number(process.env.MONGODB_RETRY_DELAY_MS || 5000);
    console.error(`Error de conexion MongoDB (intento ${attempt}): ${error.message}`);
    console.log(`Reintentando conexion a MongoDB en ${retryDelay / 1000} segundos...`);

    setTimeout(() => {
      connectDB(attempt + 1);
    }, retryDelay);

    return null;
  }
};

module.exports = {
  connectDB,
  getMongoStatus
};
