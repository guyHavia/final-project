# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copy manifests first so Docker caches the install layer separately
COPY package*.json ./
# Install production deps only; devDeps (eslint, supertest, mongodb-memory-server)
# are not needed at runtime
RUN npm ci --omit=dev

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy installed modules from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source (everything except what .dockerignore excludes)
COPY . .

# Owned by the non-root user
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
