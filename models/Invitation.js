const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // null = todavia no responde, true/false = confirmo asistencia o no
    attending: { type: Boolean, default: null },
  },
  { _id: false }
);

const invitationSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },

    // Nombre de familia/grupo, ej. "Familia Perez". Vacio para invitaciones individuales.
    familyName: { type: String, trim: true, default: '' },

    members: {
      type: [memberSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },

    phone: { type: String, trim: true, default: '' },
    // true solo cuando el invitado marco la casilla de "es correcto" o
    // escribio una correccion (que se guarda directo en phone).
    phoneConfirmed: { type: Boolean, default: false },

    // Marcado a mano desde el admin cuando ya se le envio el link por WhatsApp/Facebook.
    invitationSent: { type: Boolean, default: false },

    allowPlusOne: { type: Boolean, default: false },
    plusOneAttending: { type: Boolean, default: false },
    plusOneName: { type: String, trim: true, default: '' },

    // pending = nunca ha respondido, responded = ya envio el formulario al menos una vez
    status: { type: String, enum: ['pending', 'responded'], default: 'pending' },

    notes: { type: String, trim: true, default: '' },

    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invitation', invitationSchema);
