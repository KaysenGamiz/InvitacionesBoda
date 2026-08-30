# Invitaciones de Boda

App para enviar invitaciones con link único por invitado o por familia, RSVP, y +1 opcional.
La ubicación del evento solo se muestra después de que alguien de la invitación confirma que asistirá.

## Cómo funciona

- Cada invitación (una persona o una familia entera) tiene un link único: `https://tu-dominio.com/i/<token>`
- Si la invitación es de una familia, el link muestra a todos sus miembros y cada uno se marca individualmente como "Asistirá" / "No asistirá" en el mismo formulario.
- Antes de confirmar, se ve la invitación pero **no** la ubicación.
- En cuanto al menos una persona de la invitación confirma que asistirá, se muestra la ubicación de la ceremonia y la recepción a todos los que abran ese link.
- Si la invitación tiene permiso de +1 (definido en tu CSV), puede indicar si llevará un acompañante adicional no listado y su nombre.
- Se puede volver a entrar al link y cambiar las respuestas en cualquier momento (se sobreescriben las anteriores).
- Tú administras todo desde `/admin` (usuario/contraseña definidos en `.env`): ver todas las invitaciones, estadísticas, links para copiar y enviar manualmente, agregar/editar/eliminar.

## 1. Configurar el evento

Edita [config/event.js](config/event.js) con el nombre de los novios, fecha, direcciones de ceremonia/recepción, links de Google Maps, código de vestimenta, etc.

## 2. Preparar tu CSV de invitados

Tres columnas (con encabezado):

| Nombre         | Familia        | Invitado |
|----------------|-----------------|----------|
| Juan Perez     | Familia Perez   | 0        |
| Maria Perez    | Familia Perez   | 0        |
| Sofia Perez    | Familia Perez   | 0        |
| Carlos Ramirez |                 | 1        |
| Ana Torres     |                 | 0        |

- **Nombre**: obligatorio.
- **Familia**: opcional. Si varias filas tienen el mismo valor exacto en esta columna, se agrupan en **una sola invitación** con un solo link, donde cada quien confirma su propia asistencia. Déjala vacía para invitaciones individuales (una persona, un link).
- **Invitado**: `1` si esa invitación permite un acompañante adicional no listado (+1), `0` si no. Si varias filas de una misma familia tienen valores distintos, basta con que una tenga `1` para que la familia tenga esa opción habilitada.

Puedes crear este CSV desde Excel/Google Sheets con "Guardar como" → CSV. Hay un archivo de ejemplo en [sample-invitados.csv](sample-invitados.csv).

## 3. Instalación local

```bash
npm install
cp .env.example .env
```

Edita `.env`:
- `MONGODB_URI`: string de conexión de tu base de datos (ver paso 5 para Atlas, o usa MongoDB local/Docker para probar).
- `SESSION_SECRET`: cualquier texto largo y aleatorio.
- `ADMIN_USER` / `ADMIN_PASSWORD`: tus credenciales para entrar a `/admin`.
- `BASE_URL`: se usa solo para mostrarte el link completo en el panel admin.

Para probar con MongoDB local vía Docker:
```bash
docker run -d --name boda-mongo -p 27017:27017 mongo:7
# y en .env: MONGODB_URI=mongodb://localhost:27017/boda
```

## 4. Importar tu lista de invitados

```bash
npm run import -- "ruta/a/tu/lista.csv"
```

Esto crea una invitación por persona o por familia con un link único (o actualiza sus miembros y permiso de +1 si ya existe una con el mismo nombre de familia, o el mismo nombre para invitaciones individuales). Puedes correrlo varias veces si actualizas el CSV; las respuestas ya guardadas de quienes no cambiaron de nombre no se pierden.

## 5. Correr la app

```bash
npm start
```

Abre `http://localhost:3000/admin`, entra con tu usuario/contraseña, y ahí verás la tabla de invitados con el link de cada uno listo para copiar y enviar por WhatsApp, email, etc.

## 6. Desplegar en la nube (gratis)

**Base de datos — MongoDB Atlas:**
1. Crea una cuenta gratis en https://www.mongodb.com/cloud/atlas
2. Crea un cluster gratuito (M0), un usuario de base de datos, y permite el acceso desde cualquier IP (0.0.0.0/0) en Network Access.
3. Copia el connection string (botón "Connect" → "Drivers") y úsalo como `MONGODB_URI`.

**Backend — Render (o Railway):**
1. Sube este proyecto a un repositorio de GitHub.
2. En https://render.com crea un "Web Service" nuevo apuntando a tu repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Agrega las variables de entorno (`MONGODB_URI`, `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`, `BASE_URL`) en la sección Environment de Render. `BASE_URL` debe ser la URL que Render te asigne (ej. `https://tu-app.onrender.com`).
4. Una vez desplegado, corre la importación del CSV apuntando tu `MONGODB_URI` de Atlas (puedes correr `npm run import -- lista.csv` desde tu computadora, usando el mismo `MONGODB_URI` en tu `.env` local).

Nota: en el plan gratuito de Render el servicio "duerme" tras un rato sin uso y tarda unos segundos en despertar con la primera visita — normal y sin costo.

## Notas de seguridad

- Los links de invitación (`/i/<token>`) usan un identificador aleatorio de 10 caracteres — no son adivinables, pero funcionan como una contraseña: solo compártelos con la persona correspondiente.
- El panel `/admin` está protegido con usuario/contraseña y cookie de sesión. Usa una contraseña robusta en `ADMIN_PASSWORD`.
