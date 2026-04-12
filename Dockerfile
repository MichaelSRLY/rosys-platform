FROM node:24-bookworm-slim AS base

# Install Python 3, poppler-utils (pdftoppm), and pikepdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    poppler-utils \
    && python3 -m pip install --break-system-packages pikepdf \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Dependencies stage ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Build stage ---
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# SvelteKit needs PUBLIC_ env vars at build time for $env/static/public
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# --- Production stage ---
FROM base AS production
WORKDIR /app

# Copy built output and production deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/scripts ./scripts

# SvelteKit adapter-node serves from build/
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build/index.js"]
