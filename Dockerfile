# syntax=docker/dockerfile:1

# -------------------------------------------------------
# 1. Dependencies
# -------------------------------------------------------

FROM node:24-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# -------------------------------------------------------
# 2. Build
# -------------------------------------------------------

FROM deps AS builder

WORKDIR /app

COPY . .

# Generate Prisma clients.
# These URLs are build-time placeholders only.
# Prisma generate does not connect to the databases.

RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/seatlock" \
    npx prisma generate

RUN TICKETING_DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/seatlock_ticketing" \
    npx prisma generate --config prisma-ticketing.config.ts

# Compile NestJS / TypeScript.
RUN npm run build


# -------------------------------------------------------
# 3. Production-only dependencies
# -------------------------------------------------------

FROM node:24-bookworm-slim AS production-deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force


# -------------------------------------------------------
# 4. Shared production runtime
# -------------------------------------------------------

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=production-deps \
  --chown=node:node \
  /app/node_modules \
  ./node_modules

COPY --from=builder \
  --chown=node:node \
  /app/dist \
  ./dist

COPY --from=builder \
  --chown=node:node \
  /app/generated \
  ./generated

COPY --from=builder \
  --chown=node:node \
  /app/package.json \
  ./package.json

USER node


# -------------------------------------------------------
# 5. SeatLock API image
# -------------------------------------------------------

FROM runtime AS api

EXPOSE 3000

CMD ["node", "dist/src/main.js"]


# -------------------------------------------------------
# 6. Ticket Service image
# -------------------------------------------------------

FROM runtime AS ticket-service

CMD ["node", "dist/src/ticket-service/main.js"]