const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Sorteo = require('../models/Sorteo');
const Loteria = require('../models/Loteria');
const PuntoVenta = require('../models/PuntoVenta');
const { protect, authorize } = require('../middleware/auth');

const TIPOS_APUESTA_VALIDOS = new Set([
  'straight',
  'box',
  'straightBox',
  'combo',
  'frontPair',
  'backPair',
  'bolita1',
  'bolita2',
  'singulation',
  'pick4tail3',
  'pick4tail3box',
  'pick4head3',
  'pick4head3box'
]);

const esPuntoVenta = (rol) => {
  const valor = String(rol || '').trim().toLowerCase();
  return valor === 'punto_venta' || valor === 'vendedor';
};

const LIMITE_ELIMINACION_PUNTO_VENTA_MS = 5 * 60 * 1000;

const obtenerFechaReferenciaEliminacion = (sorteo) => {
  const candidatos = [sorteo?.createdAt, sorteo?.fecha];

  for (const valor of candidatos) {
    const fecha = valor instanceof Date ? valor : new Date(valor);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha;
    }
  }

  return null;
};

const estaDentroVentanaEliminacion = (sorteo) => {
  const fechaTicket = obtenerFechaReferenciaEliminacion(sorteo);
  if (!fechaTicket) {
    return false;
  }

  return Date.now() - fechaTicket.getTime() <= LIMITE_ELIMINACION_PUNTO_VENTA_MS;
};

const ZONA_HORARIA_OPERATIVA =
  process.env.APP_TIMEZONE ||
  process.env.LOTTERY_TIMEZONE ||
  'America/New_York';

const obtenerClaveLocalFecha = (fecha) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) {
    return null;
  }

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_OPERATIVA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(valor);

  const anio = partes.find((parte) => parte.type === 'year')?.value;
  const mes = partes.find((parte) => parte.type === 'month')?.value;
  const dia = partes.find((parte) => parte.type === 'day')?.value;

  if (!anio || !mes || !dia) {
    return null;
  }

  return `${anio}-${mes}-${dia}`;
};

const fechaPermitidaParaUsuario = (usuario, fecha) => {
  if (String(usuario?.rol || '').trim().toLowerCase() === 'admin') {
    return true;
  }

  return obtenerClaveLocalFecha(fecha) === obtenerClaveLocalFecha(new Date());
};

const obtenerPuntoVentaUsuarioId = (usuario) =>
  usuario?.puntoVenta?._id || usuario?.puntoVenta || null;

const aplicarRestriccionOperativa = (query, usuario) => {
  const puntoVentaId = obtenerPuntoVentaUsuarioId(usuario);
  if (puntoVentaId) {
    query.puntoVenta = puntoVentaId;
    return query;
  }

  query.usuario = usuario.id;
  return query;
};

const crearErrorHttp = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolverPuntoVentaDestino = async (usuario, puntoVentaDestinoId) => {
  const destino = String(
    puntoVentaDestinoId || ''
  ).trim();

  if (!destino) {
    return null;
  }

  if (String(usuario?.rol || '').trim().toLowerCase() !== 'admin') {
    throw crearErrorHttp(
      403,
      'Solo el administrador puede registrar ventas hacia otra terminal'
    );
  }

  const puntoVenta = await PuntoVenta.findById(destino);
  if (!puntoVenta) {
    throw crearErrorHttp(404, 'Punto de venta destino no encontrado');
  }

  if (!puntoVenta.activo) {
    throw crearErrorHttp(400, 'El punto de venta destino no esta activo');
  }

  return puntoVenta;
};

const premiosPorDefecto = {
  pick2: {
    straightPrimera: 55,
    straightSegunda: 15,
    straightTercera: 10
  },
  singulation: {
    straight: 9
  },
  pick3: {
    straight: 700,
    triple: 500,
    boxPar: 232,
    boxTodosDiferentes: 116
  },
  pick4: {
    straight: 5000,
    cuadrupleStraight: 3000,
    boxCuadruple: 3000,
    boxTresIguales: 1200,
    boxDosPares: 800,
    boxUnPar: 400,
    boxTodosDiferentes: 200
  }
};

