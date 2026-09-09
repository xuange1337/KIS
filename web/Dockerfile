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

COPY web web
RUN npm run build -w @crm/web

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
