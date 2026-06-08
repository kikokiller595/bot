const mongoose = require('mongoose');

const historialPagoSchema = new mongoose.Schema(
  {
    accion: {
      type: String,
      enum: ['pago', 'anulacion'],
      required: true
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    usuarioNombre: {
      type: String,
      trim: true,
      required: true
    },
    puntoVenta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PuntoVenta',
      default: null
    },
    puntoVentaNombre: {
      type: String,
      trim: true,
      default: ''
    },
    fecha: {
      type: Date,
      required: true
    }
  },
  {
    _id: false
  }
);

const pagoPremioSchema = new mongoose.Schema(
  {
    clavePago: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true
    },
    referenciaTipo: {
      type: String,
      enum: ['grupoId', 'ticketId', 'id'],
      required: true
    },
    referenciaValor: {
      type: String,
      required: true,
      trim: true
    },
    sorteos: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sorteo',
      required: true
    }],
    sorteosGanadores: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sorteo',
      required: true
    }],
    montoTotal: {
      type: Number,
      min: 0,
      default: 0
    },
    estado: {
      type: String,
      enum: ['pagado', 'anulado'],
      required: true
    },
    pagadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null
    },
    pagadoPorNombre: {
      type: String,
      trim: true,
      default: ''
    },
    fechaPago: {
      type: Date,
      default: null
    },
    puntoVentaPago: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PuntoVenta',
      default: null
    },
    puntoVentaPagoNombre: {
      type: String,
      trim: true,
      default: ''
    },
    historial: {
      type: [historialPagoSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

pagoPremioSchema.index({ estado: 1, fechaPago: -1 });
pagoPremioSchema.index({ sorteos: 1 });

module.exports = mongoose.model('PagoPremio', pagoPremioSchema);