const numeroSeguro = (valor, fallback) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

const normalizarPremios = (entrada = null) => ({
  pick2: {
    straightPrimera: numeroSeguro(
      entrada?.pick2?.straightPrimera,
      premiosPorDefecto.pick2.straightPrimera
    ),
    straightSegunda: numeroSeguro(
      entrada?.pick2?.straightSegunda,
      premiosPorDefecto.pick2.straightSegunda
    ),
    straightTercera: numeroSeguro(
      entrada?.pick2?.straightTercera,
      premiosPorDefecto.pick2.straightTercera
    )
  },
  singulation: {
    straight: numeroSeguro(
      entrada?.singulation?.straight,
      premiosPorDefecto.singulation.straight
    )
  },
  pick3: {
    straight: numeroSeguro(
      entrada?.pick3?.straight,
      premiosPorDefecto.pick3.straight
    ),
    triple: numeroSeguro(
      entrada?.pick3?.triple,
      premiosPorDefecto.pick3.triple
    ),
    boxPar: numeroSeguro(
      entrada?.pick3?.boxPar,
      premiosPorDefecto.pick3.boxPar
    ),
    boxTodosDiferentes: numeroSeguro(
      entrada?.pick3?.boxTodosDiferentes,
      premiosPorDefecto.pick3.boxTodosDiferentes
    )
  },
  pick4: {
    straight: numeroSeguro(
      entrada?.pick4?.straight,
      premiosPorDefecto.pick4.straight
    ),
    cuadrupleStraight: numeroSeguro(
      entrada?.pick4?.cuadrupleStraight,
      premiosPorDefecto.pick4.cuadrupleStraight
    ),
    boxCuadruple: numeroSeguro(
      entrada?.pick4?.boxCuadruple,
      premiosPorDefecto.pick4.boxCuadruple
    ),
    boxTresIguales: numeroSeguro(
      entrada?.pick4?.boxTresIguales,
      premiosPorDefecto.pick4.boxTresIguales
    ),
    boxDosPares: numeroSeguro(
      entrada?.pick4?.boxDosPares,
      premiosPorDefecto.pick4.boxDosPares
    ),
    boxUnPar: numeroSeguro(
      entrada?.pick4?.boxUnPar,
      premiosPorDefecto.pick4.boxUnPar
    ),
    boxTodosDiferentes: numeroSeguro(
      entrada?.pick4?.boxTodosDiferentes,
      premiosPorDefecto.pick4.boxTodosDiferentes
    )
  }
});

const parseFechaEntrada = (valor) => {
  if (!valor) {
    return new Date();
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor;
  }

  if (typeof valor !== 'string') {
    return new Date();
  }

  const limpio = valor.trim();
  if (!limpio) {
    return new Date();
  }

  const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, anio, mes, dia, hora = '00', minuto = '00', segundo = '00'] = iso;
    const fechaIso = new Date(
      parseInt(anio, 10),
      parseInt(mes, 10) - 1,
      parseInt(dia, 10),
      parseInt(hora, 10),
      parseInt(minuto, 10),
      parseInt(segundo, 10)
    );
    if (!Number.isNaN(fechaIso.getTime())) {
      return fechaIso;
    }
  }

  const partes = limpio.split(',');
  const fechaParte = partes[0]?.trim() || '';
  const matchFecha = fechaParte.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchFecha) {
    const [, dia, mes, anio] = matchFecha;
    let horas = 0;
    let minutos = 0;
    let segundos = 0;

    const resto = partes.slice(1).join(',').trim();
    const matchHora = resto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (matchHora) {
      horas = parseInt(matchHora[1], 10);
      minutos = parseInt(matchHora[2], 10);
      segundos = matchHora[3] ? parseInt(matchHora[3], 10) : 0;
      const periodo = matchHora[4]?.toUpperCase();
      if (periodo === 'PM' && horas < 12) {
        horas += 12;
      }
      if (periodo === 'AM' && horas === 12) {
        horas = 0;
      }
    }

    const fechaEs = new Date(
      parseInt(anio, 10),
      parseInt(mes, 10) - 1,
      parseInt(dia, 10),
      horas,
      minutos,
      segundos
    );
    if (!Number.isNaN(fechaEs.getTime())) {
      return fechaEs;
    }
  }

  const fechaDirecta = new Date(limpio);
  if (!Number.isNaN(fechaDirecta.getTime())) {
    return fechaDirecta;
  }

  return new Date();
};

