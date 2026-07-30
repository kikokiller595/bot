FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY public ./public
COPY src ./src

ARG REACT_APP_API_URL=/api
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN npm run build

FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend ./

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Zona horaria del proceso: America/New_York (requiere tzdata en Alpine).
# El codigo ya usa Intl con la zona operativa, esto es una capa extra para
# logs y cualquier Date local que se cree.
ENV TZ=America/New_York
RUN apk add --no-cache tzdata

COPY --from=backend-builder /app/backend ./backend
COPY --from=frontend-builder /app/build ./build

EXPOSE 8080

CMD ["node", "backend/server.js"]
