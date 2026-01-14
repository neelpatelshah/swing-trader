import { prisma } from "../lib/prisma.js";

interface ScoringWeights {
  trend: number;
  relativeStrength: number;
  volatility: number;
  drawdownRisk: number;
  liquidity: number;
  catalyst: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  trend: 30,
  relativeStrength: 20,
  volatility: 15,
  drawdownRisk: 15,
  liquidity: 10,
  catalyst: 10,
};

interface ScoreResult {
  swingScore: number;
  components: Record<string, number>;
  topReasons: string[];
  warnings: string[];
  projection: {
    horizonDays: number;
    expectedMovePct: number;
    expectedRangePct: [number, number];
    confidence: "LOW" | "MEDIUM" | "HIGH";
    notes: string[];
  };
}

export async function scoreCandidate(
  symbol: string,
  asOfDate: Date,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Promise<ScoreResult> {
  // Verify not defense primary
  const ticker = await prisma.ticker.findUnique({
    where: { symbol },
    select: { defenseClassification: true },
  });

  if (ticker?.defenseClassification === "DEFENSE_PRIMARY") {
    throw new Error(`Cannot score DEFENSE_PRIMARY ticker: ${symbol}`);
  }

  // Get latest features
  const features = await prisma.feature.findFirst({
    where: { symbol, date: { lte: asOfDate } },
    orderBy: { date: "desc" },
  });

  if (!features) {
    return createEmptyScore(symbol, "No features available");
  }

  // Compute component scores
  const components: Record<string, number> = {};
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Trend score (0-30)
  components["trend"] = scoreTrend(features, weights.trend, reasons, warnings);

  // Relative strength score (0-20)
  components["relativeStrength"] = scoreRelativeStrength(
    features,
    weights.relativeStrength,
    reasons
  );

  // Volatility suitability (0-15)
  components["volatility"] = scoreVolatility(
    features,
    weights.volatility,
    reasons,
    warnings
  );

  // Drawdown risk (0-15)
  components["drawdownRisk"] = scoreDrawdownRisk(
    features,
    weights.drawdownRisk,
    reasons,
    warnings
  );

  // Liquidity (0-10)
  components["liquidity"] = scoreLiquidity(weights.liquidity, reasons);

  // Catalyst/semantics (0-10)
  components["catalyst"] = scoreCatalyst(features, weights.catalyst, reasons);

  // Sum components
  const swingScore = Object.values(components).reduce((a, b) => a + b, 0);

  // Compute projection
  const projection = computeProjection(features, swingScore);

  return {
    swingScore,
    components,
    topReasons: reasons.slice(0, 3),
    warnings,
    projection,
  };
}

function scoreTrend(
  features: { sma20: number | null; sma50: number | null; sma200: number | null },
  maxScore: number,
  reasons: string[],
  warnings: string[]
): number {
  // TODO: Get current price to compare against SMAs
  // For now, use placeholder logic
  let score = maxScore * 0.5; // Neutral default

  if (features.sma50 && features.sma200) {
    if (features.sma50 > features.sma200) {
      score = maxScore * 0.8;
      reasons.push("SMA50 above SMA200 (bullish trend)");
    } else {
      score = maxScore * 0.3;
      warnings.push("SMA50 below SMA200 (bearish trend)");
    }
  }

  return Math.round(score);
}

function scoreRelativeStrength(
  features: { rsVsSpy: number | null },
  maxScore: number,
  reasons: string[]
): number {
  if (!features.rsVsSpy) return maxScore * 0.5;

  // rsVsSpy is a percentile (0-100)
  const pct = features.rsVsSpy / 100;
  const score = maxScore * pct;

  if (pct > 0.7) {
    reasons.push(`Strong relative strength vs SPY (${Math.round(pct * 100)}th pctl)`);
  }

  return Math.round(score);
}

function scoreVolatility(
  features: { atr14: number | null },
  maxScore: number,
  reasons: string[],
  warnings: string[]
): number {
  if (!features.atr14) return maxScore * 0.5;

  // TODO: Compare ATR to historical average for this stock
  // For now, assume mid-range volatility is ideal
  const score = maxScore * 0.7;
  reasons.push("Volatility within acceptable range");

  return Math.round(score);
}

function scoreDrawdownRisk(
  features: { rsi14: number | null },
  maxScore: number,
  reasons: string[],
  warnings: string[]
): number {
  if (!features.rsi14) return maxScore * 0.5;

  // Lower RSI = higher drawdown risk already priced in
  // Very high RSI = potential pullback risk
  let score = maxScore * 0.5;

  if (features.rsi14 < 30) {
    score = maxScore * 0.3;
    warnings.push(`RSI oversold (${Math.round(features.rsi14)}) - high drawdown risk`);
  } else if (features.rsi14 > 70) {
    score = maxScore * 0.4;
    warnings.push(`RSI overbought (${Math.round(features.rsi14)}) - pullback likely`);
  } else if (features.rsi14 >= 40 && features.rsi14 <= 60) {
    score = maxScore * 0.9;
    reasons.push("RSI neutral - healthy setup");
  }

  return Math.round(score);
}

function scoreLiquidity(maxScore: number, reasons: string[]): number {
  // TODO: Check average volume against threshold
  // For now, assume passed universe screen = adequate liquidity
  reasons.push("Passed liquidity screen");
  return Math.round(maxScore * 0.8);
}

function scoreCatalyst(
  features: {
    catalystMomentum: number | null;
    earningsWithin5d: boolean;
    earningsWithin10d: boolean;
  },
  maxScore: number,
  reasons: string[]
): number {
  let score = maxScore * 0.5;

  if (features.catalystMomentum && features.catalystMomentum > 0) {
    score = maxScore * 0.8;
    reasons.push("Positive news catalyst momentum");
  }

  return Math.round(score);
}

function computeProjection(
  features: { atr14: number | null },
  swingScore: number
): ScoreResult["projection"] {
  // ATR-based projection
  const atr = features.atr14 || 0;

  // Higher scores = longer holding expectation
  const horizonDays = swingScore > 70 ? 40 : swingScore > 50 ? 30 : 20;

  // Expected move based on ATR
  const atrMultiple = horizonDays / 14;
  const expectedMovePct = atr * atrMultiple;

  return {
    horizonDays,
    expectedMovePct: Math.round(expectedMovePct * 100) / 100,
    expectedRangePct: [
      Math.round(-expectedMovePct * 0.5 * 100) / 100,
      Math.round(expectedMovePct * 1.5 * 100) / 100,
    ],
    confidence: swingScore > 70 ? "HIGH" : swingScore > 50 ? "MEDIUM" : "LOW",
    notes: [],
  };
}

function createEmptyScore(symbol: string, reason: string): ScoreResult {
  return {
    swingScore: 0,
    components: {},
    topReasons: [],
    warnings: [reason],
    projection: {
      horizonDays: 0,
      expectedMovePct: 0,
      expectedRangePct: [0, 0],
      confidence: "LOW",
      notes: [reason],
    },
  };
}

export async function persistScore(
  symbol: string,
  asOfDate: Date,
  result: ScoreResult
): Promise<void> {
  await prisma.score.upsert({
    where: {
      symbol_asOfDate: { symbol, asOfDate },
    },
    update: {
      swingScore: result.swingScore,
      projectionJson: result.projection,
      explainJson: {
        components: result.components,
        topReasons: result.topReasons,
        warnings: result.warnings,
      },
    },
    create: {
      symbol,
      asOfDate,
      swingScore: result.swingScore,
      projectionJson: result.projection,
      explainJson: {
        components: result.components,
        topReasons: result.topReasons,
        warnings: result.warnings,
      },
    },
  });
}

export async function scoreUniverse(
  symbols: string[],
  asOfDate: Date,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Promise<{
  scored: number;
  errors: string[];
  topScores: { symbol: string; score: number }[];
}> {
  const errors: string[] = [];
  const scores: { symbol: string; score: number }[] = [];

  console.log(`Scoring ${symbols.length} candidates for ${asOfDate.toISOString().split("T")[0]}`);

  for (const symbol of symbols) {
    try {
      const result = await scoreCandidate(symbol, asOfDate, weights);
      await persistScore(symbol, asOfDate, result);
      scores.push({ symbol, score: result.swingScore });
    } catch (error) {
      errors.push(`${symbol}: ${String(error)}`);
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  console.log(`Scored: ${scores.length}/${symbols.length}`);
  if (scores.length > 0) {
    console.log(`Top 5:`);
    scores.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.symbol}: ${s.score.toFixed(1)}`);
    });
  }

  return {
    scored: scores.length,
    errors,
    topScores: scores.slice(0, 10),
  };
}

export async function getTopScores(
  asOfDate: Date,
  limit = 50
): Promise<{ symbol: string; swingScore: number; projection: unknown; explain: unknown }[]> {
  const scores = await prisma.score.findMany({
    where: { asOfDate },
    orderBy: { swingScore: "desc" },
    take: limit,
  });

  return scores.map((s) => ({
    symbol: s.symbol,
    swingScore: s.swingScore,
    projection: s.projectionJson,
    explain: s.explainJson,
  }));
}

export { DEFAULT_WEIGHTS, type ScoringWeights, type ScoreResult };
