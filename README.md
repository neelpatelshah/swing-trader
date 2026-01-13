# Swing Trader

Personal swing-trading decision engine. See [SPEC.md](./SPEC.md) for full details.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Set up database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run locally

```bash
# Frontend (Vercel/Next.js)
npm run dev

# Worker (in separate terminal)
npm run dev:worker
```

## Project Structure

```
/app              # Next.js frontend (deploys to Vercel)
/worker           # Compute worker (deploys to Railway)
/packages
  /contracts      # Shared TypeScript types
/prisma           # Database schema
```

## Deployment

### Vercel (Frontend)

1. Connect repo to Vercel
2. Set root directory to `app`
3. Add environment variables

### Railway (Worker)

1. Connect repo to Railway
2. Uses root Dockerfile
3. Add environment variables
4. Set up cron job for daily evaluation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key |
| `OPENAI_API_KEY` | No | For LLM news labeling |
| `CRON_SECRET` | Yes | Secret for cron endpoint auth |
