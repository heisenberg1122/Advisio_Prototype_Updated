# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/validations/package.json ./packages/validations/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

COPY apps/web ./apps/web
COPY packages ./packages

RUN npm run build --workspace=@research-management/auth
RUN npm run build --workspace=@research-management/validations
RUN npm run build --workspace=web

# Production Nginx Stage
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
