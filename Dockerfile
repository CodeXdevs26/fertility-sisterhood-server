# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:24-slim AS build
WORKDIR /app

# openssl is required by the Prisma query engine
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# install deps first for layer caching; the schema must be present because
# `postinstall` runs `prisma generate`
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# drop dev dependencies but keep the generated Prisma client (node_modules/.prisma)
RUN npm prune --omit=dev --ignore-scripts

# ---------- runtime stage ----------
FROM node:24-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# NOTE: `docker run --env-file .env` overrides this with the NODE_ENV in .env;
# docker compose re-sets it to production explicitly
ENV NODE_ENV=production
ENV PORT=5003

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
# email templates are read at runtime from ./src/app/emailTemplates (relative to cwd)
COPY --from=build --chown=node:node /app/src/app/emailTemplates ./src/app/emailTemplates

USER node

EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5003) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
