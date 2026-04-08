const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Sorteo = require('../models/Sorteo');
const Loteria = require('../models/Loteria');
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

const obtenerClaveLocalFecha = (fecha) => {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) {
    return null;
  }

  const anio = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const fechaPermitidaParaUsuario = (usuario, fecha) => {
  if (String(usuario?.rol || '').trim().toLowerCase() === 'admin') {
    return true;
  }

  return obtenerClaveLocalFecha(fecha) === obtenerClaveLocalFecha(new Date());
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

const crearDocumentoSorteo = ({ sorteo, loteriaDoc, usuario, fechaEntrada = null }) => {
  const fecha = fechaEntrada || parseFechaEntrada(sorteo.fecha);
  const puntoVentaId =
    usuario?.puntoVenta?._id || usuario?.puntoVenta || null;
  const puntoVentaNombre =
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
      query.usuario = req.user.id;
      if (req.user.puntoVenta?._id || req.user.puntoVenta) {
        query.puntoVenta = req.user.puntoVenta?._id || req.user.puntoVenta;
      }
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
      query.usuario = req.user.id;
      if (req.user.puntoVenta?._id || req.user.puntoVenta) {
        query.puntoVenta = req.user.puntoVenta?._id || req.user.puntoVenta;
      }
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
    body('loteria').notEmpty().withMessage('La loteria es requerida')
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
      const { loteria } = req.body;
      const loteriaDoc = await Loteria.findById(loteria);
      const fechaSorteo = parseFechaEntrada(req.body.fecha);

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
          sorteo: req.body,
          loteriaDoc,
          usuario: req.user,
          fechaEntrada: fechaSorteo
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
      res.status(500).json({
        success: false,
        message: 'Error al crear sorteo'
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

      const numero = String(sorteo?.numero || '').trim();
      const monto = numeroSeguro(sorteo?.monto, 0);
      const fechaSorteo = parseFechaEntrada(sorteo?.fecha);
      if (!numero || monto <= 0 || !sorteo?.loteria) {
        continue;
      }

      const loteriaDoc = await Loteria.findById(sorteo.loteria);
      if (!loteriaDoc || !loteriaDoc.activa) {
        continue;
      }

      if (!fechaPermitidaParaUsuario(req.user, fechaSorteo)) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador puede registrar tickets para una fecha distinta a hoy'
        });
      }

      sorteosPreparados.push(
        crearDocumentoSorteo({
          sorteo: { ...sorteo, tipoApuesta, numero, monto },
          loteriaDoc,
          usuario: req.user,
          fechaEntrada: fechaSorteo
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
    res.status(500).json({
      success: false,
      message: 'Error al crear sorteos'
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
      query.usuario = req.user.id;
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

    if (esPuntoVenta(req.user.rol) && sorteo.usuario.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para eliminar este sorteo'
      });
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
      query.usuario = req.user.id;
    }

    const result = await Sorteo.deleteMany(query);

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
