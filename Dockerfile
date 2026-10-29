# Debian (glibc) base: @resvg/resvg-js ships prebuilt glibc binaries, so no compiler is needed.
# Override with --build-arg NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim
# if Docker Hub rate-limits the build server.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS base
WORKDIR /app

# Build the React app (needs dev dependencies).
FROM base AS build
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY web web
RUN npm run build -w web

# Production dependencies of the server workspace only.
FROM base AS deps
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace=server --no-audit --no-fund && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3003 \
    DATA_DIR=/app/data \
    TRUST_PROXY="loopback, uniquelocal"
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY --from=build /app/web/dist ./web/dist
# The data directory is owned by the unprivileged user so a fresh named volume inherits it.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
WORKDIR /app/server
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3003) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