const detectarTipoBoxPick3 = (numero = '') => {
  if (numero.length !== 3) return null;
  const frecuencia = {};
  numero.split('').forEach(digito => {
    frecuencia[digito] = (frecuencia[digito] || 0) + 1;
  });

  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  if (valores[0] === 3) return 'triple';
  if (valores[0] === 2) return 'par';
  if (valores[0] === 1) return 'todos-diferentes';
  return null;
};

const detectarTipoBoxPick4 = (numero = '') => {
  if (numero.length !== 4) return null;
  const frecuencia = {};
  numero.split('').forEach(digito => {
    frecuencia[digito] = (frecuencia[digito] || 0) + 1;
  });

  const valores = Object.values(frecuencia).sort((a, b) => b - a);
  if (valores[0] === 4) return 'cuadruple';
  if (valores[0] === 3) return 'tres-iguales';
  if (valores[0] === 2 && valores[1] === 2) return 'dos-pares';
  if (valores[0] === 2) return 'un-par';
  if (valores[0] === 1) return 'todos-diferentes';
  return null;
};

const normalizarPosicion = (posicion) => {
  const valor = String(posicion || 'primera').trim().toLowerCase();
  if (valor === '2' || valor.startsWith('seg')) return 'segunda';
  if (valor === '3' || valor.startsWith('ter')) return 'tercera';
  return 'primera';
};

const calcularPremio = (tipoApuesta, numero, monto, configuracionPremios, opciones = {}) => {
  const premios = normalizarPremios(configuracionPremios);
  const montoNum = parseFloat(monto) || 0;
  if (montoNum <= 0) {
    return 0;
  }

  const numeroStr = String(numero || '').trim();
  const longitud = numeroStr.length;
  const posicion = normalizarPosicion(opciones.posicion);

  if (longitud === 1) {
    return tipoApuesta === 'singulation' ? montoNum * premios.singulation.straight : 0;
  }

  if (tipoApuesta === 'bolita1' || tipoApuesta === 'bolita2') {
    return longitud === 2 ? montoNum * 80 : 0;
  }

  if (longitud === 2) {
    if (tipoApuesta !== 'straight') return 0;
    if (posicion === 'segunda') return montoNum * premios.pick2.straightSegunda;
    if (posicion === 'tercera') return montoNum * premios.pick2.straightTercera;
    return montoNum * premios.pick2.straightPrimera;
  }

  if (longitud === 3) {
    const tipoBox = detectarTipoBoxPick3(numeroStr);
    if (tipoBox === 'triple') {
      return montoNum * premios.pick3.triple;
    }
    if (tipoApuesta === 'straight' || tipoApuesta === 'pick4tail3' || tipoApuesta === 'pick4head3') {
      return montoNum * premios.pick3.straight;
    }
    if (tipoApuesta === 'box' || tipoApuesta === 'pick4tail3box' || tipoApuesta === 'pick4head3box') {
      if (tipoBox === 'par') return montoNum * premios.pick3.boxPar;
      if (tipoBox === 'todos-diferentes') {
        return montoNum * premios.pick3.boxTodosDiferentes;
      }
    }
    return 0;
  }

  if (longitud === 4) {
    if (tipoApuesta === 'straight') {
      const esCuadruple = numeroStr.split('').every(digito => digito === numeroStr[0]);
      return montoNum * (esCuadruple ? premios.pick4.cuadrupleStraight : premios.pick4.straight);
    }

    if (tipoApuesta === 'box') {
      const tipoBox = detectarTipoBoxPick4(numeroStr);
      if (tipoBox === 'cuadruple') return montoNum * premios.pick4.boxCuadruple;
      if (tipoBox === 'tres-iguales') return montoNum * premios.pick4.boxTresIguales;
      if (tipoBox === 'dos-pares') return montoNum * premios.pick4.boxDosPares;
      if (tipoBox === 'un-par') return montoNum * premios.pick4.boxUnPar;
      if (tipoBox === 'todos-diferentes') {
        return montoNum * premios.pick4.boxTodosDiferentes;
      }
    }
  }

  return 0;
};

