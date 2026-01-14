import { createHash } from "crypto";
import { fetchStockNews, type FMPNewsItem } from "../providers/fmp.js";
import { prisma } from "../lib/prisma.js";

// ============================================
// TYPES
// ============================================

export interface NormalizedNews {
  symbol: string;
  publishedAt: Date;
  source: string;
  title: string;
  url: string;
  summary: string;
  contentHash: string;
  rawJson?: FMPNewsItem;
}

// ============================================
// NORMALIZATION
// ============================================

/**
 * Generate a content hash for deduplication.
 * Uses title + first 100 chars of summary.
 */
function generateContentHash(title: string, summary: string): string {
  const content = `${title}|${(summary || "").slice(0, 100)}`;
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Transform FMP news item to normalized format.
 */
function normalizeNewsItem(item: FMPNewsItem): NormalizedNews {
  return {
    symbol: item.symbol,
    publishedAt: new Date(item.publishedDate),
    source: item.site,
    title: item.title,
    url: item.url,
    summary: item.text || "",
    contentHash: generateContentHash(item.title, item.text || ""),
    rawJson: item,
  };
}

/**
 * Fetch news from FMP and normalize to our format.
 */
export async function fetchAndNormalizeNews(
  symbols: string[],
  since: Date
): Promise<NormalizedNews[]> {
  // FMP limits tickers per request, batch if needed
  const batchSize = 10;
  const allNews: NormalizedNews[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const newsItems = await fetchStockNews(batch, 100);

    const normalized = newsItems
      .map(normalizeNewsItem)
      .filter((item: NormalizedNews) => item.publishedAt >= since);

    allNews.push(...normalized);
  }

  return allNews;
}

// ============================================
// DEDUPLICATION
// ============================================

/**
 * Deduplicate news items by content hash.
 * Keeps the first occurrence (usually earliest).
 */
export function deduplicateNews(items: NormalizedNews[]): NormalizedNews[] {
  const seen = new Set<string>();
  const unique: NormalizedNews[] = [];

  // Sort by date ascending to keep earliest
  const sorted = [...items].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
  );

  for (const item of sorted) {
    if (!seen.has(item.contentHash)) {
      seen.add(item.contentHash);
      unique.push(item);
    }
  }

  return unique;
}

// ============================================
// PERSISTENCE
// ============================================

/**
 * Persist news items to the database.
 * Skips items where contentHash already exists.
 */
export async function persistNews(items: NormalizedNews[]): Promise<number> {
  let inserted = 0;

  for (const item of items) {
    try {
      await prisma.newsItem.create({
        data: {
          symbol: item.symbol,
          publishedAt: item.publishedAt,
          source: item.source,
          title: item.title,
          url: item.url,
          summary: item.summary,
          contentHash: item.contentHash,
          rawJson: item.rawJson as object,
        },
      });
      inserted++;
    } catch (error: unknown) {
      // Skip duplicates (unique constraint on contentHash)
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        continue;
      }
      throw error;
    }
  }

  return inserted;
}

/**
 * Fetch, normalize, deduplicate, and persist news for given symbols.
 * Returns count of newly inserted items.
 */
export async function ingestNews(
  symbols: string[],
  since: Date
): Promise<{ fetched: number; inserted: number }> {
  const raw = await fetchAndNormalizeNews(symbols, since);
  const deduplicated = deduplicateNews(raw);
  const inserted = await persistNews(deduplicated);

  return {
    fetched: raw.length,
    inserted,
  };
}
