import { prisma } from "../lib/prisma.js";
import { fetchEarningsCalendar, type FMPEarningsEvent } from "../providers/fmp.js";

// ============================================
// EARNINGS CALENDAR INTEGRATION
// ============================================

/**
 * Fetch earnings calendar from FMP and persist to Event table.
 * Filters to only include symbols in our universe.
 */
export async function fetchAndPersistEarnings(
  symbols: string[],
  fromDate: string,
  toDate: string
): Promise<{ fetched: number; inserted: number }> {
  // Fetch all earnings in date range
  const earnings = await fetchEarningsCalendar(fromDate, toDate);

  // Create a set for fast lookup
  const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));

  // Filter to our universe
  const relevantEarnings = earnings.filter((e: FMPEarningsEvent) =>
    symbolSet.has(e.symbol.toUpperCase())
  );

  let inserted = 0;

  for (const earning of relevantEarnings) {
    try {
      await prisma.event.upsert({
        where: {
          symbol_eventDate_eventType: {
            symbol: earning.symbol,
            eventDate: new Date(earning.date),
            eventType: "EARNINGS",
          },
        },
        create: {
          symbol: earning.symbol,
          eventDate: new Date(earning.date),
          eventType: "EARNINGS",
          rawJson: earning as object,
        },
        update: {
          rawJson: earning as object,
        },
      });
      inserted++;
    } catch (error: unknown) {
      // Skip if ticker doesn't exist in our universe
      if (
        error instanceof Error &&
        error.message.includes("Foreign key constraint")
      ) {
        continue;
      }
      throw error;
    }
  }

  return {
    fetched: relevantEarnings.length,
    inserted,
  };
}

/**
 * Get upcoming earnings for a list of symbols.
 */
export async function getUpcomingEarnings(
  symbols: string[],
  withinDays = 10
): Promise<Map<string, Date | null>> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + withinDays);

  const events = await prisma.event.findMany({
    where: {
      symbol: { in: symbols },
      eventType: "EARNINGS",
      eventDate: {
        gte: now,
        lte: cutoff,
      },
    },
    orderBy: {
      eventDate: "asc",
    },
  });

  // Create map with null defaults
  const result = new Map<string, Date | null>();
  for (const symbol of symbols) {
    result.set(symbol, null);
  }

  // Fill in actual dates
  for (const event of events) {
    // Only set first (soonest) earnings date
    if (!result.get(event.symbol)) {
      result.set(event.symbol, event.eventDate);
    }
  }

  return result;
}

/**
 * Check if a symbol has earnings within a certain number of days.
 */
export async function hasEarningsWithin(
  symbol: string,
  days: number
): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + days);

  const event = await prisma.event.findFirst({
    where: {
      symbol,
      eventType: "EARNINGS",
      eventDate: {
        gte: now,
        lte: cutoff,
      },
    },
  });

  return event !== null;
}

/**
 * Refresh earnings calendar for the universe.
 * Fetches next 30 days of earnings.
 */
export async function refreshEarningsCalendar(): Promise<{
  fetched: number;
  inserted: number;
}> {
  // Get universe symbols
  const tickers = await prisma.ticker.findMany({
    where: { enabled: true },
    select: { symbol: true },
  });

  const symbols = tickers.map((t: { symbol: string }) => t.symbol);

  // Calculate date range (today + 30 days)
  const now = new Date();
  const fromDate = now.toISOString().split("T")[0]!;
  const toDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  return fetchAndPersistEarnings(symbols, fromDate, toDate);
}
