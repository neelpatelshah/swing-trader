# Swing Trading Engine Spec (EOD, Weeks–Months Horizon)

**Purpose**
Personal swing-trading engine (single-position portfolio) that:
1. Ranks swing candidates with projections
2. Generates sell signals for the current holding (risk asymmetry–aware, tax-aware)
3. Recommends rotation when opportunity elsewhere dominates, accounting for tax drag

**Horizon:** ~14 days to ~4 months
**Data Frequency:** End-of-day (EOD)
**Universe Size:** 200+ tickers (momentum-screened + manual curation)
**Hosting:** Vercel (frontend/API) + Railway (compute/queues/backtesting)
**Runtime:** Once daily after market close (~4:05 PM ET)

---

## 0. Ethical / Domain Constraints (Hard Rules)

### 0.1 Defense & Weapons Exclusion Policy

The system **must not recommend** companies whose **primary business** is:

- Weapons manufacturing
- Military hardware
- Surveillance or targeting systems built primarily for defense
- Defense-first software platforms
- Intelligence or battlefield analytics as a core product

**Explicitly excluded examples (non-exhaustive):**
- Palantir
- Anduril
- Raytheon
- Lockheed Martin
- Northrop Grumman
- General Dynamics
- L3Harris
- Weapons, missile, or munitions manufacturers

**Allowed (secondary / incidental exposure):**
Companies whose primary business is civilian/commercial but which may have government contracts or defense-adjacent revenue (e.g., Google, Microsoft, Amazon). These must not be penalized solely for having defense/government customers.

**Scope:** Defense exclusions only. No extensible ESG framework required for v1.

---

## 1. How the Defense Filter Is Enforced (Machine-Readable)

### 1.1 Ticker Classification Rule (Authoritative)

Each ticker must have exactly one classification:

- `DEFENSE_PRIMARY` → **Hard exclude**
- `DEFENSE_SECONDARY` → Allowed
- `NON_DEFENSE` → Allowed

### 1.2 Source of Truth (v1 priority order)

1. **Manual allow/deny list** (authoritative, user-controlled)
2. **Provider industry/sector metadata** (if unambiguous)
3. **Heuristic fallback** (logged; never auto-hard-excludes without user confirmation UI)

Manual overrides always win.

---

## 2. Manual Setup Checklist (Human Required)

You **must** do the following outside of code. The coding agent should warn/block if missing.

### Accounts & Billing
- Create **Vercel** account and deploy frontend repo
- Create **Railway** account for compute worker
- Create **Financial Modeling Prep (FMP)** account → obtain API key (Starter plan ~$30/mo)
- Create **OpenAI** account → obtain API key for GPT-4o-mini (~$10-20/mo usage)

### Infrastructure
- Provision Postgres (Neon free tier or Vercel Postgres)
- Set environment variables:
  - `DATABASE_URL`
  - `FMP_API_KEY`
  - `OPENAI_API_KEY`
  - `CRON_SECRET` (strong random string)

### Budget Estimate
| Service | Plan | Monthly Cost |
|---------|------|--------------|
| FMP | Starter | ~$30 |
| OpenAI | Pay-as-you-go | ~$10-20 |
| Railway | Hobby | ~$5 |
| Neon Postgres | Free | $0 |
| **Total** | | **~$45-55** |

---

## 3. Architecture Overview (Optimized for Parallelism)

This project uses a **split architecture**:

### Vercel (Frontend + Read API)
- Next.js dashboard
- Read-only API routes
- Static/ISR pages

### Railway (Compute Worker)
- Daily cron job
- Queue workers (BullMQ + Redis)
- Data fetching with rate limiting
- Feature computation
- Scoring engine
- Backtest engine

### Agent Split for Parallel Development

**Agent A — Data Pipeline + Compute (Railway)**
- Data ingestion (FMP)
- Feature computation
- Scoring engine
- Signal generation
- Backtest framework
- Daily cron orchestration

