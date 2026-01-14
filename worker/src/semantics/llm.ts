import { prisma } from "../lib/prisma.js";
import type { NormalizedNews } from "./normalize.js";
import type { NewsLabel, SentimentDirection } from "./label.js";
import { persistLabel } from "./label.js";

// ============================================
// TYPES
// ============================================

interface LLMResponse {
  tags: string[];
  direction: SentimentDirection;
  severity: number;
  confidence: number;
}

const VALID_TAGS = [
  "guidance_up",
  "guidance_down",
  "upgrade",
  "downgrade",
  "legal_risk",
  "regulatory_positive",
  "regulatory_negative",
  "dilution",
  "buyback",
  "catalyst_positive",
  "restructuring",
  "earnings_beat",
  "earnings_miss",
] as const;

// ============================================
// OPENAI CLIENT
// ============================================

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  return key;
}

async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial news analyst. Analyze news and respond with JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message?: { content?: string } }>;
  };
  return data.choices[0]?.message?.content || "";
}

// ============================================
// LABELING FUNCTIONS
// ============================================

const LLM_PROMPT_TEMPLATE = `Analyze this financial news and respond with JSON only:

Title: {title}
Summary: {summary}

Respond with this exact JSON structure:
{
  "tags": ["tag1", "tag2"],
  "direction": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "severity": 0-3,
  "confidence": 0.0-1.0
}

Valid tags: guidance_up, guidance_down, upgrade, downgrade, legal_risk, regulatory_positive, regulatory_negative, dilution, buyback, catalyst_positive, restructuring, earnings_beat, earnings_miss

Severity: 0=negligible, 1=minor, 2=moderate, 3=major
Only include tags that apply. If nothing significant, use empty tags array and NEUTRAL.`;

function parseAndValidateResponse(content: string): LLMResponse | null {
  try {
    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (
      !Array.isArray(parsed.tags) ||
      !["POSITIVE", "NEGATIVE", "NEUTRAL"].includes(parsed.direction) ||
      typeof parsed.severity !== "number" ||
      typeof parsed.confidence !== "number"
    ) {
      return null;
    }

    // Filter to valid tags only
    const validTags = parsed.tags.filter((t: string) =>
      VALID_TAGS.includes(t as (typeof VALID_TAGS)[number])
    );

    return {
      tags: validTags,
      direction: parsed.direction as SentimentDirection,
      severity: Math.max(0, Math.min(3, Math.round(parsed.severity))),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    };
  } catch {
    return null;
  }
}

/**
 * Label a single news item using GPT-4o-mini.
 */
export async function labelNewsWithLLM(
  news: Pick<NormalizedNews, "title" | "summary">,
  newsId?: string
): Promise<NewsLabel> {
  const prompt = LLM_PROMPT_TEMPLATE.replace("{title}", news.title).replace(
    "{summary}",
    news.summary.slice(0, 500) // Limit summary length
  );

  const response = await callOpenAI(prompt);
  const parsed = parseAndValidateResponse(response);

  if (!parsed) {
    // Fallback to neutral if parsing fails
    return {
      newsId: newsId || "",
      tags: [],
      direction: "NEUTRAL",
      severity: 0,
      confidence: 0.5,
    };
  }

  return {
    newsId: newsId || "",
    tags: parsed.tags,
    direction: parsed.direction,
    severity: parsed.severity,
    confidence: parsed.confidence,
  };
}

/**
 * Persist an LLM label to the database.
 */
async function persistLLMLabel(
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
      modelUsed: "gpt-4o-mini",
    },
    update: {
      tags: label.tags,
      direction: label.direction,
      severity: label.severity,
      confidence: label.confidence,
      modelUsed: "gpt-4o-mini",
      labeledAt: new Date(),
    },
  });
}

/**
 * Batch label news items with LLM.
 * Only processes items where heuristic confidence was low.
 */
export async function labelNewsWithLLMBatch(newsIds: string[]): Promise<number> {
  const newsItems = await prisma.newsItem.findMany({
    where: { id: { in: newsIds } },
    include: { label: true },
  });

  let labeled = 0;

  for (const item of newsItems) {
    // Skip if already labeled by LLM
    if (item.label?.modelUsed === "gpt-4o-mini") {
      continue;
    }

    try {
      const label = await labelNewsWithLLM(
        { title: item.title, summary: item.summary || "" },
        item.id
      );
      await persistLLMLabel(item.id, label);
      labeled++;

      // Rate limiting - avoid hitting OpenAI rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to label news ${item.id} with LLM:`, error);
    }
  }

  return labeled;
}

/**
 * Process items that need LLM labeling (low heuristic confidence).
 */
export async function processLowConfidenceItems(
  confidenceThreshold = 0.6
): Promise<number> {
  const items = await prisma.newsLabel.findMany({
    where: {
      confidence: { lt: confidenceThreshold },
      modelUsed: "heuristic",
    },
    select: {
      newsId: true,
    },
    take: 50, // Batch limit for cost control
  });

  if (items.length === 0) return 0;

  const newsIds = items.map((i: { newsId: string }) => i.newsId);
  return labelNewsWithLLMBatch(newsIds);
}
