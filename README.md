# TBY Sistemas

Sistema de loteria con React, Node/Express y MongoDB.

## Desarrollo local

Instalar dependencias:

```powershell
.\sistema.ps1 install
```

Revisar estado:

```powershell
.\sistema.ps1 status
```

Abrir sistema:

```powershell
.\sistema.ps1 dev
```

## Variables de entorno

Frontend local:

- copia [`.env.example`](./.env.example) a `.env`

Backend local:

- copia [`backend/.env.example`](./backend/.env.example) a `backend/.env`

Produccion en Railway:

- `MONGODB_URI`
- `JWT_SECRET` con al menos 32 caracteres
- `JWT_EXPIRE=30d`
- `APP_TIMEZONE=America/New_York`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_SETUP_TOKEN`
- `FRONTEND_URL` opcional si usas dominios extra

## Primer administrador

Antes de inicializar una base de datos nueva, define en el backend:

- `INITIAL_ADMIN_USERNAME`
- `INITIAL_ADMIN_PASSWORD` con al menos 12 caracteres
- `INITIAL_ADMIN_SETUP_TOKEN` con al menos 16 caracteres

Con el backend encendido, crea la cuenta una sola vez:

```powershell
curl.exe -X POST http://localhost:5000/api/init/admin `
  -H "x-setup-token: TU_TOKEN_DE_INSTALACION"
```

Despues de crear el administrador, elimina del entorno
`INITIAL_ADMIN_PASSWORD` y `INITIAL_ADMIN_SETUP_TOKEN`. Solo vuelve a
configurarlas temporalmente para una recuperacion controlada.

## Despliegue en Railway

El proyecto ya esta preparado para desplegar frontend y backend juntos en un solo servicio de Railway.

Archivos importantes:

- [`Dockerfile`](./Dockerfile)
- [`railway.json`](./railway.json)

Pasos:

1. Crea un proyecto nuevo en Railway desde este repositorio.
2. Railway detectara el [`Dockerfile`](./Dockerfile) y construira la app completa.
3. Configura las variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRE`
   - `APP_TIMEZONE`
   - `INITIAL_ADMIN_PASSWORD`
   - `INITIAL_ADMIN_SETUP_TOKEN`
4. Despliega y abre la URL publica de Railway.

En produccion el frontend usa rutas relativas (`/api`), por lo que todo funciona bajo el mismo dominio.
Railway comprueba `/ready`, que solo responde correctamente cuando MongoDB esta conectado.

## Verificacion

```powershell
npm run test:all
npm run build
npm --prefix backend audit --omit=dev
```

## Notas

- no subas `.env` al repositorio
- cambia `JWT_SECRET` y las credenciales de MongoDB antes de uso real
- deja `ALLOW_RESET_ADMIN=false` salvo durante una recuperacion autorizada
- el flujo de login y la inicializacion administrativa tienen limite de intentos
- los pagos de premios usan transacciones; MongoDB debe ejecutarse como replica set o servicio compatible como Atlas
- un pago repetido devuelve conflicto y solo el administrador puede anularlo
- las alertas restantes de `npm audit` en la raiz pertenecen al toolchain heredado de Create React App; no uses `npm audit fix --force`
- cuando confirmes Railway, puedes eliminar los despliegues viejos de Render y Netlify
