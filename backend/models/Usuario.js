const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: undefined
    },
    password: {
      type: String,
      required: [true, 'La contrasena es requerida'],
      minlength: [6, 'La contrasena debe tener al menos 6 caracteres'],
      select: false
    },
    rol: {
      type: String,
      enum: ['admin', 'punto_venta', 'vendedor'],
      default: 'punto_venta'
    },
    puntoVenta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PuntoVenta',
      default: null
    },
    activo: {
      type: Boolean,
      default: true
    },
    ultimoAcceso: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

usuarioSchema.pre('save', async function(next) {
  if (this.isModified('username') && this.username) {
    this.username = String(this.username).trim().toLowerCase();
  }

  if (this.isModified('email')) {
    if (this.email) {
      this.email = String(this.email).trim().toLowerCase();
    } else {
      this.email = undefined;
    }
  }

  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

usuarioSchema.methods.matchPassword = async function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