const crearDocumentoSorteo = ({
  sorteo,
  loteriaDoc,
  usuario,
  fechaEntrada = null,
  puntoVentaDestino = null
}) => {
  const fecha = fechaEntrada || parseFechaEntrada(sorteo.fecha);
  const puntoVentaId =
    puntoVentaDestino?._id || obtenerPuntoVentaUsuarioId(usuario);
  const puntoVentaNombre =
    puntoVentaDestino?.nombre ||
    usuario?.puntoVenta?.nombre ||
    (usuario?.rol === 'admin' ? 'Administracion Central' : '');

  return {
    ticketId: sorteo.ticketId ? String(sorteo.ticketId).trim() : null,
    numero: String(sorteo.numero || '').trim(),
    monto: numeroSeguro(sorteo.monto, 0),
    tipoApuesta: String(sorteo.tipoApuesta || '').trim(),
    loteria: loteriaDoc._id,
    loteriaNombre: loteriaDoc.nombre,
    usuario: usuario.id,
    usuarioNombre: usuario.nombre,
    username: usuario.username || '',
    puntoVenta: puntoVentaId,
    puntoVentaNombre,
    vendedor: usuario.id,
    vendedorNombre: usuario.nombre,
    grupoId: sorteo.grupoId ? String(sorteo.grupoId) : null,
    fecha,
    fechaTexto: fecha.toLocaleString('es-ES')
  };
};

router.get('/', protect, async (req, res) => {
  try {
    const { fecha, loteria, vendedor, usuario, puntoVenta } = req.query;
    const query = {};

    if (esPuntoVenta(req.user.rol)) {
      aplicarRestriccionOperativa(query, req.user);
    }

    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      query.fecha = { $gte: fechaInicio, $lte: fechaFin };
    }

    if (loteria) {
      query.loteria = loteria;
    }

    if (req.user.rol === 'admin' && vendedor) {
      query.vendedor = vendedor;
    }

    if (req.user.rol === 'admin' && usuario) {
      query.usuario = usuario;
    }

    if (req.user.rol === 'admin' && puntoVenta) {
      query.puntoVenta = puntoVenta;
    }

    const sorteos = await Sorteo.find(query)
      .populate('loteria', 'nombre horaCierre premios numerosGanadores')
      .populate('puntoVenta', 'codigo nombre ubicacion')
      .populate('usuario', 'nombre username email')
      .populate('vendedor', 'nombre email')
      .sort({ fecha: -1 });

    res.json({
      success: true,
      count: sorteos.length,
      data: sorteos
    });
  } catch (error) {
    console.error('Error al obtener sorteos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sorteos'
    });
  }
});

