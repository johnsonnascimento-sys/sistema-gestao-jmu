FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ARG APP_COMMIT_SHA=""

ENV NODE_ENV=production
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY sql ./sql

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["sh", "-c", "node dist/server/scripts/migrate.js && node dist/server/index.js"]
