import { prisma } from "../lib/prisma.js";
import { getTradableUniverse } from "../engine/universe.js";
import { ingestBarsForUniverse } from "../jobs/ingest-bars.js";
import { computeFeaturesForUniverse } from "../engine/features.js";
import { scoreUniverse, getTopScores } from "../engine/scoring.js";
import {
  computeSellSignal,
  computeRotationRecommendation,
  persistSignal,
} from "../engine/signals.js";
import { fetchQuotes } from "../providers/fmp.js";

export async function runDailyJob(): Promise<void> {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Starting daily evaluation job...`);

  // Create job run record
  const jobRun = await prisma.jobRun.create({
    data: {
      runType: "DAILY",
      startedAt,
      status: "RUNNING",
    },
  });

  try {
    // 1. Check if market was open today
    const isMarketOpen = await checkMarketOpen();
    if (!isMarketOpen) {
      console.log("Market closed today, skipping evaluation");
      await completeJob(jobRun.id, "SUCCESS", { skipped: true, reason: "Market closed" });
      return;
    }

    // 2. Load universe (excluding DEFENSE_PRIMARY)
    const universe = await getTradableUniverse();
    console.log(`Loaded ${universe.length} tradable tickers`);

    if (universe.length === 0) {
      console.log("No tickers in universe, skipping evaluation");
      await completeJob(jobRun.id, "SUCCESS", { skipped: true, reason: "Empty universe" });
      return;
    }

    // 3. Fetch latest EOD bars (FMP)
    console.log("\n--- Fetching EOD bars ---");
    const barResult = await ingestBarsForUniverse(universe);
    console.log(`Bars: ${barResult.processed} symbols, ${barResult.barsInserted} bars`);

    // 4. Determine as-of date (yesterday for EOD data)
    const asOfDate = getAsOfDate();
    console.log(`\nAs-of date: ${asOfDate.toISOString().split("T")[0]}`);

    // 5. Compute features
    console.log("\n--- Computing features ---");
    const featureResult = await computeFeaturesForUniverse(universe, asOfDate);
    console.log(`Features: ${featureResult.computed} computed`);

    // 6. Score candidates
    console.log("\n--- Scoring candidates ---");
    const scoreResult = await scoreUniverse(universe, asOfDate);
    console.log(`Scores: ${scoreResult.scored} scored`);

    // 7. Generate signals (if holding exists)
    console.log("\n--- Generating signals ---");
    const signalResult = await generateSignalIfHolding(asOfDate, scoreResult.topScores);

    // Complete job
    const summary = {
      asOfDate: asOfDate.toISOString().split("T")[0],
      tickersProcessed: universe.length,
      barsInserted: barResult.barsInserted,
      featuresComputed: featureResult.computed,
      scoresGenerated: scoreResult.scored,
      topScores: scoreResult.topScores.slice(0, 5),
      signal: signalResult,
      errors: {
        bars: barResult.errors.length,
        features: featureResult.errors.length,
        scores: scoreResult.errors.length,
      },
    };

    await completeJob(jobRun.id, "SUCCESS", summary);

    console.log(`\n[${new Date().toISOString()}] Daily evaluation complete`);
    console.log(`Summary: ${JSON.stringify(summary, null, 2)}`);
  } catch (error) {
    console.error("Daily job failed:", error);
    await completeJob(jobRun.id, "FAILED", null, error);
    throw error;
  }
}

async function checkMarketOpen(): Promise<boolean> {
  const today = new Date();
  const day = today.getDay();

  // Skip weekends (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) {
    return false;
  }

  // TODO: Add US market holiday calendar
  // Major holidays: New Year's Day, MLK Day, Presidents Day, Good Friday,
  // Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas

  return true;
}

function getAsOfDate(): Date {
  // For EOD data, use yesterday's date (or last trading day)
  const now = new Date();
  const asOf = new Date(now);

  // If it's before market close (4 PM ET), use previous day
  const etHour = now.getUTCHours() - 5; // Rough ET conversion
  if (etHour < 16) {
    asOf.setDate(asOf.getDate() - 1);
  }

  // Skip weekends
  const day = asOf.getDay();
  if (day === 0) asOf.setDate(asOf.getDate() - 2); // Sunday -> Friday
  if (day === 6) asOf.setDate(asOf.getDate() - 1); // Saturday -> Friday

  // Normalize to midnight
  asOf.setHours(0, 0, 0, 0);

  return asOf;
}

async function generateSignalIfHolding(
  asOfDate: Date,
  topScores: { symbol: string; score: number }[]
): Promise<{
  hasHolding: boolean;
  sellSignal?: string;
  rotation?: string;
} | null> {
  // Check for current holding
  const portfolio = await prisma.portfolioState.findUnique({
    where: { id: 1 },
  });

  if (!portfolio?.currentSymbol || !portfolio.entryDate || !portfolio.entryPrice) {
    console.log("No current holding, skipping signal generation");
    return { hasHolding: false };
  }

  console.log(`Current holding: ${portfolio.currentSymbol} (entry: $${portfolio.entryPrice})`);

  // Get current price
  let currentPrice = portfolio.entryPrice; // Default to entry price
  try {
    const quotes = await fetchQuotes([portfolio.currentSymbol]);
    if (quotes.length > 0 && quotes[0]!.price) {
      currentPrice = quotes[0]!.price;
    }
  } catch (error) {
    console.warn("Could not fetch current price, using entry price:", error);
  }

  // Compute sell signal
  const sellSignal = await computeSellSignal(
    portfolio.currentSymbol,
    currentPrice,
    asOfDate
  );
  console.log(`Sell signal: ${sellSignal.sellSignalLevel} (asymmetry: ${sellSignal.asymmetry.toFixed(2)})`);

  // Find current holding's score
  const currentScore =
    topScores.find((s) => s.symbol === portfolio.currentSymbol)?.score ?? 0;

  // Find best candidate (excluding current holding)
  const bestCandidate = topScores.find((s) => s.symbol !== portfolio.currentSymbol);

  // Compute rotation recommendation
  const rotation = bestCandidate
    ? await computeRotationRecommendation(
        portfolio.currentSymbol,
        currentPrice,
        portfolio.entryDate,
        portfolio.entryPrice,
        bestCandidate,
        currentScore
      )
    : {
        recommendation: "HOLD" as const,
        reasons: ["No alternative candidates"],
        taxImpact: {
          holdingDays: 0,
          isLongTerm: false,
          estimatedGainPct: 0,
          estimatedTaxRate: 0,
          taxDragPct: 0,
          daysToLongTerm: 0,
          requiredEdgeToRotate: 0,
        },
      };

  console.log(`Rotation: ${rotation.recommendation}`);
  if (rotation.recommendation === "ROTATE" && rotation.rotateToSymbol) {
    console.log(`  -> Rotate to: ${rotation.rotateToSymbol}`);
  }

  // Persist signal
  await persistSignal(asOfDate, portfolio.currentSymbol, sellSignal, rotation);

  return {
    hasHolding: true,
    sellSignal: sellSignal.sellSignalLevel,
    rotation: rotation.recommendation,
  };
}

async function completeJob(
  jobId: string,
  status: "SUCCESS" | "FAILED",
  summary: object | null,
  error?: unknown
): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobId },
    data: {
      finishedAt: new Date(),
      status,
      summaryJson: summary ? JSON.parse(JSON.stringify(summary)) : undefined,
      errorJson: error ? { message: String(error) } : undefined,
    },
  });
}