router.get('/reporte', protect, async (req, res) => {
  try {
    const { fecha, loteria, puntoVenta } = req.query;
    const query = {};

    if (esPuntoVenta(req.user.rol)) {
      aplicarRestriccionOperativa(query, req.user);
    }

    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      query.fecha = { $gte: fechaInicio, $lte: fechaFin };
    }

    if (loteria) {
      query.loteria = loteria;
    }

    if (req.user.rol === 'admin' && puntoVenta) {
      query.puntoVenta = puntoVenta;
    }

    const sorteos = await Sorteo.find(query)
      .populate('loteria', 'nombre horaCierre')
      .populate('puntoVenta', 'codigo nombre')
      .populate('usuario', 'nombre username')
      .populate('vendedor', 'nombre');

    const totalVentas = sorteos.reduce((sum, item) => sum + item.monto, 0);
    const totalTickets = sorteos.length;
    const porLoteria = {};

    sorteos.forEach(sorteo => {
      const nombreLoteria = sorteo.loteriaNombre;
      if (!porLoteria[nombreLoteria]) {
        porLoteria[nombreLoteria] = {
          nombre: nombreLoteria,
          tickets: 0,
          ventas: 0,
          sorteos: []
        };
      }

      porLoteria[nombreLoteria].tickets += 1;
      porLoteria[nombreLoteria].ventas += sorteo.monto;
      porLoteria[nombreLoteria].sorteos.push(sorteo);
    });

    const porVendedor = {};
    const porPuntoVenta = {};
    if (req.user.rol === 'admin') {
      sorteos.forEach(sorteo => {
        const nombreVendedor = sorteo.vendedorNombre;
        if (!porVendedor[nombreVendedor]) {
          porVendedor[nombreVendedor] = {
            nombre: nombreVendedor,
            tickets: 0,
            ventas: 0
          };
        }
        porVendedor[nombreVendedor].tickets += 1;
        porVendedor[nombreVendedor].ventas += sorteo.monto;

        const nombrePuntoVenta = sorteo.puntoVentaNombre || 'Sin punto de venta';
        if (!porPuntoVenta[nombrePuntoVenta]) {
          porPuntoVenta[nombrePuntoVenta] = {
            nombre: nombrePuntoVenta,
            tickets: 0,
            ventas: 0
          };
        }
        porPuntoVenta[nombrePuntoVenta].tickets += 1;
        porPuntoVenta[nombrePuntoVenta].ventas += sorteo.monto;
      });
    }

    res.json({
      success: true,
      data: {
        totalVentas,
        totalTickets,
        porLoteria: Object.values(porLoteria),
        porVendedor: Object.values(porVendedor),
        porPuntoVenta: Object.values(porPuntoVenta),
        sorteos
      }
    });
  } catch (error) {
    console.error('Error al obtener reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener reporte'
    });
  }
});

router.post(
  '/',
  protect,
  [
    body('numero').trim().notEmpty().withMessage('El numero es requerido'),
    body('monto').isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0'),
    body('tipoApuesta')
      .custom(value => TIPOS_APUESTA_VALIDOS.has(String(value || '').trim()))
      .withMessage('Tipo de apuesta invalido'),
    body('loteria')
      .custom((value, { req }) => Boolean(value || req.body?.loteriaId))
      .withMessage('La loteria es requerida')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const loteriaId = req.body.loteria || req.body.loteriaId;
      const loteriaDoc = await Loteria.findById(loteriaId);
      const fechaSorteo = parseFechaEntrada(req.body.fecha);
      const puntoVentaDestino = await resolverPuntoVentaDestino(
        req.user,
        req.body.puntoVentaDestinoId
      );

      if (!loteriaDoc) {
        return res.status(404).json({
          success: false,
          message: 'Loteria no encontrada'
        });
      }

      if (!loteriaDoc.activa) {
        return res.status(400).json({
          success: false,
          message: 'La loteria no esta activa'
        });
      }

      if (!fechaPermitidaParaUsuario(req.user, fechaSorteo)) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador puede registrar tickets para una fecha distinta a hoy'
        });
      }

      const sorteo = await Sorteo.create(
        crearDocumentoSorteo({
          sorteo: { ...req.body, loteria: loteriaId },
          loteriaDoc,
          usuario: req.user,
          fechaEntrada: fechaSorteo,
          puntoVentaDestino
        })
      );

      await sorteo.populate('loteria', 'nombre horaCierre premios numerosGanadores');
      await sorteo.populate('puntoVenta', 'codigo nombre ubicacion');
      await sorteo.populate('usuario', 'nombre username email');
      await sorteo.populate('vendedor', 'nombre email');

      res.status(201).json({
        success: true,
        data: sorteo
      });
    } catch (error) {
      console.error('Error al crear sorteo:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Error al crear sorteo'
      });
    }
  }
);

