import { prisma } from "../lib/prisma.js";

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
    const universe = await loadTradableUniverse();
    console.log(`Loaded ${universe.length} tradable tickers`);

    // 3. Fetch latest EOD bars (FMP)
    // TODO: Implement bar fetching
    console.log("TODO: Fetch EOD bars from FMP");

    // 4. Fetch SPY benchmark (FMP)
    // TODO: Implement benchmark fetching
    console.log("TODO: Fetch SPY benchmark from FMP");

    // 5. Fetch news since last run (FMP)
    // TODO: Implement news fetching
    console.log("TODO: Fetch news from FMP");

    // 6. Compute features
    // TODO: Implement feature computation
    console.log("TODO: Compute features");

    // 7. Score candidates
    // TODO: Implement scoring
    console.log("TODO: Score candidates");

    // 8. Generate signals (if holding exists)
    // TODO: Implement signal generation
    console.log("TODO: Generate signals");

    // Complete job
    await completeJob(jobRun.id, "SUCCESS", {
      tickersProcessed: universe.length,
    });

    console.log(`[${new Date().toISOString()}] Daily evaluation complete`);
  } catch (error) {
    console.error("Daily job failed:", error);
    await completeJob(jobRun.id, "FAILED", null, error);
    throw error;
  }
}

async function checkMarketOpen(): Promise<boolean> {
  const today = new Date();
  const day = today.getDay();
  // Simple check: skip weekends (0 = Sunday, 6 = Saturday)
  // TODO: Add holiday calendar
  return day !== 0 && day !== 6;
}

async function loadTradableUniverse(): Promise<{ symbol: string }[]> {
  return prisma.ticker.findMany({
    where: {
      enabled: true,
      defenseClassification: { not: "DEFENSE_PRIMARY" },
    },
    select: { symbol: true },
  });
}

async function completeJob(
  jobId: string,
  status: "SUCCESS" | "FAILED",
  summary: Record<string, unknown> | null,
  error?: unknown
): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobId },
    data: {
      finishedAt: new Date(),
      status,
      summaryJson: summary,
      errorJson: error ? { message: String(error) } : null,
    },
  });
}
