import { prisma } from "../lib/prisma.js";
import type { NormalizedNews } from "./normalize.js";

// ============================================
// TYPES
// ============================================

export type SentimentDirection = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface NewsLabel {
  newsId: string;
  tags: string[];
  direction: SentimentDirection;
  severity: number; // 0-3
  confidence: number; // 0-1
}

// ============================================
// HEURISTIC RULES
// ============================================

interface LabelRule {
  patterns: RegExp[];
  tags: string[];
  direction: SentimentDirection;
  severity: number;
}

const RULES: LabelRule[] = [
  // Guidance
  {
    patterns: [/guidance raised/i, /raises guidance/i, /beats estimates/i],
    tags: ["guidance_up"],
    direction: "POSITIVE",
    severity: 2,
  },
  {
    patterns: [/guidance lowered/i, /lowers guidance/i, /misses estimates/i],
    tags: ["guidance_down"],
    direction: "NEGATIVE",
    severity: 2,
  },

  // Analyst ratings
  {
    patterns: [/upgraded/i, /price target raised/i, /price target increased/i],
    tags: ["upgrade"],
    direction: "POSITIVE",
    severity: 1,
  },
  {
    patterns: [/downgraded/i, /price target cut/i, /price target lowered/i],
    tags: ["downgrade"],
    direction: "NEGATIVE",
    severity: 1,
  },

  // Legal risks
  {
    patterns: [
      /lawsuit/i,
      /\bsued\b/i,
      /legal action/i,
      /SEC investigation/i,
      /DOJ investigation/i,
      /regulatory probe/i,
    ],
    tags: ["legal_risk"],
    direction: "NEGATIVE",
    severity: 2,
  },

  // Regulatory
  {
    patterns: [
      /FDA approval/i,
      /patent granted/i,
      /regulatory approval/i,
      /receives approval/i,
    ],
    tags: ["regulatory_positive"],
    direction: "POSITIVE",
    severity: 2,
  },
  {
    patterns: [
      /FDA rejection/i,
      /patent denied/i,
      /regulatory rejection/i,
      /approval denied/i,
      /CRL received/i, // Complete Response Letter
    ],
    tags: ["regulatory_negative"],
    direction: "NEGATIVE",
    severity: 3,
  },

  // Dilution / capital
  {
    patterns: [
      /secondary offering/i,
      /stock offering/i,
      /\bdilution\b/i,
      /shelf registration/i,
      /ATM offering/i,
    ],
    tags: ["dilution"],
    direction: "NEGATIVE",
    severity: 2,
  },
  {
    patterns: [/buyback/i, /share repurchase/i, /repurchase program/i],
    tags: ["buyback"],
    direction: "POSITIVE",
    severity: 1,
  },

  // Catalysts
  {
    patterns: [
      /partnership/i,
      /contract win/i,
      /awarded contract/i,
      /strategic deal/i,
      /acquisition of/i,
    ],
    tags: ["catalyst_positive"],
    direction: "POSITIVE",
    severity: 1,
  },

  // Restructuring
  {
    patterns: [
      /layoffs/i,
      /restructuring/i,
      /workforce reduction/i,
      /cost cutting/i,
      /headcount reduction/i,
    ],
    tags: ["restructuring"],
    direction: "NEGATIVE",
    severity: 1,
  },

  // Earnings
  {
    patterns: [
      /earnings beat/i,
      /beats earnings/i,
      /profit beats/i,
      /revenue beats/i,
      /strong quarter/i,
    ],
    tags: ["earnings_beat"],
    direction: "POSITIVE",
    severity: 2,
  },
  {
    patterns: [
      /earnings miss/i,
      /misses earnings/i,
      /profit misses/i,
      /revenue misses/i,
      /weak quarter/i,
    ],
    tags: ["earnings_miss"],
    direction: "NEGATIVE",
    severity: 2,
  },
];

// ============================================
// LABELING FUNCTIONS
// ============================================

/**
 * Determine overall direction from matched rules.
 * If conflicting signals, weigh by severity.
 */
function determineOverallDirection(
  matchedRules: LabelRule[]
): SentimentDirection {
  let positiveWeight = 0;
  let negativeWeight = 0;

  for (const rule of matchedRules) {
    if (rule.direction === "POSITIVE") {
      positiveWeight += rule.severity + 1;
    } else if (rule.direction === "NEGATIVE") {
      negativeWeight += rule.severity + 1;
    }
  }

  if (positiveWeight > negativeWeight) return "POSITIVE";
  if (negativeWeight > positiveWeight) return "NEGATIVE";
  return "NEUTRAL";
}

/**
 * Label a single news item using keyword rules.
 */
export function labelNewsHeuristic(
  news: Pick<NormalizedNews, "title" | "summary">,
  newsId?: string
): NewsLabel {
  const text = `${news.title} ${news.summary}`;

  const matchedRules = RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(text))
  );

  if (matchedRules.length === 0) {
    return {
      newsId: newsId || "",
      tags: [],
      direction: "NEUTRAL",
      severity: 0,
      confidence: 0.5,
    };
  }

  const tags = [...new Set(matchedRules.flatMap((r) => r.tags))];
  const avgSeverity =
    matchedRules.reduce((s, r) => s + r.severity, 0) / matchedRules.length;
  const direction = determineOverallDirection(matchedRules);

  // Higher confidence with more matches
  const confidence = Math.min(0.7 + matchedRules.length * 0.05, 0.9);

  return {
    newsId: newsId || "",
    tags,
    direction,
    severity: Math.round(avgSeverity),
    confidence,
  };
}

/**
 * Persist a label to the database.
 */
export async function persistLabel(
  newsId: string,
  label: NewsLabel
): Promise<void> {
  await prisma.newsLabel.upsert({
    where: { newsId },
    create: {
      newsId,
      tags: label.tags,
      direction: label.direction,
      severity: label.severity,
      confidence: label.confidence,
      modelUsed: "heuristic",
    },
    update: {
      tags: label.tags,
      direction: label.direction,
      severity: label.severity,
      confidence: label.confidence,
      modelUsed: "heuristic",
      labeledAt: new Date(),
    },
  });
}

/**
 * Batch label news items by their IDs.
 * Fetches news from DB, labels, and persists labels.
 */
export async function labelNewsItemsBatch(newsIds: string[]): Promise<number> {
  const newsItems = await prisma.newsItem.findMany({
    where: { id: { in: newsIds } },
  });

  let labeled = 0;

  for (const item of newsItems) {
    const label = labelNewsHeuristic(
      { title: item.title, summary: item.summary || "" },
      item.id
    );
    await persistLabel(item.id, label);
    labeled++;
  }

  return labeled;
}

/**
 * Label all unlabeled news items in the database.
 */
export async function labelAllUnlabeled(): Promise<number> {
  const unlabeled = await prisma.newsItem.findMany({
    where: {
      label: null,
    },
    select: {
      id: true,
      title: true,
      summary: true,
    },
  });

  if (unlabeled.length === 0) return 0;

  const ids = unlabeled.map((n: { id: string }) => n.id);
  return labelNewsItemsBatch(ids);
}

/**
 * Get news items that need LLM labeling (low confidence heuristics).
 */
export async function getItemsNeedingLLM(threshold = 0.6): Promise<string[]> {
  const items = await prisma.newsLabel.findMany({
    where: {
      confidence: { lt: threshold },
      modelUsed: "heuristic",
    },
    select: {
      newsId: true,
    },
  });

  return items.map((i: { newsId: string }) => i.newsId);
}