router.post('/multiple', protect, async (req, res) => {
  try {
    const { sorteos } = req.body;

    if (!Array.isArray(sorteos) || sorteos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un array de sorteos'
      });
    }

    const sorteosPreparados = [];

    for (const sorteo of sorteos) {
      const tipoApuesta = String(sorteo?.tipoApuesta || '').trim();
      if (!TIPOS_APUESTA_VALIDOS.has(tipoApuesta)) {
        continue;
      }

      const loteriaId = sorteo?.loteria || sorteo?.loteriaId;
      const numero = String(sorteo?.numero || '').trim();
      const monto = numeroSeguro(sorteo?.monto, 0);
      const fechaSorteo = parseFechaEntrada(sorteo?.fecha);
      if (!numero || monto <= 0 || !loteriaId) {
        continue;
      }

      const loteriaDoc = await Loteria.findById(loteriaId);
      if (!loteriaDoc || !loteriaDoc.activa) {
        continue;
      }

      const puntoVentaDestino = await resolverPuntoVentaDestino(
        req.user,
        sorteo?.puntoVentaDestinoId
      );

      if (!fechaPermitidaParaUsuario(req.user, fechaSorteo)) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador puede registrar tickets para una fecha distinta a hoy'
        });
      }

      sorteosPreparados.push(
        crearDocumentoSorteo({
          sorteo: { ...sorteo, loteria: loteriaId, tipoApuesta, numero, monto },
          loteriaDoc,
          usuario: req.user,
          fechaEntrada: fechaSorteo,
          puntoVentaDestino
        })
      );
    }

    if (sorteosPreparados.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay sorteos validos para crear'
      });
    }

    const sorteosCreados = await Sorteo.insertMany(sorteosPreparados);
    const ids = sorteosCreados.map(item => item._id);
    const sorteosPoblados = await Sorteo.find({ _id: { $in: ids } })
      .populate('loteria', 'nombre horaCierre premios numerosGanadores')
      .populate('puntoVenta', 'codigo nombre ubicacion')
      .populate('usuario', 'nombre username email')
      .populate('vendedor', 'nombre email')
      .sort({ fecha: -1 });

    res.status(201).json({
      success: true,
      count: sorteosPoblados.length,
      data: sorteosPoblados
    });
  } catch (error) {
    console.error('Error al crear multiples sorteos:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error al crear sorteos'
    });
  }
});

