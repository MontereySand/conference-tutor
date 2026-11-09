FROM node:26-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:26-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json next.config.ts instrumentation.ts instrumentation.node.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
# Private prepared data is never available to the compiler.
RUN npm run build

FROM node:26-slim AS runtime
WORKDIR /app
ARG GIT_SHA=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=$GIT_SHA
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# This image contains private inputs: load into local kind only, never push it.
COPY --chown=node:node data ./data
RUN mkdir -p /app/data/runtime && chown node:node /app/data/runtime
USER node
EXPOSE 3000
CMD ["node", "server.js"]
