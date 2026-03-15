# TBY Sistemas

Sistema de loteria con:

- frontend React
- backend Node/Express
- MongoDB
- panel administrador
- panel de punto de venta

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

Frontend:

- copia [`.env.example`](./.env.example) a `.env`
- para produccion usa [`.env.production.example`](./.env.production.example) como referencia

Backend:

- copia [`backend/.env.example`](./backend/.env.example) a `backend/.env`
- `FRONTEND_URL` acepta varias URLs separadas por coma

## Despliegue recomendado

### Backend en Render

- usa [`render.yaml`](./render.yaml) desde la raiz del proyecto
- configura en Render:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `FRONTEND_URL`
- ejemplo de `FRONTEND_URL`:
  - `https://tu-app.netlify.app,https://tu-app.vercel.app`

### Frontend en Netlify o Vercel

Configura estas variables:

- `REACT_APP_API_URL=https://tu-backend.onrender.com/api`
- `REACT_APP_BACKEND_URL=https://tu-backend.onrender.com`

Luego compila o despliega:

```powershell
.\sistema.ps1 build
.\sistema.ps1 deploy -FrontendTarget netlify
```

o:

```powershell
.\sistema.ps1 deploy -FrontendTarget vercel
```

## Notas

- no subas `.env` al repositorio
- antes de produccion cambia `JWT_SECRET`
- si cambias el dominio del frontend, actualiza `FRONTEND_URL` en Render
