const dns = require('dns');
const mongoose = require('mongoose');

// En algunas redes de Windows el resolver DNS del sistema falla al buscar el
// registro SRV de Atlas (mongodb+srv://...). Forzar DNS publicos evita ese
// ECONNREFUSED intermitente en querySrv.
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI en el archivo .env');
  }
  await mongoose.connect(uri);
  console.log('MongoDB conectado');
}

module.exports = connectDB;
