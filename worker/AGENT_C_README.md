# Agent C: Semantics + Tax Logic

## Your Responsibility

You own **news processing, sentiment labeling, semantic feature aggregation, and tax-aware rotation calculations**. Your outputs feed into Agent A's scoring engine.

## What's Already Built

```
worker/src/
├── providers/fmp.ts          # fetchStockNews() already implemented
├── tax/rotation-cost.ts      # Tax calculation already implemented
└── semantics/                # Directory exists but empty
```

## What You Need to Build

### 1. News Normalization (`semantics/normalize.ts`)

```ts
interface NormalizedNews {
  symbol: string;
  publishedAt: Date;
  source: string;
  title: string;
  url: string;
  summary: string;
  contentHash: string;  // For deduplication
}

// Fetch news from FMP and normalize
fetchAndNormalizeNews(symbols: string[], since: Date): Promise<NormalizedNews[]>

// Deduplicate syndicated content
deduplicateNews(items: NormalizedNews[]): NormalizedNews[]

// Persist to NewsItem table
persistNews(items: NormalizedNews[]): Promise<void>
```

**Deduplication:**
- Generate `contentHash` from title + first 100 chars of summary
- Use MD5 or SHA256 hash
- Skip inserting if contentHash exists

### 2. Heuristic Labeling (`semantics/label.ts`)

```ts
interface NewsLabel {
  newsId: string;
  tags: string[];
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  severity: number;  // 0-3
  confidence: number;  // 0-1
}

// Label a single news item using keyword rules
labelNewsHeuristic(news: NormalizedNews): NewsLabel

// Batch label
labelNewsItemsBatch(newsIds: string[]): Promise<void>
```

**Heuristic rules (keyword patterns):**

| Pattern | Tags | Direction | Severity |
|---------|------|-----------|----------|
| "guidance raised", "raises guidance", "beats estimates" | ['guidance_up'] | POSITIVE | 2 |
| "guidance lowered", "lowers guidance", "misses estimates" | ['guidance_down'] | NEGATIVE | 2 |
| "upgraded", "price target raised" | ['upgrade'] | POSITIVE | 1 |
| "downgraded", "price target cut" | ['downgrade'] | NEGATIVE | 1 |
| "lawsuit", "sued", "legal action", "SEC investigation" | ['legal_risk'] | NEGATIVE | 2 |
| "FDA approval", "patent granted" | ['regulatory_positive'] | POSITIVE | 2 |
| "FDA rejection", "patent denied" | ['regulatory_negative'] | NEGATIVE | 3 |
| "offering", "dilution", "secondary offering" | ['dilution'] | NEGATIVE | 2 |
| "buyback", "repurchase" | ['buyback'] | POSITIVE | 1 |
| "partnership", "contract win", "deal" | ['catalyst_positive'] | POSITIVE | 1 |
| "layoffs", "restructuring" | ['restructuring'] | NEGATIVE | 1 |

**Implementation:**
```ts
const RULES = [
  { patterns: [/guidance raised/i, /raises guidance/i, /beats estimates/i],
    tags: ['guidance_up'], direction: 'POSITIVE', severity: 2 },
  // ... more rules
];

function labelNewsHeuristic(news: NormalizedNews): NewsLabel {
  const matchedRules = RULES.filter(r =>
    r.patterns.some(p => p.test(news.title) || p.test(news.summary))
  );

  if (matchedRules.length === 0) {
    return { newsId: news.id, tags: [], direction: 'NEUTRAL', severity: 0, confidence: 0.5 };
  }

  // Aggregate matched rules
  const tags = [...new Set(matchedRules.flatMap(r => r.tags))];
  const avgSeverity = matchedRules.reduce((s, r) => s + r.severity, 0) / matchedRules.length;
  const direction = determineOverallDirection(matchedRules);

  return { newsId: news.id, tags, direction, severity: Math.round(avgSeverity), confidence: 0.7 };
}
```

### 3. LLM Labeling (`semantics/llm.ts`)

