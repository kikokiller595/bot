const mongoose = require('mongoose');

const sorteoSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    default: null,
    trim: true
  },
  numero: {
    type: String,
    required: [true, 'El numero es requerido'],
    trim: true
  },
  monto: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0.01, 'El monto debe ser mayor a 0']
  },
  tipoApuesta: {
    type: String,
    enum: [
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
    ],
    required: [true, 'El tipo de apuesta es requerido']
  },
  loteria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loteria',
    required: [true, 'La loteria es requerida']
  },
  loteriaNombre: {
    type: String,
    required: true
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El usuario es requerido']
  },
  usuarioNombre: {
    type: String,
    required: true
  },
  username: {
    type: String,
    trim: true,
    default: ''
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
  vendedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El vendedor es requerido']
  },
  vendedorNombre: {
    type: String,
    required: true
  },
  grupoId: {
    type: String,
    default: null
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  fechaTexto: {
    type: String,
    required: true
  },
  ganador: {
    type: Boolean,
    default: false
  },
  numeroGanador: {
    type: String,
    default: null
  },
  premio: {
    type: Number,
    default: 0
  },
  pagado: {
    type: Boolean,
    default: false
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
  }
});

sorteoSchema.index({ usuario: 1, fecha: -1 });
sorteoSchema.index({ vendedor: 1, fecha: -1 });
sorteoSchema.index({ puntoVenta: 1, fecha: -1 });
sorteoSchema.index({ loteria: 1, fecha: -1 });
sorteoSchema.index({ ganador: 1 });
sorteoSchema.index({ grupoId: 1 });
sorteoSchema.index({ ticketId: 1 });

module.exports = mongoose.model('Sorteo', sorteoSchema);
