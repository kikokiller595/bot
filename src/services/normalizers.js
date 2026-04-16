import { normalizarPremios } from '../utils/premiosDefault';

const toId = (value, fallback = '') => {
  if (value == null) {
    return fallback;
  }
  return String(value);
};

const formatFechaCreacion = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && value.includes('/')) {
    return value;
  }

  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return String(value);
  }

  return fecha.toLocaleString('es-ES');
};

export const normalizeNumeroGanador = (numero, index = 0) => {
  if (!numero) {
    return null;
  }

  return {
    id: toId(numero.id || numero._id, `numero-${index}`),
    numero: String(numero.numero || '').trim(),
    fecha: String(numero.fecha || '').trim(),
    fechaRegistro: numero.fechaRegistro
      ? String(numero.fechaRegistro)
      : new Date().toLocaleString('es-ES'),
    premio: Number(numero.premio) || 0
  };
};

export const normalizeLoteria = (loteria) => {
  if (!loteria) {
    return null;
  }

  const id = toId(loteria.id || loteria._id);
  const numerosGanadores = Array.isArray(loteria.numerosGanadores)
    ? loteria.numerosGanadores
        .map((numero, index) => normalizeNumeroGanador(numero, index))
        .filter(Boolean)
    : [];

  return {
    ...loteria,
    id,
    _id: id,
    nombre: String(loteria.nombre || '').trim(),
    horaCierre: String(loteria.horaCierre || '').trim(),
    premios: normalizarPremios(loteria.premios),
    numerosGanadores,
    fechaCreacion: formatFechaCreacion(
      loteria.fechaCreacion || loteria.createdAt
    ),
    createdAt: loteria.createdAt || null,
    updatedAt: loteria.updatedAt || null
  };
};

export const normalizePuntoVenta = (puntoVenta) => {
  if (!puntoVenta) {
    return null;
  }

  const id = toId(puntoVenta.id || puntoVenta._id);
  return {
    ...puntoVenta,
    id,
    _id: id,
    codigo: String(puntoVenta.codigo || '').trim(),
    nombre: String(puntoVenta.nombre || '').trim(),
    tipo: String(puntoVenta.tipo || '').trim(),
    ubicacion: String(puntoVenta.ubicacion || '').trim(),
    telefono: String(puntoVenta.telefono || '').trim(),
    porcentajeSocio: Number(puntoVenta.porcentajeSocio) || 0,
    responsable: String(puntoVenta.responsable || '').trim(),
    username: String(puntoVenta.username || '').trim().toLowerCase(),
    usuarioId: toId(puntoVenta.usuarioId || puntoVenta.userId || ''),
    activo: typeof puntoVenta.activo === 'boolean' ? puntoVenta.activo : true
  };
};

export const normalizeUser = (user) => {
  if (!user) {
    return null;
  }

  const puntoVentaRef =
    user.puntoVenta && typeof user.puntoVenta === 'object'
      ? normalizePuntoVenta(user.puntoVenta)
      : null;

  return {
    ...user,
    id: toId(user.id || user._id),
    _id: toId(user.id || user._id),
    nombre: String(user.nombre || '').trim(),
    username: String(user.username || '').trim().toLowerCase(),
    email: String(user.email || '').trim(),
    rol:
      String(user.rol || '').trim().toLowerCase() === 'vendedor'
        ? 'punto_venta'
        : String(user.rol || '').trim().toLowerCase(),
    activo: typeof user.activo === 'boolean' ? user.activo : true,
    puntoVentaId: toId(
      user.puntoVentaId || puntoVentaRef?.id || user.puntoVenta,
      ''
    ),
    puntoVentaNombre: String(
      user.puntoVentaNombre || puntoVentaRef?.nombre || ''
    ).trim(),
    puntoVentaCodigo: String(
      user.puntoVentaCodigo || puntoVentaRef?.codigo || ''
    ).trim(),
    puntoVentaDetalle: puntoVentaRef,
    ultimoAcceso: user.ultimoAcceso || null
  };
};

