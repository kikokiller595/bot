const mongoose = require('mongoose');

const botSlotSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    drawName: {
      type: String,
      trim: true,
      default: ''
    },
    game: {
      type: String,
      enum: ['pick3', 'pick4', ''],
      default: ''
    }
  },
  { _id: false }
);

const botSyncStatusSchema = new mongoose.Schema(
  {
    lastAttemptAt: {
      type: Date,
      default: null
    },
    lastSuccessAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const numeroGanadorSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    numero: {
      type: String,
      required: [true, 'El numero ganador es requerido'],
      trim: true
    },
    fecha: {
      type: String,
      required: [true, 'La fecha del sorteo es requerida'],
      trim: true
    },
    fechaRegistro: {
      type: String,
      default: () => new Date().toLocaleString('es-ES')
    },
    premio: {
      type: Number,
      default: 0
    },
    fuente: {
      type: String,
      enum: ['manual', 'bot'],
      default: 'manual'
    },
    game: {
      type: String,
      enum: ['pick3', 'pick4', ''],
      default: ''
    },
    drawId: {
      type: String,
      trim: true,
      default: ''
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: ''
    },
    sincronizadoEn: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const loteriaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de la loteria es requerido'],
      trim: true
    },
    horaCierre: {
      type: String,
      trim: true,
      default: ''
    },
    premios: {
      pick2: {
        straightPrimera: {
          type: Number,
          default: 55
        },
        straightSegunda: {
          type: Number,
          default: 15
        },
        straightTercera: {
          type: Number,
          default: 10
        }
      },
      singulation: {
        straight: {
          type: Number,
          default: 9
        }
      },
      pick3: {
        straight: {
          type: Number,
          default: 700
        },
        triple: {
          type: Number,
          default: 500
        },
        boxPar: {
          type: Number,
          default: 232
        },
        boxTodosDiferentes: {
          type: Number,
          default: 116
        }
      },
      pick4: {
        straight: {
          type: Number,
          default: 5000
        },
        cuadrupleStraight: {
          type: Number,
          default: 3000
        },
        boxCuadruple: {
          type: Number,
          default: 3000
        },
        boxTresIguales: {
          type: Number,
          default: 1200
        },
        boxDosPares: {
          type: Number,
          default: 800
        },
        boxUnPar: {
          type: Number,
          default: 400
        },
        boxTodosDiferentes: {
          type: Number,
          default: 200
        }
      }
    },
    numerosGanadores: {
      type: [numeroGanadorSchema],
      default: []
    },
    botSyncEnabled: {
      type: Boolean,
      default: false
    },
    botSlots: {
      pick3: {
        type: botSlotSchema,
        default: () => ({})
      },
      pick4: {
        type: botSlotSchema,
        default: () => ({})
      }
    },
    botSyncStatus: {
      type: botSyncStatusSchema,
      default: () => ({})
    },
    activa: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Loteria', loteriaSchema);