router.put('/ticket/pagado', protect, async (req, res) => {
  try {
    const { ticketId, grupoId, id, pagado } = req.body || {};
    const query = {};

    if (grupoId) {
      query.grupoId = String(grupoId).trim();
    } else if (ticketId) {
      query.ticketId = String(ticketId).trim();
    } else if (id) {
      query._id = id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Debe indicar un ticketId, grupoId o id valido'
      });
    }

    if (esPuntoVenta(req.user.rol)) {
      aplicarRestriccionOperativa(query, req.user);
    }

    const sorteos = await Sorteo.find(query);

    if (!sorteos || sorteos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron tickets para actualizar'
      });
    }

    const puntoVentaPagoId =
      req.user?.puntoVenta?._id || req.user?.puntoVenta || null;
    const puntoVentaPagoNombre =
      req.user?.puntoVenta?.nombre ||
      (req.user?.rol === 'admin' ? 'Administracion Central' : '');
    const fechaPago = Boolean(pagado) ? new Date() : null;

    sorteos.forEach((sorteo) => {
      sorteo.pagado = Boolean(pagado);
      sorteo.pagadoPor = Boolean(pagado) ? req.user.id : null;
      sorteo.pagadoPorNombre = Boolean(pagado) ? req.user.nombre : '';
      sorteo.fechaPago = fechaPago;
      sorteo.puntoVentaPago = Boolean(pagado) ? puntoVentaPagoId : null;
      sorteo.puntoVentaPagoNombre = Boolean(pagado) ? puntoVentaPagoNombre : '';
    });

    await Promise.all(sorteos.map((sorteo) => sorteo.save()));

    res.json({
      success: true,
      count: sorteos.length,
      data: sorteos.map((sorteo) => ({
        id: sorteo._id,
        ticketId: sorteo.ticketId,
        grupoId: sorteo.grupoId,
        pagado: sorteo.pagado,
        pagadoPor: sorteo.pagadoPor,
        pagadoPorNombre: sorteo.pagadoPorNombre,
        fechaPago: sorteo.fechaPago,
        puntoVentaPago: sorteo.puntoVentaPago,
        puntoVentaPagoNombre: sorteo.puntoVentaPagoNombre
      }))
    });
  } catch (error) {
    console.error('Error al actualizar pago del ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el pago del ticket'
    });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const sorteo = await Sorteo.findById(req.params.id);

    if (!sorteo) {
      return res.status(404).json({
        success: false,
        message: 'Sorteo no encontrado'
      });
    }

    if (esPuntoVenta(req.user.rol)) {
      const puntoVentaUsuarioId = obtenerPuntoVentaUsuarioId(req.user);
      const sorteoPuntoVentaId = sorteo.puntoVenta ? sorteo.puntoVenta.toString() : '';

      if (puntoVentaUsuarioId) {
        if (sorteoPuntoVentaId !== String(puntoVentaUsuarioId)) {
          return res.status(403).json({
            success: false,
            message: 'No autorizado para eliminar este sorteo'
          });
        }
      } else if (sorteo.usuario.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para eliminar este sorteo'
        });
      }

      if (!estaDentroVentanaEliminacion(sorteo)) {
        return res.status(403).json({
          success: false,
          message: 'Los puntos de venta solo pueden eliminar tickets durante los primeros 5 minutos'
        });
      }
    }

    await sorteo.deleteOne();

    res.json({
      success: true,
      message: 'Sorteo eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar sorteo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar sorteo'
    });
  }
});

router.delete('/grupo/:grupoId', protect, async (req, res) => {
  try {
    const query = { grupoId: req.params.grupoId };

    if (esPuntoVenta(req.user.rol)) {
      aplicarRestriccionOperativa(query, req.user);
    }

    const sorteosGrupo = await Sorteo.find(query);

    if (!sorteosGrupo || sorteosGrupo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron sorteos para eliminar'
      });
    }

    if (
      esPuntoVenta(req.user.rol) &&
      sorteosGrupo.some((sorteo) => !estaDentroVentanaEliminacion(sorteo))
    ) {
      return res.status(403).json({
        success: false,
        message: 'Los puntos de venta solo pueden eliminar tickets durante los primeros 5 minutos'
      });
    }

    const result = await Sorteo.deleteMany({
      _id: { $in: sorteosGrupo.map((sorteo) => sorteo._id) }
    });

    res.json({
      success: true,
      message: `${result.deletedCount} sorteos eliminados correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar grupo de sorteos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar sorteos'
    });
  }
});

router.put('/:id/ganador', protect, authorize('admin'), async (req, res) => {
  try {
    const { numeroGanador, posicion } = req.body;
    const sorteo = await Sorteo.findById(req.params.id).populate('loteria');

    if (!sorteo) {
      return res.status(404).json({
        success: false,
        message: 'Sorteo no encontrado'
      });
    }

    sorteo.ganador = true;
    sorteo.numeroGanador = numeroGanador;
    sorteo.premio = calcularPremio(
      sorteo.tipoApuesta,
      sorteo.numero,
      sorteo.monto,
      sorteo.loteria?.premios,
      { posicion }
    );

    await sorteo.save();

    res.json({
      success: true,
      data: sorteo
    });
  } catch (error) {
    console.error('Error al marcar ganador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar ganador'
    });
  }
});

module.exports = router;
