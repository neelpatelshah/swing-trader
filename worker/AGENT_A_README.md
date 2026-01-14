# Agent A: Data Pipeline + Compute

## Your Responsibility

You own the **data ingestion, feature computation, scoring engine, and daily cron orchestration**. Everything that fetches external data, crunches numbers, and produces scores/signals.

## What's Already Built

```
worker/
├── src/
│   ├── index.ts              # HTTP server with /health endpoint
│   ├── cron/daily.ts         # Daily job skeleton (TODOs inside)
│   ├── providers/fmp.ts      # FMP API client (EOD bars, news, earnings, profiles, screener)
│   ├── engine/
│   │   ├── universe.ts       # Stub
│   │   ├── features.ts       # Stub
│   │   ├── scoring.ts        # Partial implementation
│   │   └── signals.ts        # Stub
│   ├── lib/prisma.ts         # Prisma client singleton
│   └── tax/rotation-cost.ts  # Tax calculation (Agent C owns, but you'll call it)
├── package.json
├── tsconfig.json
└── Dockerfile
```

## What You Need to Build

### 1. Universe Management (`engine/universe.ts`)

```ts
// Required exports:
getTradableUniverse(): Promise<Ticker[]>  // Excludes DEFENSE_PRIMARY
seedInitialUniverse(symbols: string[]): Promise<void>  // For initial setup
runMomentumScreen(): Promise<void>  // Apply screen criteria, update Ticker.screenPassed
```

**Screen criteria (from spec):**
- minAvgVolume20d: 500,000
- minMarketCap: $1B
- priceAboveSMA50: true
- priceAboveSMA200: true (optional, can relax)
- rsVsSpyPercentile: >= 50

### 2. Bar Ingestion (`jobs/ingest-bars.ts`)

```ts
// Fetch EOD bars from FMP, store in DailyBar table
ingestBarsForUniverse(universe: string[], fromDate?: string): Promise<void>

// For initial backfill: fetch 2 years of history
backfillHistoricalBars(symbols: string[]): Promise<void>
```

**Notes:**
- Use `fetchEODBars` and `fetchMultipleEODBars` from `providers/fmp.ts`
- Track last fetched date per ticker for incremental updates
- Always fetch SPY as benchmark

### 3. Feature Computation (`engine/features.ts`)

```ts
// Compute technical indicators from DailyBar data
computeFeatures(symbol: string, asOfDate: Date): Promise<Feature>
computeFeaturesForUniverse(symbols: string[], asOfDate: Date): Promise<void>
```

**Features to compute:**
- `sma20`, `sma50`, `sma200` - Simple moving averages
- `rsi14` - Relative Strength Index
- `atr14` - Average True Range
- `rsVsSpy` - Relative strength vs SPY (percentile rank)

**Formula references:**
- RSI: 100 - (100 / (1 + avgGain/avgLoss)) over 14 periods
- ATR: Average of max(high-low, |high-prevClose|, |low-prevClose|) over 14 periods
- RS vs SPY: (stock return / SPY return) ranked as percentile across universe

### 4. Scoring Engine (`engine/scoring.ts`)

Already partially implemented. Complete it:

```ts
scoreCandidate(symbol: string, asOfDate: Date): Promise<ScoreResult>
scoreUniverse(symbols: string[], asOfDate: Date): Promise<void>
```

