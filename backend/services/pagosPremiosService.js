const mongoose = require('mongoose');
const PagoPremio = require('../models/PagoPremio');
const Sorteo = require('../models/Sorteo');
const { evaluarSorteoGanador } = require('../utils/premios');
const {
  contarCoincidenciasBulk,
  crearClavePago,
  esErrorTransaccionNoDisponible,
  obtenerIdSorteo
} = require('../utils/pagos');

const crearErrorPago = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const obtenerContextoUsuario = (usuario, fecha) => {
  const puntoVenta = usuario?.puntoVenta?._id || usuario?.puntoVenta || null;
  const puntoVentaNombre =
    usuario?.puntoVenta?.nombre ||
    (usuario?.rol === 'admin' ? 'Administracion Central' : '');

  return {
    usuario: usuario.id,
    usuarioNombre: usuario.nombre,
    puntoVenta,
    puntoVentaNombre,
    fecha
  };
};

const crearEntradaHistorial = (accion, contexto) => ({
  accion,
  usuario: contexto.usuario,
  usuarioNombre: contexto.usuarioNombre,
  puntoVenta: contexto.puntoVenta,
  puntoVentaNombre: contexto.puntoVentaNombre,
  fecha: contexto.fecha
});

const obtenerSorteosPago = (query, session) =>
  Sorteo.find(query)
    .session(session)
    .populate({
      path: 'loteria',
      select: 'nombre premios numerosGanadores',
      options: { session }
    });

const reclamarRegistroPago = async ({
  clavePago,
  referencia,
  sorteos,
  sorteosGanadores,
  montoTotal,
  contexto,
  session
}) => {
  const existente = await PagoPremio.findOne({ clavePago }).session(session);

  if (existente?.estado === 'pagado') {
    throw crearErrorPago(409, 'Este ticket ya fue pagado');
  }

  const datosPago = {
    referenciaTipo: referencia.tipo,
    referenciaValor: referencia.valor,
    sorteos: sorteos.map((sorteo) => sorteo._id),
    sorteosGanadores: sorteosGanadores.map(({ sorteo }) => sorteo._id),
    montoTotal,
    estado: 'pagado',
    pagadoPor: contexto.usuario,
    pagadoPorNombre: contexto.usuarioNombre,
    fechaPago: contexto.fecha,
    puntoVentaPago: contexto.puntoVenta,
    puntoVentaPagoNombre: contexto.puntoVentaNombre
  };

  if (!existente) {
    const [creado] = await PagoPremio.create(
      [{
        clavePago,
        ...datosPago,
        historial: [crearEntradaHistorial('pago', contexto)]
      }],
      { session }
    );
    return creado;
  }

  const actualizado = await PagoPremio.findOneAndUpdate(
    {
      _id: existente._id,
      estado: 'anulado'
    },
    {
      $set: datosPago,
      $push: {
        historial: crearEntradaHistorial('pago', contexto)
      }
    },
    {
      new: true,
      session
    }
  );

  if (!actualizado) {
    throw crearErrorPago(409, 'Este ticket esta siendo procesado por otra terminal');
  }

  return actualizado;
};

const registrarAnulacion = async ({
  clavePago,
  referencia,
  sorteos,
  sorteosPagados,
  contexto,
  session
}) => {
  const existente = await PagoPremio.findOne({ clavePago }).session(session);
  const montoTotal = sorteosPagados.reduce(
    (total, { sorteo }) => total + (Number(sorteo.premio) || 0),
    0
  );

  if (!existente) {
    const [creado] = await PagoPremio.create(
      [{
        clavePago,
        referenciaTipo: referencia.tipo,
        referenciaValor: referencia.valor,
        sorteos: sorteos.map((sorteo) => sorteo._id),
        sorteosGanadores: sorteosPagados.map(({ sorteo }) => sorteo._id),
        montoTotal,
        estado: 'anulado',
        historial: [crearEntradaHistorial('anulacion', contexto)]
      }],
      { session }
    );
    return creado;
  }

  const actualizado = await PagoPremio.findOneAndUpdate(
    {
      _id: existente._id,
      estado: 'pagado'
    },
    {
      $set: {
        estado: 'anulado'
      },
      $push: {
        historial: crearEntradaHistorial('anulacion', contexto)
      }
    },
    {
      new: true,
      session
    }
  );

  if (!actualizado) {
    throw crearErrorPago(409, 'El pago ya fue anulado por otra terminal');
  }

  return actualizado;
};

const construirOperacionPago = ({ sorteo, resultado, pago, contexto }) => ({
  updateOne: {
    filter: {
      _id: sorteo._id,
      pagado: { $ne: true }
    },
    update: {
      $set: {
        ganador: true,
        premio: resultado.premioTotal,
        numeroGanador: resultado.coincidencias
          .map((coincidencia) => coincidencia.numeroGanador)
          .filter(Boolean)
          .join(', '),
        pagado: true,
        pagadoPor: contexto.usuario,
        pagadoPorNombre: contexto.usuarioNombre,
        fechaPago: contexto.fecha,
        puntoVentaPago: contexto.puntoVenta,
        puntoVentaPagoNombre: contexto.puntoVentaNombre,
        pagoPremio: pago._id
      }
    }
  }
});