**Agent B — Frontend (Vercel)**
- Dashboard, leaderboard, drilldowns
- Settings UI
- Read-only API routes

**Agent C — Semantics + Tax Logic**
- News normalization and labeling
- LLM integration (GPT-4o-mini)
- Semantic feature aggregation
- Tax-aware rotation cost calculations

Agents communicate via **shared Prisma schema + stable API contracts**.

---

## 4. Repository Structure

```
/                         # Monorepo root
├── /app                  # Vercel Next.js frontend
│   ├── /app
│   │   ├── /api
│   │   │   ├── /scores/route.ts
│   │   │   ├── /signals/route.ts
│   │   │   ├── /tickers/route.ts
│   │   │   └── /portfolio/route.ts
│   │   ├── page.tsx              # Dashboard
│   │   ├── /candidates/page.tsx
│   │   ├── /ticker/[symbol]/page.tsx
│   │   └── /settings/page.tsx
│   └── /components
│       ├── CandidateTable.tsx
│       ├── HoldingCard.tsx
│       ├── SignalBanner.tsx
│       ├── FeatureGrid.tsx
│       ├── NewsTimeline.tsx
│       ├── ScoreBreakdown.tsx
│       └── RunStatusWidget.tsx
│
├── /worker               # Railway compute worker
│   ├── /src
│   │   ├── index.ts
│   │   ├── /cron
│   │   │   └── daily.ts
│   │   ├── /jobs
│   │   │   ├── ingest-bars.ts
│   │   │   ├── compute-features.ts
│   │   │   ├── score-candidates.ts
│   │   │   └── generate-signals.ts
│   │   ├── /providers
│   │   │   └── fmp.ts
│   │   ├── /engine
│   │   │   ├── universe.ts
│   │   │   ├── features.ts
│   │   │   ├── scoring.ts
│   │   │   ├── signals.ts
│   │   │   └── rotation.ts
│   │   ├── /backtest
│   │   │   ├── backtest.ts
│   │   │   └── optimizer.ts
│   │   ├── /semantics
│   │   │   ├── normalize.ts
│   │   │   ├── label.ts
│   │   │   ├── llm.ts
│   │   │   └── aggregate.ts
│   │   └── /tax
│   │       ├── holdings.ts
│   │       ├── gains.ts
│   │       └── rotation-cost.ts
│   ├── Dockerfile
│   └── railway.toml
│
├── /prisma
│   ├── schema.prisma
│   └── /migrations
│
└── /lib
    └── contracts.ts      # Shared types
```

---

## 5. Shared Contracts (Core Types & API Shapes)

### 5.1 Types (lib/contracts.ts)

```ts
export type RunType = "DAILY" | "MANUAL";

export type DefenseClassification =
  | "DEFENSE_PRIMARY"
  | "DEFENSE_SECONDARY"
  | "NON_DEFENSE";

export type Projection = {
  horizonDays: number;
  expectedMovePct: number;
  expectedRangePct: [number, number];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  notes: string[];
};

export type ScoreExplain = {
  components: Record<string, number>;
  topReasons: string[];
  warnings: string[];
};

export type ScoreRow = {
  symbol: string;
  asOfDate: string;          // YYYY-MM-DD
  swingScore: number;        // 0–100
  projection: Projection;
  explain: ScoreExplain;
};

export type SellSignalLevel =
  | "NONE"
  | "WATCH"
  | "SELL"
  | "STRONG_SELL";

export type TaxImpact = {
  holdingDays: number;
  isLongTerm: boolean;          // >= 365 days
  estimatedGainPct: number;
  estimatedTaxRate: number;     // 0.15 long-term, 0.37 short-term (approx)
  taxDragPct: number;           // gainPct * taxRate
  daysToLongTerm: number;       // 0 if already long-term
  requiredEdgeToRotate: number; // taxDrag + transaction buffer
};

export type SignalRow = {
  asOfDate: string;
  currentSymbol: string;
  sellSignalLevel: SellSignalLevel;
  rotateRecommendation: "HOLD" | "ROTATE";
  rotateToSymbol?: string;
  explain: {
    asymmetry: number;
    upsideRemainingPct: number;
    downsideTailPct: number;
    reasons: string[];
  };
  taxImpact?: TaxImpact;
};
```

