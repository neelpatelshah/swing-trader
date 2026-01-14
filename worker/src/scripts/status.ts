/**
 * Quick status check for database
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkStatus() {
  const tickerCount = await prisma.ticker.count();
  const enabledTickers = await prisma.ticker.count({ where: { enabled: true } });
  const barCount = await prisma.dailyBar.count();
  const featureCount = await prisma.feature.count();
  const scoreCount = await prisma.score.count();

  console.log("=== Database Status ===");
  console.log("Tickers (total):", tickerCount);
  console.log("Tickers (enabled):", enabledTickers);
  console.log("Daily Bars:", barCount);
  console.log("Features:", featureCount);
  console.log("Scores:", scoreCount);

  // Check which tickers have bars
  const tickersWithBars = await prisma.dailyBar.groupBy({
    by: ["symbol"],
    _count: { symbol: true },
  });

  console.log("\nTickers with bars:", tickersWithBars.length);
  console.log("Bar counts by symbol:");
  tickersWithBars.forEach((t) => console.log(`  ${t.symbol}: ${t._count.symbol}`));

  await prisma.$disconnect();
}

checkStatus().catch((e) => {
  console.error(e);
  process.exit(1);
});
