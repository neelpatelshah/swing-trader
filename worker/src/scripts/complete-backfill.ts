/**
 * Complete backfill for missing/incomplete symbols
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { backfillHistoricalBars } from "../jobs/ingest-bars.js";
import { computeFeaturesForUniverse } from "../engine/features.js";
import { scoreUniverse } from "../engine/scoring.js";
import { prisma } from "../lib/prisma.js";

// Symbols to backfill (missing or incomplete)
const SYMBOLS_TO_COMPLETE = [
  "V",    // Missing
  "MA",   // Missing
  "BAC",  // Missing
  "GS",   // Missing
  "SPY",  // Missing (benchmark)
  "UNH",  // Incomplete (200/501)
  "JPM",  // Incomplete (400/501)
  "LOW",  // Incomplete (400/501)
];

async function main() {
  console.log("=== Complete Backfill Script ===\n");

  // 1. Backfill missing/incomplete symbols
  console.log("Step 1: Backfilling missing/incomplete symbols...");
  const backfillResult = await backfillHistoricalBars(SYMBOLS_TO_COMPLETE, 2);
  console.log(`  Processed: ${backfillResult.processed} symbols`);
  console.log(`  Bars inserted: ${backfillResult.barsInserted}`);

  // 2. Get all enabled tickers for feature computation
  const enabledTickers = await prisma.ticker.findMany({
    where: { enabled: true },
    select: { symbol: true },
  });
  const universe = enabledTickers.map((t) => t.symbol);

  // 3. Compute features
  console.log("\nStep 2: Computing features...");
  const asOfDate = await getLatestBarDate();
  if (asOfDate) {
    console.log(`  As-of date: ${asOfDate.toISOString().split("T")[0]}`);
    const featureResult = await computeFeaturesForUniverse(universe, asOfDate);
    console.log(`  Computed: ${featureResult.computed} features`);
  }

  // 4. Score universe
  console.log("\nStep 3: Scoring candidates...");
  if (asOfDate) {
    const scoreResult = await scoreUniverse(universe, asOfDate);
    console.log(`  Scored: ${scoreResult.scored} candidates`);
    console.log("\n  Top 10:");
    scoreResult.topScores.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.symbol}: ${s.score.toFixed(1)}`);
    });
  }

  // 5. Print final summary
  console.log("\n=== Complete ===");
  const tickerCount = await prisma.ticker.count({ where: { enabled: true } });
  const barCount = await prisma.dailyBar.count();
  const featureCount = await prisma.feature.count();
  const scoreCount = await prisma.score.count();

  console.log(`Tickers: ${tickerCount}`);
  console.log(`Daily Bars: ${barCount}`);
  console.log(`Features: ${featureCount}`);
  console.log(`Scores: ${scoreCount}`);

  await prisma.$disconnect();
}

async function getLatestBarDate(): Promise<Date | null> {
  const latest = await prisma.dailyBar.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return latest?.date ?? null;
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
