const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Loteria = require('../models/Loteria');
const { protect, authorize } = require('../middleware/auth');

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

const normalizarNumerosGanadores = (lista = []) => {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .filter(item => item && String(item.numero || '').trim())
    .map(item => ({
      id: String(
        item.id ||
          item._id ||
          new mongoose.Types.ObjectId().toString()
      ),
      numero: String(item.numero).trim(),
      fecha: String(item.fecha || '').trim(),
      fechaRegistro: String(
        item.fechaRegistro || new Date().toLocaleString('es-ES')
      ).trim(),
      premio: numeroSeguro(item.premio, 0)
    }))
    .filter(item => item.fecha);
};

router.get('/', protect, async (req, res) => {
  try {
    const loterias = await Loteria.find({ activa: true })
      .populate('createdBy', 'nombre email')
      .sort({ nombre: 1 });

    res.json({
      success: true,
      count: loterias.length,
      data: loterias
    });
  } catch (error) {
    console.error('Error al obtener loterias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener loterias'
    });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const loteria = await Loteria.findById(req.params.id)
      .populate('createdBy', 'nombre email');

    if (!loteria) {
      return res.status(404).json({
        success: false,
        message: 'Loteria no encontrada'
      });
    }

    res.json({
      success: true,
      data: loteria
    });
  } catch (error) {
    console.error('Error al obtener loteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener loteria'
    });
  }
});

router.post(
  '/',
  protect,
  authorize('admin'),
  [body('nombre').trim().notEmpty().withMessage('El nombre es requerido')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { nombre, horaCierre, premios, numerosGanadores } = req.body;

      const loteriaExiste = await Loteria.findOne({ nombre, activa: true });
      if (loteriaExiste) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una loteria con ese nombre'
        });
      }

      const loteria = await Loteria.create({
        nombre: nombre.trim(),
        horaCierre: String(horaCierre || '').trim(),
        premios: normalizarPremios(premios),
        numerosGanadores: normalizarNumerosGanadores(numerosGanadores),
        createdBy: req.user.id
      });

      res.status(201).json({
        success: true,
        data: loteria
      });
    } catch (error) {
      console.error('Error al crear loteria:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear loteria'
      });
    }
  }
);

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { nombre, horaCierre, premios, activa, numerosGanadores } = req.body;

    const loteria = await Loteria.findById(req.params.id);

    if (!loteria) {
      return res.status(404).json({
        success: false,
        message: 'Loteria no encontrada'
      });
    }

    if (nombre && nombre.trim() !== loteria.nombre) {
      const loteriaExiste = await Loteria.findOne({
        nombre: nombre.trim(),
        activa: true,
        _id: { $ne: req.params.id }
      });

      if (loteriaExiste) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una loteria con ese nombre'
        });
      }
    }

    if (typeof nombre === 'string' && nombre.trim()) {
      loteria.nombre = nombre.trim();
    }
    if (typeof horaCierre !== 'undefined') {
      loteria.horaCierre = String(horaCierre || '').trim();
    }
    if (typeof premios !== 'undefined') {
      loteria.premios = normalizarPremios(premios);
    }
    if (typeof numerosGanadores !== 'undefined') {
      loteria.numerosGanadores = normalizarNumerosGanadores(numerosGanadores);
    }
    if (typeof activa !== 'undefined') {
      loteria.activa = activa;
    }

    await loteria.save();

    res.json({
      success: true,
      data: loteria
    });
  } catch (error) {
    console.error('Error al actualizar loteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar loteria'
    });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const loteria = await Loteria.findById(req.params.id);

    if (!loteria) {
      return res.status(404).json({
        success: false,
        message: 'Loteria no encontrada'
      });
    }

    loteria.activa = false;
    await loteria.save();

    res.json({
      success: true,
      message: 'Loteria eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar loteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar loteria'
    });
  }
});

module.exports = router;
