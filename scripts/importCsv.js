// Importa invitaciones desde un archivo CSV a MongoDB.
// Uso: node scripts/importCsv.js ruta/al/archivo.csv
//
// Columnas esperadas (con encabezado, no distingue mayusculas/minusculas):
//   Nombre     (obligatorio)
//   Familia    (opcional: si varias filas comparten el mismo valor de Familia,
//               se agrupan en una sola invitacion/link con todos esos miembros)
//   Invitado   (1 = permite acompañante +1 no listado, 0 = no)
//
// Ejemplo:
//   Nombre,Familia,Invitado
//   Juan Perez,Familia Perez,0
//   Maria Perez,Familia Perez,0
//   Carlos Ramirez,,1
//
// Las invitaciones que ya existen (misma Familia, o mismo nombre si es individual)
// se actualizan: se refresca la lista de miembros (conservando su respuesta previa
// si el nombre no cambio) y el permiso de +1.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { nanoid } = require('nanoid');
const connectDB = require('../config/db');
const Invitation = require('../models/Invitation');

function getField(row, ...names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (key !== undefined) return row[key];
  }
  return undefined;
}

function groupRows(rows) {
  const families = new Map(); // familyName -> { names: [], allowPlusOne: bool }
  const individuals = []; // { name, allowPlusOne }

  for (const row of rows) {
    const name = String(getField(row, 'Nombre', 'Name') || '').trim();
    if (!name) continue;
    const familyName = String(getField(row, 'Familia', 'Grupo', 'Group') || '').trim();
    const allowPlusOne = String(getField(row, 'Invitado', 'PlusOne', '+1') || '').trim() === '1';

    if (familyName) {
      if (!families.has(familyName)) {
        families.set(familyName, { names: [], allowPlusOne: false });
      }
      const entry = families.get(familyName);
      entry.names.push(name);
      entry.allowPlusOne = entry.allowPlusOne || allowPlusOne;
    } else {
      individuals.push({ name, allowPlusOne });
    }
  }

  return { families, individuals };
}

async function upsertInvitation({ familyName, names, allowPlusOne }) {
  const query = familyName ? { familyName } : { familyName: '', 'members.0.name': names[0] };
  let invitation = await Invitation.findOne(query);

  const existingByName = new Map((invitation ? invitation.members : []).map((m) => [m.name.trim().toLowerCase(), m]));
  const members = names.map((name) => {
    const previous = existingByName.get(name.toLowerCase());
    return { name, attending: previous ? previous.attending : null };
  });

  if (invitation) {
    invitation.members = members;
    invitation.allowPlusOne = allowPlusOne;
    await invitation.save();
    return 'updated';
  }

  await Invitation.create({
    familyName,
    members,
    allowPlusOne,
    token: nanoid(10),
  });
  return 'created';
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node scripts/importCsv.js ruta/al/archivo.csv');
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  if (rows.length === 0) {
    console.error('El archivo no tiene filas de datos.');
    process.exit(1);
  }

  await connectDB();

  const { families, individuals } = groupRows(rows);

  let created = 0;
  let updated = 0;

  for (const [familyName, entry] of families) {
    const result = await upsertInvitation({ familyName, names: entry.names, allowPlusOne: entry.allowPlusOne });
    if (result === 'created') created++;
    else updated++;
  }

  for (const person of individuals) {
    const result = await upsertInvitation({ familyName: '', names: [person.name], allowPlusOne: person.allowPlusOne });
    if (result === 'created') created++;
    else updated++;
  }

  console.log(`Importacion completa: ${created} invitaciones creadas, ${updated} actualizadas.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al importar:', err);
  process.exit(1);
});
