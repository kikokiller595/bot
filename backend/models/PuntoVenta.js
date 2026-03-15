const mongoose = require('mongoose');

const puntoVentaSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: [true, 'El codigo es requerido'],
      unique: true,
      trim: true,
      uppercase: true
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true
    },
    ubicacion: {
      type: String,
      trim: true,
      default: ''
    },
    telefono: {
      type: String,
      trim: true,
      default: ''
    },
    responsable: {
      type: String,
      trim: true,
      default: ''
    },
    activo: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PuntoVenta', puntoVentaSchema);
