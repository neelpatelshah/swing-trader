import { prisma } from "../lib/prisma.js";
import type { SentimentDirection } from "./label.js";

// ============================================
// TYPES
// ============================================

export interface SemanticFeatures {
  newsSentiment7d: number; // -1 to 1
  newsSentiment30d: number; // -1 to 1
  tailRiskScore14d: number; // 0 to 10
  catalystMomentum: number; // -1 to 1
  earningsWithin5d: boolean;
  earningsWithin10d: boolean;
}

interface LabeledNewsItem {
  publishedAt: Date;
  direction: SentimentDirection;
  severity: number;
  tags: string[];
}

// ============================================
// HELPERS
// ============================================

function daysBetween(date1: Date, date2: Date): number {
  const ms = Math.abs(date2.getTime() - date1.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================
// SENTIMENT COMPUTATION
// ============================================

const DIRECTION_VALUES: Record<SentimentDirection, number> = {
  POSITIVE: 1,
  NEUTRAL: 0,
  NEGATIVE: -1,
};

/**
 * Compute recency-weighted sentiment over a given window.
 * Uses exponential decay with half-life = days/2.
 */
function computeSentiment(
  labels: LabeledNewsItem[],
  days: number,
  asOfDate: Date
): number {
  const cutoff = addDays(asOfDate, -days);

  const recentLabels = labels.filter((l) => l.publishedAt >= cutoff);
  if (recentLabels.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;
  const halfLife = days / 2;

  for (const label of recentLabels) {
    const daysAgo = daysBetween(label.publishedAt, asOfDate);
    const recencyDecay = Math.exp(-daysAgo / halfLife);
    const directionValue = DIRECTION_VALUES[label.direction] ?? 0;
    const weight = (label.severity + 1) * recencyDecay;

    weightedSum += directionValue * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;

  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, weightedSum / totalWeight));
}

// ============================================
// TAIL RISK COMPUTATION
// ============================================

/**
 * Compute tail risk score emphasizing recent high-severity negative events.
 * Score range: 0-10 (capped).
 */
function computeTailRisk(labels: LabeledNewsItem[], asOfDate: Date): number {
  const cutoff = addDays(asOfDate, -14);

  const recentNegative = labels.filter(
    (l) => l.publishedAt >= cutoff && l.direction === "NEGATIVE"
  );

  // Sum severity^2 to emphasize high-severity events
  const riskScore = recentNegative.reduce(
    (sum, l) => sum + l.severity ** 2,
    0
  );

  // Normalize to 0-10 scale (cap at 10)
  return Math.min(10, riskScore);
}

// ============================================
// CATALYST MOMENTUM
// ============================================

const CATALYST_TAGS = [
  "catalyst_positive",
  "regulatory_positive",
  "regulatory_negative",
  "earnings_beat",
  "earnings_miss",
  "upgrade",
  "downgrade",
];

/**
 * Compute catalyst momentum from catalyst-type news.
 * Direction × severity × recency for recent catalysts.
 */
function computeCatalystMomentum(
  labels: LabeledNewsItem[],
  asOfDate: Date
): number {
  const cutoff = addDays(asOfDate, -14);

  const catalystLabels = labels.filter(
    (l) =>
      l.publishedAt >= cutoff &&
      l.tags.some((t) => CATALYST_TAGS.includes(t))
  );

  if (catalystLabels.length === 0) return 0;

  let momentum = 0;

  for (const label of catalystLabels) {
    const daysAgo = daysBetween(label.publishedAt, asOfDate);
    const recencyDecay = Math.exp(-daysAgo / 7); // 7-day half-life for catalysts
    const directionValue = DIRECTION_VALUES[label.direction] ?? 0;

    momentum += directionValue * (label.severity + 1) * recencyDecay;
  }

  // Normalize to roughly -1 to 1
  return Math.max(-1, Math.min(1, momentum / 5));
}

// ============================================
// EARNINGS CHECK
// ============================================

/**
 * Check if there are upcoming earnings events.
 */
async function checkEarnings(
  symbol: string,
  asOfDate: Date
): Promise<{ within5d: boolean; within10d: boolean }> {
  const events = await prisma.event.findMany({
    where: {
      symbol,
      eventType: "EARNINGS",
      eventDate: {
        gte: asOfDate,
        lte: addDays(asOfDate, 10),
      },
    },
  });

  return {
    within5d: events.some((e: { eventDate: Date }) => daysBetween(asOfDate, e.eventDate) <= 5),
    within10d: events.length > 0,
  };
}

// ============================================
// MAIN AGGREGATION
// ============================================

/**
 * Fetch labeled news for a symbol.
 */
async function fetchLabeledNews(
  symbol: string,
  since: Date
): Promise<LabeledNewsItem[]> {
  const newsItems = await prisma.newsItem.findMany({
    where: {
      symbol,
      publishedAt: { gte: since },
    },
    include: {
      label: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
  });

  return newsItems
    .filter((n): n is typeof n & { label: NonNullable<typeof n.label> } => n.label !== null)
    .map((n) => ({
      publishedAt: n.publishedAt,
      direction: (n.label.direction || "NEUTRAL") as SentimentDirection,
      severity: n.label.severity,
      tags: n.label.tags,
    }));
}

/**
 * Compute semantic features for a single ticker.
 */
export async function computeSemanticFeatures(
  symbol: string,
  asOfDate: Date
): Promise<SemanticFeatures> {
  // Fetch news from last 30 days
  const since = addDays(asOfDate, -30);
  const labels = await fetchLabeledNews(symbol, since);

  // Compute all features
  const earnings = await checkEarnings(symbol, asOfDate);

  return {
    newsSentiment7d: computeSentiment(labels, 7, asOfDate),
    newsSentiment30d: computeSentiment(labels, 30, asOfDate),
    tailRiskScore14d: computeTailRisk(labels, asOfDate),
    catalystMomentum: computeCatalystMomentum(labels, asOfDate),
    earningsWithin5d: earnings.within5d,
    earningsWithin10d: earnings.within10d,
  };
}

/**
 * Persist semantic features to the Feature table.
 */
async function persistSemanticFeatures(
  symbol: string,
  date: Date,
  features: SemanticFeatures
): Promise<void> {
  await prisma.feature.upsert({
    where: {
      symbol_date: { symbol, date },
    },
    create: {
      symbol,
      date,
      newsSentiment7d: features.newsSentiment7d,
      newsSentiment30d: features.newsSentiment30d,
      tailRiskScore14d: features.tailRiskScore14d,
      catalystMomentum: features.catalystMomentum,
      earningsWithin5d: features.earningsWithin5d,
      earningsWithin10d: features.earningsWithin10d,
    },
    update: {
      newsSentiment7d: features.newsSentiment7d,
      newsSentiment30d: features.newsSentiment30d,
      tailRiskScore14d: features.tailRiskScore14d,
      catalystMomentum: features.catalystMomentum,
      earningsWithin5d: features.earningsWithin5d,
      earningsWithin10d: features.earningsWithin10d,
    },
  });
}

/**
 * Compute and persist semantic features for a list of symbols.
 */
export async function computeSemanticFeaturesForUniverse(
  symbols: string[],
  asOfDate: Date
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const symbol of symbols) {
    try {
      const features = await computeSemanticFeatures(symbol, asOfDate);
      await persistSemanticFeatures(symbol, asOfDate, features);
      processed++;
    } catch (error) {
      console.error(`Failed to compute features for ${symbol}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}