const construirOperacionAnulacion = ({ sorteo }) => ({
  updateOne: {
    filter: {
      _id: sorteo._id,
      pagado: true
    },
    update: {
      $set: {
        pagado: false,
        pagadoPor: null,
        pagadoPorNombre: '',
        fechaPago: null,
        puntoVentaPago: null,
        puntoVentaPagoNombre: '',
        pagoPremio: null
      }
    }
  }
});

const ejecutarPago = async ({
  sorteos,
  evaluaciones,
  referencia,
  usuario,
  session
}) => {
  if (sorteos.some((sorteo) => sorteo.pagado)) {
    throw crearErrorPago(409, 'Este ticket ya fue pagado');
  }

  const sorteosGanadores = evaluaciones.filter(
    ({ resultado }) => resultado.ganador
  );
  if (sorteosGanadores.length === 0) {
    throw crearErrorPago(
      400,
      'Este ticket no tiene premios ganadores registrados para pagar'
    );
  }

  const fechaPago = new Date();
  const contexto = obtenerContextoUsuario(usuario, fechaPago);
  const clavePago = crearClavePago(sorteos);
  const montoTotal = sorteosGanadores.reduce(
    (total, { resultado }) => total + resultado.premioTotal,
    0
  );
  const pago = await reclamarRegistroPago({
    clavePago,
    referencia,
    sorteos,
    sorteosGanadores,
    montoTotal,
    contexto,
    session
  });
  const operaciones = sorteosGanadores.map(({ sorteo, resultado }) =>
    construirOperacionPago({ sorteo, resultado, pago, contexto })
  );
  const resultadoBulk = await Sorteo.bulkWrite(operaciones, {
    ordered: true,
    session
  });

  if (contarCoincidenciasBulk(resultadoBulk) !== operaciones.length) {
    throw crearErrorPago(
      409,
      'Este ticket fue pagado simultaneamente por otra terminal'
    );
  }

  return sorteosGanadores.map(({ sorteo }) => sorteo._id);
};

const ejecutarAnulacion = async ({
  sorteos,
  evaluaciones,
  referencia,
  usuario,
  session
}) => {
  if (String(usuario?.rol || '').trim().toLowerCase() !== 'admin') {
    throw crearErrorPago(
      403,
      'Solo el administrador puede anular un pago de premio'
    );
  }

  const sorteosPagados = evaluaciones.filter(({ sorteo }) => sorteo.pagado);
  if (sorteosPagados.length === 0) {
    throw crearErrorPago(409, 'Este ticket no tiene un pago activo para anular');
  }

  const contexto = obtenerContextoUsuario(usuario, new Date());
  await registrarAnulacion({
    clavePago: crearClavePago(sorteos),
    referencia,
    sorteos,
    sorteosPagados,
    contexto,
    session
  });

  const operaciones = sorteosPagados.map(({ sorteo }) =>
    construirOperacionAnulacion({ sorteo })
  );
  const resultadoBulk = await Sorteo.bulkWrite(operaciones, {
    ordered: true,
    session
  });

  if (contarCoincidenciasBulk(resultadoBulk) !== operaciones.length) {
    throw crearErrorPago(
      409,
      'El pago fue modificado simultaneamente por otra terminal'
    );
  }

  return sorteosPagados.map(({ sorteo }) => sorteo._id);
};

const actualizarPagoTicketAtomico = async ({
  query,
  referencia,
  usuario,
  pagado,
  zonaHoraria
}) => {
  await PagoPremio.init();
  const session = await mongoose.startSession();
  let idsActualizados = [];

  try {
    await session.withTransaction(
      async () => {
        const sorteos = await obtenerSorteosPago(query, session);
        if (sorteos.length === 0) {
          throw crearErrorPago(
            404,
            'No se encontraron tickets para actualizar'
          );
        }

        const evaluaciones = sorteos.map((sorteo) => ({
          sorteo,
          resultado: evaluarSorteoGanador(sorteo, sorteo.loteria, {
            zonaHoraria
          })
        }));

        idsActualizados = pagado
          ? await ejecutarPago({
              sorteos,
              evaluaciones,
              referencia,
              usuario,
              session
            })
          : await ejecutarAnulacion({
              sorteos,
              evaluaciones,
              referencia,
              usuario,
              session
            });
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      }
    );

    const actualizados = await Sorteo.find({
      _id: { $in: idsActualizados }
    }).lean();
    const porId = new Map(
      actualizados.map((sorteo) => [obtenerIdSorteo(sorteo), sorteo])
    );

    return idsActualizados
      .map((id) => porId.get(String(id)))
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 11000) {
      throw crearErrorPago(409, 'Este ticket ya fue pagado');
    }

    if (esErrorTransaccionNoDisponible(error)) {
      throw crearErrorPago(
        503,
        'La base de datos debe soportar transacciones para procesar pagos'
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  actualizarPagoTicketAtomico,
  construirOperacionAnulacion,
  construirOperacionPago,
  crearErrorPago
};
