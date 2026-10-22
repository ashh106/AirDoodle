# Multi-stage Dockerfile for AirDoodle Full-Stack Workspace

# Stage 1: Build C++17 Geometry Engine
FROM gcc:12-bullseye AS cpp-builder
WORKDIR /cpp-engine
COPY cpp-engine/ .
RUN mkdir -p build && \
    g++ -std=c++17 -O3 -I src src/main.cpp src/geometry.cpp src/recognizer.cpp -o build/airdoodle-geometry

# Stage 2: Build Node.js Client SPA and Server
FROM node:20-alpine AS node-builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY air-doodle-frontend/package.json air-doodle-frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY air-doodle-frontend/ .
RUN pnpm build

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libstdc++
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=node-builder /app/package.json ./
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=cpp-builder /cpp-engine/build/airdoodle-geometry /cpp-engine/build/airdoodle-geometry

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ping || exit 1

CMD ["node", "dist/server/node-build.mjs"]