### 5.2 API Contracts (Frontend must use only these)

- `GET /api/scores?asOf=YYYY-MM-DD&limit=50`
  - `{ asOfDate, rows: ScoreRow[] }`

- `GET /api/signals?asOf=YYYY-MM-DD`
  - `{ row: SignalRow }`

- `GET /api/ticker/[symbol]`
  - `{ bars, features, news, events, latestScore }`

- `POST /api/settings/universe`
  - body: `{ symbols: string[] }`

- `POST /api/portfolio`
  - body: `{ currentSymbol, entryDate, entryPrice, shares }`

---

## 6. Database Schema (v1)

### Core Tables
- `Ticker(symbol PK, name, enabled, defenseClassification, manualOverride, tags[], screenPassed, lastScreenedAt)`
- `DailyBar(symbol, date PK, open, high, low, close, adjClose, volume)`
- `Feature(symbol, date PK, sma20, sma50, sma200, rsi14, atr14, rsVsSpy, newsSentiment7d, newsSentiment30d, tailRiskScore14d, catalystMomentum, earningsWithin5d, earningsWithin10d)`
- `Score(symbol, asOfDate PK, swingScore, projectionJson, explainJson)`

### Portfolio + Tax Tables
- `PortfolioState(id=1 singleton, currentSymbol, entryDate, entryPrice, shares, updatedAt)`
- `TradeHistory(id PK, symbol, action, date, price, shares, holdingDays, gainLoss, isLongTerm)`
- `Signal(asOfDate PK, currentSymbol, sellSignalLevel, rotateRecommendation, rotateToSymbol, explainJson, taxImpactJson)`

### Soft Data Tables
- `NewsItem(id PK, symbol, publishedAt, source, title, url, summary, contentHash UNIQUE)`
- `NewsLabel(newsId PK/FK, tags[], direction, severity 0-3, confidence, labeledAt, modelUsed)`
- `Event(id PK, symbol, eventDate, eventType, rawJson)` (earnings, dividends, splits)

### System Tables
- `JobRun(id PK, runType, startedAt, finishedAt, status, summaryJson, errorJson)`
- `BacktestRun(id PK, startDate, endDate, configJson, resultsJson, createdAt)`

**Note:** Analyst consensus data deprioritized. Fetch if available but weight very low in scoring.

---

## 7. Scheduling (Railway Cron)

### 7.1 Daily Job
- Runs once daily after market close (~4:05 PM ET / 21:05 UTC)
- Railway cron or internal scheduler

### 7.2 Security
- Validate `CRON_SECRET` for manual trigger endpoint
- Acquire DB lock to prevent overlapping runs
- If lock held: log and skip

### 7.3 Manual Trigger
- Vercel API route `/api/manual/trigger` calls Railway worker endpoint
- Authenticated with shared secret

---

## 8. Universe Management

### 8.1 Hybrid Universe (Screens + Manual)

Base universe populated by momentum screen, with manual additions/exclusions.

### 8.2 Momentum Screen Criteria

```ts
interface ScreenCriteria {
  minAvgVolume20d: 500_000;        // Minimum liquidity
  minMarketCap: 1_000_000_000;     // $1B+ market cap
  priceAboveSMA50: true;           // Short-term uptrend
  priceAboveSMA200: true;          // Long-term uptrend (optional, can relax)
  rsVsSpyPercentile: ">= 50";      // Relative strength vs SPY
}
```

### 8.3 Defense Filter (applied after screen)
- Exclude all `DEFENSE_PRIMARY` tickers
- Apply before scoring, rotation, or leaderboard generation

