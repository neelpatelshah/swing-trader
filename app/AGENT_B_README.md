# Agent B: Frontend (Vercel)

## Your Responsibility

You own the **Next.js frontend and read-only API routes**. Build the dashboard, leaderboard, ticker detail pages, and settings UI. All data comes from the shared Postgres database that Agent A populates.

## What's Already Built

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard stub
│   │   ├── candidates/page.tsx         # Stub
│   │   ├── settings/page.tsx           # Stub
│   │   ├── ticker/[symbol]/page.tsx    # Stub
│   │   └── api/
│   │       ├── scores/route.ts         # Stub
│   │       ├── signals/route.ts        # Stub
│   │       ├── tickers/route.ts        # Stub
│   │       └── portfolio/route.ts      # Stub
│   └── lib/prisma.ts                   # Prisma client
├── package.json
├── tsconfig.json
└── next.config.ts
```

## What You Need to Build

### 1. Dashboard (`/` - `page.tsx`)

**Components needed:**
- `HoldingCard` - Current position display
  - Symbol, entry date, entry price, shares
  - Current price, P&L ($, %)
  - Holding days, days to long-term status
- `SignalBanner` - Sell signal display
  - Signal level (NONE/WATCH/SELL/STRONG_SELL) with color coding
  - Asymmetry ratio
  - Top reasons
- `RotationCard` - Rotation recommendation
  - HOLD or ROTATE recommendation
  - If ROTATE: target symbol, score comparison
  - Tax impact summary (tax drag %, required edge)
- `TopCandidates` - Mini leaderboard (top 10)
  - Symbol, score, projection
  - Click to navigate to detail
- `RunStatus` - Last job run info
  - Timestamp, status, tickers processed

**Data fetching:**
```ts
// Server component fetching
const portfolio = await prisma.portfolioState.findFirst();
const latestSignal = await prisma.signal.findFirst({ orderBy: { asOfDate: 'desc' } });
const topScores = await prisma.score.findMany({
  where: { asOfDate: latestSignal?.asOfDate },
  orderBy: { swingScore: 'desc' },
  take: 10
});
const lastRun = await prisma.jobRun.findFirst({ orderBy: { startedAt: 'desc' } });
```

### 2. Candidates Page (`/candidates`)

**Features:**
- Full leaderboard table
- Sortable columns: score, symbol, RS, volatility, projection
- Filters:
  - Minimum score threshold (slider)
  - Hide earnings within 5 days (toggle)
  - Sector filter (dropdown)
- Click row to navigate to `/ticker/[symbol]`

**Table columns:**
| Symbol | Score | RS % | ATR | Projection | Earnings | Actions |
|--------|-------|------|-----|------------|----------|---------|

### 3. Ticker Detail (`/ticker/[symbol]`)

**Sections:**
- **Header**: Symbol, name, defense classification badge
- **Price Chart**: EOD candlestick or line chart (last 6 months)
  - Use a chart library: recharts, lightweight-charts, or similar
- **Feature Grid**: Technical indicators
  - SMA20, SMA50, SMA200
  - RSI14, ATR14
  - RS vs SPY percentile
- **Score Breakdown**: Visual component breakdown
  - Bar chart showing each scoring component
  - Top reasons, warnings
- **News Timeline**: Recent news items
  - Title, source, date
  - Direction badge (positive/negative/neutral)
  - Severity indicator
- **Events Panel**: Upcoming earnings, dividends
- **Projection Card**: Expected move, range, confidence

### 4. Settings Page (`/settings`)

**Sections:**
- **Universe Manager**
  - List current tickers with enabled/disabled toggle
  - Add ticker form (symbol input)
  - Remove ticker button
  - "Run Screen" button (triggers momentum screen)
- **Current Holding Editor**
  - Form: symbol, entry date, entry price, shares
  - Save button
  - Clear holding button
- **Defense Overrides**
  - List of tickers with classification dropdown
  - Override source indicator (manual vs automatic)
- **Thresholds** (optional for v1)
  - Rotate threshold slider
  - Signal threshold sliders
- **Run History**
  - Table of recent JobRuns
  - Status, duration, tickers processed
  - "Run Now" button (manual trigger)

### 5. API Routes

#### `GET /api/scores`
```ts
// Query params: asOf (YYYY-MM-DD), limit (number)
// Returns: { asOfDate: string, rows: ScoreRow[] }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get('asOf') || new Date().toISOString().split('T')[0];
  const limit = parseInt(searchParams.get('limit') || '50');

  const scores = await prisma.score.findMany({
    where: { asOfDate: new Date(asOf) },
    orderBy: { swingScore: 'desc' },
    take: limit,
    include: { ticker: { select: { name: true, defenseClassification: true } } }
  });

  return Response.json({
    asOfDate: asOf,
    rows: scores.map(s => ({
      symbol: s.symbol,
      asOfDate: s.asOfDate.toISOString().split('T')[0],
      swingScore: s.swingScore,
      projection: s.projectionJson,
      explain: s.explainJson
    }))
  });
}
```

#### `GET /api/signals`
```ts
// Query params: asOf (YYYY-MM-DD)
// Returns: { asOfDate: string, row: SignalRow | null }
```

#### `GET /api/tickers`
```ts
// Returns: { tickers: Ticker[] }
// Include enabled, defenseClassification, screenPassed
```

#### `GET /api/ticker/[symbol]`
```ts
// Returns: { symbol, name, bars[], features, news[], events[], latestScore }
```

#### `POST /api/portfolio`
```ts
// Body: { currentSymbol, entryDate, entryPrice, shares }
// Updates PortfolioState singleton
```

#### `POST /api/settings/universe`
```ts
// Body: { symbols: string[] }
// Bulk update enabled tickers
```

## Shared Types

Import from `@swing-trader/contracts`:

```ts
import type {
  ScoreRow,
  SignalRow,
  TaxImpact,
  DefenseClassification,
  Projection,
  ScoreExplain
} from '@swing-trader/contracts';
```

## UI/UX Guidelines

- **No emojis** unless user requests
- **Minimal styling** - functional over pretty for MVP
- **Color coding for signals:**
  - NONE: green/neutral
  - WATCH: yellow
  - SELL: orange
  - STRONG_SELL: red
- **Defense tickers:**
  - DEFENSE_PRIMARY: Show "Excluded" badge, gray out
  - Never show in leaderboard
  - Show warning if user navigates directly to excluded ticker

## Database Tables You Read From

- `Ticker` - Universe list
- `DailyBar` - Price history for charts
- `Feature` - Technical indicators
- `Score` - Candidate scores
- `Signal` - Current signals
- `PortfolioState` - Current holding
- `NewsItem` + `NewsLabel` - News with sentiment
- `Event` - Earnings calendar
- `JobRun` - Run history

## Tables You Write To

- `PortfolioState` - Via settings
- `Ticker` - Enable/disable, classification overrides

## Environment Variables You Need

```
DATABASE_URL     # Neon Postgres connection string
```

## Dependencies on Other Agents

- **Agent A**: Populates Score, Signal, Feature, DailyBar tables
- **Agent C**: Populates NewsLabel sentiment data

**Important:** Your UI should gracefully handle empty states when Agent A hasn't run yet:
- "No scores available yet. Run the daily job to generate scores."
- "No signal generated. Set a holding first."

## Component Library Suggestions

You can use any of these or keep it simple with Tailwind:
- `shadcn/ui` - Copy-paste components
- `recharts` - For the price chart
- `@tanstack/react-table` - For sortable leaderboard

## Testing Your Work

1. **Empty state:** Load pages before Agent A has run
2. **With data:** After Agent A seeds data, verify:
   - Dashboard shows holding and signal
   - Leaderboard sorts correctly
   - Ticker detail shows chart and features
   - Settings can update portfolio

## Definition of Done

- [ ] Dashboard displays holding, signal, top candidates, run status
- [ ] Candidates page shows sortable/filterable leaderboard
- [ ] Ticker detail shows chart, features, news, score breakdown
- [ ] Settings can manage universe and holding
- [ ] DEFENSE_PRIMARY tickers never appear in leaderboard
- [ ] All pages handle empty states gracefully
- [ ] API routes return correct data shapes
