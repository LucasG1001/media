# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache postgresql16-client

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# O volume de imagens herda o ownership do diretório da imagem, e o processo
# roda como node — sem isso o container sobe sem permissão de escrita no cache.
RUN mkdir -p /data/images && chown -R node:node /data

EXPOSE 3333
USER node
CMD ["node", "dist/server.js"]
