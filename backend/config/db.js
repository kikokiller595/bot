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

const cleanupLegacyUserEmailIndex = async (conn) => {
  try {
    const usuariosCollection = conn.connection.db.collection('usuarios');
    await usuariosCollection.updateMany(
      { email: null },
      { $unset: { email: '' } }
    );

    const indexes = await usuariosCollection.indexes();
    const emailIndex = indexes.find((index) => index.name === 'email_1');
    if (emailIndex) {
      await usuariosCollection.dropIndex('email_1');
      console.log('Indice legado email_1 eliminado de usuarios');
    }
  } catch (error) {
    console.error(`No se pudo limpiar el indice email_1: ${error.message}`);
  }
};

const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    await cleanupLegacyUserEmailIndex(conn);
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
