/**
 * Seed script for initial universe setup and historical data backfill
 *
 * Usage: pnpm tsx src/scripts/seed.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (parent of worker/)
config({ path: resolve(__dirname, "../../../.env") });
import { seedInitialUniverse, excludeDefenseTicker } from "../engine/universe.js";
import { backfillHistoricalBars } from "../jobs/ingest-bars.js";
import { computeFeaturesForUniverse } from "../engine/features.js";
import { scoreUniverse } from "../engine/scoring.js";
import { prisma } from "../lib/prisma.js";

// Initial universe: Large-cap tech + growth stocks for swing trading
const INITIAL_UNIVERSE = [
  // Mega-cap tech
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "META",
  "NVDA",
  "TSLA",
  // Large-cap tech
  "AMD",
  "CRM",
  "ADBE",
  "NFLX",
  "AVGO",
  "ORCL",
  "CSCO",
  "INTC",
  // Growth / Consumer
  "COST",
  "HD",
  "LOW",
  "TGT",
  "NKE",
  // Healthcare
  "UNH",
  "JNJ",
  "LLY",
  "PFE",
  "ABBV",
  // Financials
  "JPM",
  "V",
  "MA",
  "BAC",
  "GS",
];

// Defense contractors to exclude (DEFENSE_PRIMARY)
const DEFENSE_EXCLUSIONS = [
  "LMT", // Lockheed Martin
  "RTX", // Raytheon
  "NOC", // Northrop Grumman
  "GD",  // General Dynamics
  "BA",  // Boeing (partially defense)
  "HII", // Huntington Ingalls
  "LHX", // L3Harris
];

async function main() {
  console.log("=== Swing Trader Seed Script ===\n");

  // 1. Exclude defense tickers first
  console.log("Step 1: Excluding defense contractors...");
  for (const symbol of DEFENSE_EXCLUSIONS) {
    await excludeDefenseTicker(symbol);
    console.log(`  Excluded: ${symbol}`);
  }

  // 2. Seed initial universe
  console.log("\nStep 2: Seeding initial universe...");
  const seedResult = await seedInitialUniverse(INITIAL_UNIVERSE);
  console.log(`  Added: ${seedResult.added}, Skipped: ${seedResult.skipped}`);

  // 3. Backfill historical bars (2 years)
  console.log("\nStep 3: Backfilling historical bars (2 years)...");
  console.log("  This may take a few minutes...");
  const backfillResult = await backfillHistoricalBars(INITIAL_UNIVERSE, 2);
  console.log(`  Processed: ${backfillResult.processed} symbols`);
  console.log(`  Bars inserted: ${backfillResult.barsInserted}`);
  if (backfillResult.errors.length > 0) {
    console.log(`  Errors: ${backfillResult.errors.length}`);
  }

  // 4. Compute features for latest date
  console.log("\nStep 4: Computing features...");
  const asOfDate = await getLatestBarDate();
  if (asOfDate) {
    console.log(`  As-of date: ${asOfDate.toISOString().split("T")[0]}`);
    const featureResult = await computeFeaturesForUniverse(INITIAL_UNIVERSE, asOfDate);
    console.log(`  Computed: ${featureResult.computed} features`);
  } else {
    console.log("  No bars found, skipping feature computation");
  }

  // 5. Score universe
  console.log("\nStep 5: Scoring candidates...");
  if (asOfDate) {
    const scoreResult = await scoreUniverse(INITIAL_UNIVERSE, asOfDate);
    console.log(`  Scored: ${scoreResult.scored} candidates`);
    console.log("\n  Top 10:");
    scoreResult.topScores.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.symbol}: ${s.score.toFixed(1)}`);
    });
  }

  // 6. Print summary
  console.log("\n=== Seed Complete ===");
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
  console.error("Seed failed:", error);
  process.exit(1);
});
