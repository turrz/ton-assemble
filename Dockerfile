FROM node:20-alpine AS base

RUN corepack enable

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile || pnpm install

RUN pnpm -r run build
RUN cp -r apps/web/dist/* apps/api/public/

CMD ["pnpm", "start:api"]
