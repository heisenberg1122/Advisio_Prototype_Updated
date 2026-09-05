FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma/
COPY packages/validations/package.json ./packages/validations/
COPY packages/shared/package.json ./packages/shared/
COPY packages/email/package.json ./packages/email/

RUN npm ci

# Copy source
COPY apps/api ./apps/api
COPY packages ./packages

# Generate Prisma client and build
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build --workspace=@research-management/database
RUN npm run build --workspace=@research-management/auth
RUN npm run build --workspace=@research-management/validations
RUN npm run build --workspace=api

EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "apps/api/dist/index.js"]
