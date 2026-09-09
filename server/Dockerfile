# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY web/package.json web/
# Строго по lock-файлу: платформенные сборки rollup объявлены в
# optionalDependencies пакета web, поэтому npm ci ставит их корректно
# и сборка воспроизводима
RUN npm ci --no-audit --no-fund

COPY packages/shared packages/shared
RUN npm run build -w @crm/shared

COPY server server
RUN npm run build -w @crm/server

# ---------- runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace @crm/server --include-workspace-root && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/server/dist server/dist

RUN mkdir -p /app/uploads
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/main.js"]
