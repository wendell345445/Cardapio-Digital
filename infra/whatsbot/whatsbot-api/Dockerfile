# ─── whatsbot-api ─────────────────────────────────────────────────────────
# Multi-stage build: instala deps + compila TS, depois copia só dist + node_modules
# prod pra imagem final.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
COPY src/public ./dist/public
EXPOSE 3000
CMD ["node", "dist/index.js"]