```ts
// For uncertain cases, use GPT-4o-mini
labelNewsWithLLM(news: NormalizedNews): Promise<NewsLabel>

// Batch process (with caching)
labelNewsWithLLMBatch(newsIds: string[]): Promise<void>
```

**LLM prompt:**
```
Analyze this financial news and respond with JSON only:

Title: {title}
Summary: {summary}

Respond with this exact JSON structure:
{
  "tags": ["tag1", "tag2"],  // From: guidance_up, guidance_down, upgrade, downgrade, legal_risk, regulatory_positive, regulatory_negative, dilution, buyback, catalyst_positive, restructuring, earnings_beat, earnings_miss
  "direction": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "severity": 0-3,  // 0=negligible, 1=minor, 2=moderate, 3=major
  "confidence": 0.0-1.0
}
```

**Cost control:**
- Only call LLM when heuristic confidence < 0.6
- Cache by contentHash (never re-process same content)
- Set modelUsed = 'gpt-4o-mini' in NewsLabel

### 4. Semantic Aggregation (`semantics/aggregate.ts`)

```ts
interface SemanticFeatures {
  newsSentiment7d: number;    // -1 to 1
  newsSentiment30d: number;   // -1 to 1
  tailRiskScore14d: number;   // 0 to 10
  catalystMomentum: number;   // -1 to 1
  earningsWithin5d: boolean;
  earningsWithin10d: boolean;
}

// Compute semantic features for a ticker
computeSemanticFeatures(symbol: string, asOfDate: Date): Promise<SemanticFeatures>

// Batch compute for universe
computeSemanticFeaturesForUniverse(symbols: string[], asOfDate: Date): Promise<void>
```

**Aggregation formulas:**

**newsSentiment7d / newsSentiment30d:**
```ts
// Recency-weighted sentiment
// direction: POSITIVE=1, NEUTRAL=0, NEGATIVE=-1
// weight = severity * recencyDecay

function computeSentiment(labels: NewsLabel[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recentLabels = labels.filter(l => l.publishedAt >= cutoff);
  if (recentLabels.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const label of recentLabels) {
    const daysAgo = daysBetween(label.publishedAt, new Date());
    const recencyDecay = Math.exp(-daysAgo / (days / 2));  // Half-life decay
    const directionValue = { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: -1 }[label.direction];
    const weight = (label.severity + 1) * recencyDecay;

    weightedSum += directionValue * weight;
    totalWeight += weight;
  }

  return weightedSum / totalWeight;  // Returns -1 to 1
}
```

**tailRiskScore14d:**
```ts
// Accumulate negative severity, emphasizing recent high-severity events
function computeTailRisk(labels: NewsLabel[]): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const recentNegative = labels.filter(l =>
    l.publishedAt >= cutoff && l.direction === 'NEGATIVE'
  );

  // Sum severity^2 to emphasize high-severity events
  const riskScore = recentNegative.reduce((sum, l) => sum + l.severity ** 2, 0);

  // Normalize to 0-10 scale (cap at 10)
  return Math.min(10, riskScore);
}
```

**catalystMomentum:**
```ts
// Direction × severity × recency for catalyst-type news
// Captures momentum of positive/negative catalysts
```

**earningsWithin5d / earningsWithin10d:**
```ts
// Query Event table for upcoming EARNINGS events
async function checkEarnings(symbol: string, asOfDate: Date): Promise<{ within5d: boolean, within10d: boolean }> {
  const events = await prisma.event.findMany({
    where: {
      symbol,
      eventType: 'EARNINGS',
      eventDate: {
        gte: asOfDate,
        lte: addDays(asOfDate, 10)
      }
    }
  });

  return {
    within5d: events.some(e => daysBetween(asOfDate, e.eventDate) <= 5),
    within10d: events.length > 0
  };
}
```

### 5. Tax-Aware Rotation (`tax/rotation-cost.ts`)

**Already implemented!** Review and ensure it's correct:

