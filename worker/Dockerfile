FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY worker/package*.json ./worker/
COPY packages/contracts/package*.json ./packages/contracts/
COPY prisma ./prisma/

# Install dependencies
RUN npm install --workspace=@swing-trader/worker

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY worker ./worker/
COPY packages/contracts ./packages/contracts/

# Build
WORKDIR /app/worker
RUN npm run build

# Run
CMD ["node", "dist/index.js"]
