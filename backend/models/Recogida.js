const mongoose = require('mongoose');

// Registro de una recogida/pickup semanal del dinero que un punto de venta
// entrega a la administracion al cerrar la semana (lunes a domingo).
const recogidaSchema = new mongoose.Schema(
  {
    puntoVentaId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    puntoVentaNombre: {
      type: String,
      trim: true,
      default: ''
    },
    // Clave de la semana: fecha del lunes en formato YYYY-MM-DD
    semanaInicio: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    // Fecha del domingo en formato YYYY-MM-DD
    semanaFin: {
      type: String,
      trim: true,
      default: ''
    },
    montoVenta: {
      type: Number,
      default: 0
    },
    montoPremios: {
      type: Number,
      default: 0
    },
    montoComision: {
      type: Number,
      default: 0
    },
    // Lo que el punto debe entregar = venta - premios - comision socio
    montoEsperado: {
      type: Number,
      default: 0
    },
    // Lo que realmente se recogio (puede ajustarse manualmente)
    montoRecogido: {
      type: Number,
      default: 0
    },
    nota: {
      type: String,
      trim: true,
      default: ''
    },
    registradoPor: {
      type: String,
      trim: true,
      default: ''
    },
    fechaRecogida: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Una sola recogida por punto de venta y semana
recogidaSchema.index({ puntoVentaId: 1, semanaInicio: 1 }, { unique: true });

module.exports = mongoose.model('Recogida', recogidaSchema);
