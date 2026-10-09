# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app

# Copy manifests first so Docker caches the install layer separately
COPY package*.json ./
# Install production deps only; devDeps (eslint, supertest, mongodb-memory-server)
# are not needed at runtime
RUN npm ci --omit=dev

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:26-alpine AS runtime
WORKDIR /app

# Copy only what the app runs; nothing else from the repo can end up in the image.
# Files stay owned by root, so the app user can read but not modify its own code.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json app.js server.js ./
COPY config ./config
COPY controllers ./controllers
COPY lib ./lib
COPY middleware ./middleware
COPY models ./models
COPY public ./public
COPY routes ./routes
COPY seed ./seed
COPY services ./services
COPY views ./views

# The image's built-in non-root user
USER node

EXPOSE 3000

CMD ["node", "server.js"]
