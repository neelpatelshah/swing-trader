FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy root package files
COPY package*.json ./
COPY tsconfig.base.json ./

# Copy workspace package files
COPY worker/package*.json ./worker/
COPY packages/contracts/package*.json ./packages/contracts/
COPY prisma ./prisma/

# Install all dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY worker ./worker/
COPY packages/contracts ./packages/contracts/

# Build contracts first
WORKDIR /app/packages/contracts
RUN npm run build

# Build worker
WORKDIR /app/worker
RUN npm run build

# Run from worker directory
CMD ["node", "dist/index.js"]
