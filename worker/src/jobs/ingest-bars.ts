import { prisma } from "../lib/prisma.js";
import { fetchEODBars, fetchMultipleEODBars, type FMPBar } from "../providers/fmp.js";

const BATCH_SIZE = 10; // Process symbols in batches to manage API rate limits

export async function ingestBarsForUniverse(
  universe: string[],
  fromDate?: string
): Promise<{ processed: number; barsInserted: number; errors: string[] }> {
  let processed = 0;
  let barsInserted = 0;
  const errors: string[] = [];

  // Always include SPY as benchmark
  const symbolsToFetch = [...new Set([...universe, "SPY"])];

  // Determine from date - default to last bar date per symbol or yesterday
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 5); // Last 5 days for incremental

  for (let i = 0; i < symbolsToFetch.length; i += BATCH_SIZE) {
    const batch = symbolsToFetch.slice(i, i + BATCH_SIZE);
    console.log(`Ingesting bars for batch ${i / BATCH_SIZE + 1}: ${batch.join(", ")}`);

    const barsMap = await fetchMultipleEODBars(
      batch,
      fromDate || defaultFrom.toISOString().split("T")[0]
    );

    for (const [symbol, bars] of barsMap) {
      if (bars.length === 0) {
        errors.push(`${symbol}: No bars returned`);
        continue;
      }

      try {
        const inserted = await upsertBars(symbol, bars);
        barsInserted += inserted;
        processed++;
      } catch (error) {
        errors.push(`${symbol}: ${String(error)}`);
      }
    }
  }

  console.log(`Ingestion complete: ${processed} symbols, ${barsInserted} bars inserted`);
  return { processed, barsInserted, errors };
}

export async function backfillHistoricalBars(
  symbols: string[],
  years = 2
): Promise<{ processed: number; barsInserted: number; errors: string[] }> {
  let processed = 0;
  let barsInserted = 0;
  const errors: string[] = [];

  // Calculate from date (2 years ago)
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - years);
  const fromDateStr = fromDate.toISOString().split("T")[0];

  // Always include SPY for benchmark calculations
  const symbolsToFetch = [...new Set([...symbols, "SPY"])];

  console.log(`Backfilling ${symbolsToFetch.length} symbols from ${fromDateStr}`);

  // Process one at a time for backfill to avoid rate limits
  for (const symbol of symbolsToFetch) {
    console.log(`Backfilling ${symbol}...`);

    try {
      const bars = await fetchEODBars(symbol, fromDateStr);

      if (bars.length === 0) {
        errors.push(`${symbol}: No bars returned`);
        continue;
      }

      const inserted = await upsertBars(symbol, bars);
      barsInserted += inserted;
      processed++;
      console.log(`  ${symbol}: ${inserted} bars inserted`);

      // Small delay to be kind to the API
      await sleep(200);
    } catch (error) {
      errors.push(`${symbol}: ${String(error)}`);
      console.error(`  ${symbol}: Error - ${error}`);
    }
  }

  console.log(`\nBackfill complete: ${processed} symbols, ${barsInserted} bars inserted`);
  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  return { processed, barsInserted, errors };
}

async function upsertBars(symbol: string, bars: FMPBar[]): Promise<number> {
  // Ensure ticker exists with retry
  await withRetry(() =>
    prisma.ticker.upsert({
      where: { symbol },
      update: {},
      create: { symbol, enabled: symbol === "SPY" ? false : true }, // SPY is benchmark, not tradable
    })
  );

  // Upsert bars in smaller batches with retry for Neon connection resilience
  let inserted = 0;
  const UPSERT_BATCH = 25; // Smaller batches for serverless DB

  for (let i = 0; i < bars.length; i += UPSERT_BATCH) {
    const batch = bars.slice(i, i + UPSERT_BATCH);

    await withRetry(async () => {
      await prisma.$transaction(
        batch.map((bar) =>
          prisma.dailyBar.upsert({
            where: {
              symbol_date: {
                symbol,
                date: new Date(bar.date),
              },
            },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              adjClose: bar.adjClose,
              volume: BigInt(bar.volume),
            },
            create: {
              symbol,
              date: new Date(bar.date),
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              adjClose: bar.adjClose,
              volume: BigInt(bar.volume),
            },
          })
        )
      );
    });

    inserted += batch.length;

    // Small delay between batches to avoid overwhelming Neon
    await sleep(50);
  }

  return inserted;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isConnectionError =
        String(error).includes("Server has closed the connection") ||
        String(error).includes("Connection") ||
        String(error).includes("ECONNRESET");

      if (!isConnectionError || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`  Connection error, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export async function getLastBarDate(symbol: string): Promise<Date | null> {
  const lastBar = await prisma.dailyBar.findFirst({
    where: { symbol },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  return lastBar?.date ?? null;
}

export async function getBarCount(symbol: string): Promise<number> {
  return prisma.dailyBar.count({
    where: { symbol },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
