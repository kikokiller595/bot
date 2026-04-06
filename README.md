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
- `JWT_SECRET`
- `JWT_EXPIRE=30d`
- `FRONTEND_URL` opcional si usas dominios extra

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
4. Despliega y abre la URL publica de Railway.

En produccion el frontend usa rutas relativas (`/api`), por lo que todo funciona bajo el mismo dominio.

## Notas

- no subas `.env` al repositorio
- cambia `JWT_SECRET` y las credenciales de MongoDB antes de uso real
- cuando confirmes Railway, puedes eliminar los despliegues viejos de Render y Netlify