---

## 9. Evaluation Pipeline (Daily Run)

1. Check market was open today (skip weekends/holidays)
2. Acquire job lock
3. Load universe + portfolio state
4. **Filter out DEFENSE_PRIMARY tickers**
5. Fetch latest EOD bars for allowed universe (FMP)
6. Fetch SPY benchmark bars (FMP)
7. Fetch news since last run (FMP)
8. Fetch earnings/events calendar
9. Normalize & label news (heuristic first, LLM for uncertain)
10. Aggregate semantics into features
11. Compute technical features
12. Score all candidates + projections
13. If holding exists:
    - Compute sell signal (asymmetry-based)
    - Compute rotation recommendation (tax-aware)
14. Persist `Score[]`, `Signal`, `JobRun`
15. Release lock

---

## 10. Scoring & Signals

### 10.1 Candidate Scoring (0–100)

**Initial component weights (to be backtested and calibrated):**
- Trend strength: 0–30
- Relative strength vs SPY: 0–20
- Volatility suitability (ATR-based): 0–15
- Drawdown risk: 0–15
- Liquidity: 0–10
- Catalyst/semantics: 0–10

**Outputs:**
- `swingScore` (0-100)
- `projection` (ATR-based expected move/range at 20-60 trading days)
- `explain` (component breakdown, top reasons, warnings)

**Note:** These weights are initial estimates. The backtest framework will optimize them against 2-year historical data.

### 10.2 Sell Signal (Asymmetry-Based)

**Compute:**
- `UpsideRemainingPct` (ATR-based runway + resistance heuristic)
- `DownsideTailPct` (ATR downside + drawdown risk + semantic tail risk + earnings gap risk)
- `Asymmetry = UpsideRemainingPct / DownsideTailPct`

**Initial thresholds (to be backtested):**
- Asymmetry > 2.0 → NONE
- Asymmetry 1.2–2.0 → WATCH
- Asymmetry 0.8–1.2 → SELL
- Asymmetry < 0.8 → STRONG_SELL

**Overrides:**
- Earnings within N days: escalate to at least WATCH
- Severe negative semantics: escalate

### 10.3 Rotation Logic (Tax-Aware)

Let:
- `S_hold` = current holding's forward score
- `S_best` = best candidate score among allowed universe
- `TaxDrag` = estimated tax cost of selling current position
- `RotateThreshold` = configurable (initial: 8 points)

**Tax Calculation:**
```ts
function calculateTaxDrag(holding) {
  const holdingDays = daysSince(holding.entryDate);
  const isLongTerm = holdingDays >= 365;
  const gainPct = (currentPrice - holding.entryPrice) / holding.entryPrice;

  // Skip if position is at a loss (no tax drag)
  if (gainPct <= 0) return { taxDrag: 0, requiredEdge: 0.02 };

  const taxRate = isLongTerm ? 0.15 : 0.37;
  const taxDrag = gainPct * taxRate;

  return {
    taxDrag,
    requiredEdge: taxDrag + 0.02,  // 2% buffer for transaction costs
    daysToLongTerm: Math.max(0, 365 - holdingDays),
  };
}
```

**Recommend ROTATE if:**
- `S_best - S_hold >= RotateThreshold + (TaxDrag * scaleFactor)`
- Candidate has adequate liquidity
- No immediate red flags (e.g., earnings tomorrow)

**Tax-aware considerations:**
- If close to long-term status (< 30 days), increase threshold to hold
- Display tax impact in rotation recommendation explain

---

## 11. Soft Data / Semantics (Agent C)

### 11.1 Phase 1: Heuristic Labeling (required)

- Normalize: dedupe syndicated content via `contentHash`
- Label via keyword/pattern rules:
  - guidance up/down
  - downgrade/upgrade
  - lawsuit/regulatory risk
  - dilution/offering
  - product/demand signals
