FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate && pnpm build

FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY services/leboncoin-mcp/requirements.txt /tmp/leboncoin-requirements.txt
RUN python3 -m venv /opt/leboncoin && /opt/leboncoin/bin/pip install --no-cache-dir -r /tmp/leboncoin-requirements.txt
ENV NODE_ENV=production
ENV PORT=3000
ENV LEBONCOIN_SERVICE_ENABLED=true
ENV LEBONCOIN_PYTHON=/opt/leboncoin/bin/python
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/services/leboncoin-mcp ./services/leboncoin-mcp
COPY --from=build --chown=node:node /app/src/market-data/data ./src/market-data/data
USER node
EXPOSE 3000
CMD ["node", "scripts/start-production.mjs"]
