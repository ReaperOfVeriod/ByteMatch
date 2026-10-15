# ByteMatch image: the web server by default, the worker and migrator with another command.
#   docker build -t bytematch -f Containerfile .        (or: podman build -t bytematch .)
#   web:     docker run -p 5000:5000 --env-file .env bytematch
#   worker:  docker run --env-file .env bytematch node dist/main.js
#   migrate: docker run --env-file .env bytematch node dist/migrate.js
ARG NODE_VERSION=24

FROM docker.io/library/node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS build
COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked yarn install --immutable
COPY . .
RUN yarn build \
 && yarn workspaces focus --all --production

FROM base AS run
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/src/assets ./src/assets
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -q -O /dev/null http://127.0.0.1:5000/healthz || exit 1
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "5000"]