- Output stored as `NewsLabel`

### 11.2 Phase 2: LLM Classification (GPT-4o-mini)

- Use for uncertain cases or to validate heuristics
- Strict JSON schema:
  - `tags[]`, `direction`, `severity 0–3`, `confidence`
- Cache by `contentHash` (never re-process same content)
- Validate schema; fallback to heuristic if LLM fails
- **Cost control:** Only call LLM for high-uncertainty items

### 11.3 Aggregation Features

Compute rolling per ticker:
- `news_sentiment_7d` (recency-weighted direction score)
- `news_sentiment_30d`
- `tail_risk_score_14d` (negative severity accumulation)
- `catalyst_momentum_14d` (direction × severity × recency)
- `earnings_within_5d` / `earnings_within_10d` flags

---

## 12. Backtesting Framework

### 12.1 Purpose
- Validate and optimize scoring weights
- Calibrate sell signal thresholds
- Measure system performance before live deployment

### 12.2 Historical Data
- 2 years of EOD bars for universe
- Simulated news sentiment (or historical if available)

### 12.3 Optimization Approach
- Grid search or Bayesian optimization over weight/threshold space
- Walk-forward validation to avoid overfitting
- Out-of-sample testing on most recent 3-6 months

### 12.4 Metrics
- Total return
- Sharpe ratio
- Maximum drawdown
- Win rate
- Average hold time
- Tax efficiency (simulated)

### 12.5 Output
- Optimized weight configuration
- Optimized threshold configuration
- Performance report with confidence intervals
- Stored in `BacktestRun` for audit

---

## 13. Frontend Requirements (Agent B)

### Pages

**`/` Dashboard:**
- Current holding card (symbol, entry, P&L, holding days, days to long-term)
- Sell signal banner + reasons
- Rotate recommendation + target + reasons + tax impact
- Top 10 candidates mini-leaderboard
- Last run status + timestamp

**`/candidates`:**
- Full leaderboard (sortable by score, RS, volatility)
- Filters: score threshold, earnings window toggle, sector
- Click ticker to drill down

**`/ticker/[symbol]`:**
- EOD price chart (candlestick or line)
- Feature grid (technicals + semantics)
- News timeline (recent items with labels)
- Earnings + events panel
- Score breakdown visualization

**`/settings`:**
- Universe editor (add/remove tickers, run screen)
- Current holding editor (set position)
- Threshold configuration
- Defense classification overrides
- Run history + "run now" manual trigger

### Defense UI behavior
- `DEFENSE_PRIMARY` tickers:
  - Excluded from leaderboard
  - Show "Excluded: Primary defense contractor" if accessed directly
  - Visible in settings for manual override

---

## 14. Performance & Reliability

### Rate Limiting
- Batch external API calls with `p-limit` concurrency control
- Respect FMP rate limits (300 calls/min on Starter plan)

### Incremental Updates
- Track last fetched date per ticker
- Only fetch new bars since last run

### Caching
- Cache LLM outputs by `contentHash`
- Cache computed features (recompute only on new bars)

### Auditability
- Store `asOfDate` timestamps on all computed values
- Log all `JobRun` records with summary/error JSON

### Resilience
- If provider fails: use cached data, log warning, continue
- UI remains usable when providers are rate-limited (reads from DB)

---

## 15. Completion Criteria

- [ ] Daily cron reliably updates `Score`, `Signal`, `JobRun`
- [ ] No `DEFENSE_PRIMARY` ticker appears as candidate or rotation target
- [ ] Backtest framework validates scoring weights and thresholds
- [ ] Tax impact calculated and displayed for rotation recommendations
- [ ] Every score/signal is explainable (features + soft signals)
- [ ] 2 years of historical data loaded for backtesting
- [ ] UI functional: dashboard, candidates, ticker detail, settings
- [ ] System operates within ~$45-55/month budget

---

**End of Spec**
