FROM node:22.22-bookworm-slim AS base
ENV COREPACK_HOME=/opt/corepack
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack install && chmod -R a+rX /opt/corepack

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN pnpm exec turbo run build --concurrency=1

FROM build AS pruned
RUN pnpm --filter api deploy --prod --legacy /out/api \
    && pnpm --filter worker deploy --prod --legacy /out/worker \
    && pnpm --filter @heat/db deploy --legacy /out/db

FROM base AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=pruned /out/api /app
ENV NODE_ENV=production
USER node
WORKDIR /app
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM base AS worker
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates ffmpeg chromium fonts-noto-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
COPY --from=pruned /out/worker /app
ENV NODE_ENV=production
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
USER node
WORKDIR /app
CMD ["node", "dist/main.js"]

FROM base AS migrate
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=pruned --chown=node:node /out/db /app
ENV PATH=/app/node_modules/.bin:$PATH
ENV NODE_ENV=production
USER node
WORKDIR /app
RUN DATABASE_URL=postgresql://x:x@127.0.0.1:1/x node_modules/.bin/prisma migrate status || true
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed"]

FROM node:22.22-bookworm-slim AS frontend
ARG APP
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV APP=${APP}
WORKDIR /app
COPY --from=build /app/apps/${APP}/.next/standalone ./
COPY --from=build /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /app/apps/${APP}/public ./apps/${APP}/public
USER node
CMD ["sh", "-c", "exec node apps/${APP}/server.js"]