**Scoring weights (initial, to be backtested):**
- Trend: 0-30
- Relative strength vs SPY: 0-20
- Volatility suitability: 0-15
- Drawdown risk: 0-15
- Liquidity: 0-10
- Catalyst/semantics: 0-10 (depends on Agent C's semantic features)

### 5. Signal Generation (`engine/signals.ts`)

```ts
generateSignal(
  currentHolding: { symbol: string; entryDate: Date; entryPrice: number },
  universe: ScoreRow[],
  asOfDate: Date
): Promise<SignalRow>
```

**Sell signal logic (asymmetry-based):**
```
UpsideRemainingPct = ATR-based runway estimate
DownsideTailPct = ATR downside + drawdown risk + semantic tail risk
Asymmetry = UpsideRemainingPct / DownsideTailPct

> 2.0 → NONE
1.2-2.0 → WATCH
0.8-1.2 → SELL
< 0.8 → STRONG_SELL
```

**Rotation logic:**
```
Recommend ROTATE if:
  S_best - S_hold >= RotateThreshold (8 points) + TaxDrag

Use tax/rotation-cost.ts for TaxDrag calculation
```

### 6. Daily Cron (`cron/daily.ts`)

Complete the TODOs in the existing file:

```ts
// Full pipeline:
1. Check market open (skip weekends, TODO: add holiday calendar)
2. Acquire job lock (prevent overlaps)
3. Load universe (exclude DEFENSE_PRIMARY)
4. Fetch latest EOD bars from FMP
5. Fetch SPY benchmark
6. Fetch news (hand off to Agent C's semantic pipeline)
7. Compute technical features
8. Compute semantic features (call Agent C's aggregation)
9. Score all candidates
10. If holding exists: generate signal
11. Persist Score[], Signal, JobRun
12. Release lock
```

### 7. Backtest Framework (`backtest/backtest.ts`, `backtest/optimizer.ts`)

```ts
interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  weights: ScoringWeights;
  thresholds: SignalThresholds;
}

interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgHoldTime: number;
  trades: TradeRecord[];
}

runBacktest(config: BacktestConfig): Promise<BacktestResult>
optimizeWeights(startDate: Date, endDate: Date): Promise<ScoringWeights>
```

**Requirements:**
- Use 2 years of historical data
- Walk-forward validation (train on 18 months, test on 6)
- Grid search or simple optimization over weight space
- Store results in `BacktestRun` table

## Database Tables You Own

- `Ticker` - Universe management
- `DailyBar` - EOD price data
- `Feature` - Computed indicators
- `Score` - Candidate scores
- `Signal` - Sell/rotate signals
- `JobRun` - Cron execution logs
- `BacktestRun` - Backtest results

## API Contract (for Agent B's frontend)

Agent B will call these API routes. You don't build the routes (that's Agent B), but your engine functions power them:

```
GET /api/scores?asOf=YYYY-MM-DD&limit=50
  → Return top scored candidates

GET /api/signals?asOf=YYYY-MM-DD
  → Return current signal for holding

GET /api/tickers
  → Return universe with classifications
```

## Environment Variables You Need

```
DATABASE_URL     # Neon Postgres connection string
FMP_API_KEY      # Financial Modeling Prep API key
```

## Dependencies on Other Agents

- **Agent C**: You'll call semantic aggregation functions to get `newsSentiment7d`, `tailRiskScore14d`, etc.
- **Agent B**: None (you don't depend on frontend)

## Testing Your Work

1. **Seed test universe:**
   ```ts
   await seedInitialUniverse(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'SPY']);
   ```

2. **Backfill bars:**
   ```ts
   await backfillHistoricalBars(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'SPY']);
   ```

3. **Compute features:**
   ```ts
   await computeFeaturesForUniverse(['AAPL', 'MSFT', 'GOOGL'], new Date());
   ```

4. **Run scoring:**
   ```ts
   await scoreUniverse(['AAPL', 'MSFT', 'GOOGL'], new Date());
   ```

5. **Check database:**
   ```bash
   pnpm db:studio  # Opens Prisma Studio to inspect data
   ```

## Definition of Done

- [ ] Can seed a universe of 20+ tickers
- [ ] Can backfill 2 years of EOD bars
- [ ] Features compute correctly (spot-check SMAs against TradingView)
- [ ] Scores generated for all candidates
- [ ] Signal generated when holding is set
- [ ] Daily cron runs end-to-end without errors
- [ ] Backtest framework produces reasonable metrics
- [ ] No DEFENSE_PRIMARY ticker ever appears in scores or signals
