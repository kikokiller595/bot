const crypto = require('crypto');

const obtenerIdSorteo = (sorteo) =>
  String(sorteo?._id || sorteo?.id || '').trim();

const crearClavePago = (sorteos = []) => {
  const ids = sorteos
    .map(obtenerIdSorteo)
    .filter(Boolean)
    .sort();

  if (ids.length === 0) {
    throw new Error('No hay sorteos para construir la clave de pago');
  }

  return crypto
    .createHash('sha256')
    .update(ids.join(':'))
    .digest('hex');
};

const crearReferenciaPago = ({ grupoId, ticketId, id } = {}) => {
  if (grupoId) {
    return {
      tipo: 'grupoId',
      valor: String(grupoId).trim()
    };
  }

  if (ticketId) {
    return {
      tipo: 'ticketId',
      valor: String(ticketId).trim()
    };
  }

  return {
    tipo: 'id',
    valor: String(id || '').trim()
  };
};

const contarCoincidenciasBulk = (resultado) =>
  Number(
    resultado?.matchedCount ??
    resultado?.nMatched ??
    resultado?.result?.nMatched ??
    0
  );

const esErrorTransaccionNoDisponible = (error) => {
  const mensaje = String(error?.message || '');
  return (
    error?.code === 20 ||
    error?.codeName === 'IllegalOperation' ||
    /transaction numbers are only allowed|transactions are not supported/i.test(
      mensaje
    )
  );
};

module.exports = {
  contarCoincidenciasBulk,
  crearClavePago,
  crearReferenciaPago,
  esErrorTransaccionNoDisponible,
  obtenerIdSorteo
};