```ts
interface TaxImpact {
  holdingDays: number;
  isLongTerm: boolean;          // >= 365 days
  estimatedGainPct: number;
  estimatedTaxRate: number;     // 0.15 long-term, 0.37 short-term
  taxDragPct: number;           // gainPct × taxRate
  daysToLongTerm: number;
  requiredEdgeToRotate: number; // taxDrag + 2% buffer
}

calculateTaxDrag(entryDate: Date, entryPrice: number, currentPrice: number): TaxImpact
```

**Enhancements to add:**

```ts
// Format for display
formatTaxImpact(impact: TaxImpact): string

// Should we wait for long-term status?
shouldWaitForLongTerm(impact: TaxImpact, bestCandidateEdge: number): boolean
```

### 6. Earnings Calendar Integration

```ts
// Fetch earnings from FMP and persist
fetchAndPersistEarnings(symbols: string[], fromDate: string, toDate: string): Promise<void>
```

Use `fetchEarningsCalendar` from `providers/fmp.ts`.

## Database Tables You Own

- `NewsItem` - Raw news storage
- `NewsLabel` - Sentiment labels
- `Event` - Earnings calendar

## Tables You Read From

- `Ticker` - Universe list
- `DailyBar` - For current price in tax calculations

## Tables Agent A Reads From You

Agent A's scoring engine will read:
- `Feature.newsSentiment7d`
- `Feature.newsSentiment30d`
- `Feature.tailRiskScore14d`
- `Feature.catalystMomentum`
- `Feature.earningsWithin5d`
- `Feature.earningsWithin10d`

**Integration point:** Agent A will call your `computeSemanticFeatures()` function during the daily pipeline, then merge results into the Feature table.

## Environment Variables You Need

```
DATABASE_URL      # Neon Postgres connection string
FMP_API_KEY       # For news and earnings
OPENAI_API_KEY    # For LLM labeling (optional)
```

## Dependencies on Other Agents

- **Agent A**: Calls your semantic aggregation functions
- **Agent B**: None (frontend just displays your data)

## Export Interface for Agent A

Create `semantics/index.ts`:

```ts
export { fetchAndNormalizeNews, deduplicateNews, persistNews } from './normalize';
export { labelNewsHeuristic, labelNewsItemsBatch } from './label';
export { labelNewsWithLLM, labelNewsWithLLMBatch } from './llm';
export { computeSemanticFeatures, computeSemanticFeaturesForUniverse } from './aggregate';
export { calculateTaxDrag, formatTaxImpact } from '../tax/rotation-cost';
```

## Testing Your Work

1. **News ingestion:**
   ```ts
   const news = await fetchAndNormalizeNews(['AAPL', 'MSFT'], new Date('2024-01-01'));
   console.log(`Fetched ${news.length} news items`);
   ```

2. **Heuristic labeling:**
   ```ts
   const label = labelNewsHeuristic({
     title: "Apple raises guidance for Q4",
     summary: "Apple Inc. has raised its revenue guidance..."
   });
   // Should return: { direction: 'POSITIVE', tags: ['guidance_up'], severity: 2 }
   ```

3. **Semantic aggregation:**
   ```ts
   const features = await computeSemanticFeatures('AAPL', new Date());
   console.log(features);
   // { newsSentiment7d: 0.3, tailRiskScore14d: 2, ... }
   ```

4. **Tax calculation:**
   ```ts
   const impact = calculateTaxDrag(
     new Date('2024-06-01'),  // Entry 200 days ago
     150.00,                   // Entry price
     180.00                    // Current price (20% gain)
   );
   // Should show short-term rate, ~7.4% tax drag
   ```

## Definition of Done

- [ ] News ingestion fetches and deduplicates correctly
- [ ] Heuristic labeling tags common patterns accurately
- [ ] LLM labeling works for uncertain cases (with caching)
- [ ] Semantic features aggregate correctly
- [ ] Tax calculations match expected values
- [ ] Earnings calendar populates Event table
- [ ] All functions exported for Agent A to consume
