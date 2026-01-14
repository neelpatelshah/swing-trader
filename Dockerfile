FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and enable corepack for pnpm
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./

# Copy workspace package files
COPY worker/package.json ./worker/
COPY packages/contracts/package.json ./packages/contracts/
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm db:generate

# Copy source code
COPY worker ./worker/
COPY packages/contracts ./packages/contracts/

# Build contracts first, then worker
RUN pnpm --filter @swing-trader/contracts build
RUN pnpm --filter @swing-trader/worker build

# Run from app root
CMD ["node", "worker/dist/index.js"]