export const normalizeSorteo = (sorteo) => {
  if (!sorteo) {
    return null;
  }

  const id = toId(sorteo.id || sorteo._id);
  const loteriaRef =
    sorteo.loteria && typeof sorteo.loteria === 'object'
      ? normalizeLoteria(sorteo.loteria)
      : null;
  const loteriaId = toId(
    sorteo.loteriaId || loteriaRef?.id || sorteo.loteria,
    ''
  );

  return {
    ...sorteo,
    id,
    _id: id,
    ticketId: sorteo.ticketId ? String(sorteo.ticketId) : id,
    numero: String(sorteo.numero || '').trim(),
    monto: Number(sorteo.monto) || 0,
    tipoApuesta: String(
      sorteo.tipoApuesta || sorteo.tipo || 'straight'
    ).toLowerCase(),
    loteriaId,
    loteria: loteriaId,
    loteriaNombre: String(
      sorteo.loteriaNombre || loteriaRef?.nombre || ''
    ).trim(),
    loteriaDetalle: loteriaRef,
    vendedorId: toId(sorteo.vendedorId || sorteo.vendedor?._id || sorteo.vendedor),
    vendedorNombre: String(
      sorteo.vendedorNombre || sorteo.vendedor?.nombre || ''
    ).trim(),
    usuarioId: toId(sorteo.usuarioId || sorteo.usuario?._id || sorteo.usuario),
    usuarioNombre: String(
      sorteo.usuarioNombre || sorteo.usuario?.nombre || sorteo.vendedorNombre || ''
    ).trim(),
    username: String(
      sorteo.username || sorteo.usuario?.username || ''
    ).trim(),
    puntoVentaId: toId(
      sorteo.puntoVentaId || sorteo.puntoVenta?._id || sorteo.puntoVenta
    ),
    puntoVentaNombre: String(
      sorteo.puntoVentaNombre || sorteo.puntoVenta?.nombre || ''
    ).trim(),
    grupoId: sorteo.grupoId ? String(sorteo.grupoId) : null,
    fecha: sorteo.fechaTexto || sorteo.fecha || '',
    fechaISO: sorteo.fecha || null,
    ganador: Boolean(sorteo.ganador),
    numeroGanador: sorteo.numeroGanador || null,
    premio: Number(sorteo.premio) || 0,
    pagado: Boolean(sorteo.pagado),
    pagadoPorId: toId(sorteo.pagadoPorId || sorteo.pagadoPor?._id || sorteo.pagadoPor),
    pagadoPorNombre: String(
      sorteo.pagadoPorNombre || sorteo.pagadoPor?.nombre || ''
    ).trim(),
    fechaPago: sorteo.fechaPago || null,
    puntoVentaPagoId: toId(
      sorteo.puntoVentaPagoId || sorteo.puntoVentaPago?._id || sorteo.puntoVentaPago
    ),
    puntoVentaPagoNombre: String(
      sorteo.puntoVentaPagoNombre || sorteo.puntoVentaPago?.nombre || ''
    ).trim()
  };
};

export const normalizeLoterias = (loterias = []) =>
  Array.isArray(loterias)
    ? loterias.map(normalizeLoteria).filter(Boolean)
    : [];

export const normalizePuntosVenta = (puntosVenta = []) =>
  Array.isArray(puntosVenta)
    ? puntosVenta.map(normalizePuntoVenta).filter(Boolean)
    : [];

export const normalizeUsers = (users = []) =>
  Array.isArray(users)
    ? users.map(normalizeUser).filter(Boolean)
    : [];

export const normalizeSorteos = (sorteos = []) =>
  Array.isArray(sorteos)
    ? sorteos.map(normalizeSorteo).filter(Boolean)
    : [];

export const extractData = (responseData) => {
  if (
    responseData &&
    typeof responseData === 'object' &&
    Object.prototype.hasOwnProperty.call(responseData, 'data')
  ) {
    return responseData.data;
  }

  return responseData;
};
