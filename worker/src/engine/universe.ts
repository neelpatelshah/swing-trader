import { prisma } from "../lib/prisma.js";

export interface ScreenCriteria {
  minAvgVolume20d: number;
  minMarketCap: number;
  priceAboveSMA50: boolean;
  priceAboveSMA200: boolean;
  rsVsSpyPercentile: number;
}

const DEFAULT_SCREEN_CRITERIA: ScreenCriteria = {
  minAvgVolume20d: 500_000,
  minMarketCap: 1_000_000_000,
  priceAboveSMA50: true,
  priceAboveSMA200: true,
  rsVsSpyPercentile: 50,
};

export async function getTradableUniverse(): Promise<string[]> {
  const tickers = await prisma.ticker.findMany({
    where: {
      enabled: true,
      defenseClassification: { not: "DEFENSE_PRIMARY" },
    },
    select: { symbol: true },
  });

  return tickers.map((t) => t.symbol);
}

export async function runMomentumScreen(
  criteria: ScreenCriteria = DEFAULT_SCREEN_CRITERIA
): Promise<string[]> {
  // TODO: Implement full momentum screen
  // This requires features to be computed first
  console.log("Running momentum screen with criteria:", criteria);

  const tickers = await prisma.ticker.findMany({
    where: {
      enabled: true,
      defenseClassification: { not: "DEFENSE_PRIMARY" },
    },
    select: { symbol: true },
  });

  // For now, return all non-defense tickers
  // Full implementation will filter by computed features
  return tickers.map((t) => t.symbol);
}

export async function addTickerToUniverse(
  symbol: string,
  classification: "NON_DEFENSE" | "DEFENSE_SECONDARY" = "NON_DEFENSE"
): Promise<void> {
  await prisma.ticker.upsert({
    where: { symbol },
    update: { enabled: true },
    create: {
      symbol,
      enabled: true,
      defenseClassification: classification,
    },
  });
}

export async function excludeDefenseTicker(symbol: string): Promise<void> {
  await prisma.ticker.upsert({
    where: { symbol },
    update: {
      defenseClassification: "DEFENSE_PRIMARY",
      manualOverride: true,
    },
    create: {
      symbol,
      enabled: true,
      defenseClassification: "DEFENSE_PRIMARY",
      manualOverride: true,
    },
  });
}

export async function seedInitialUniverse(
  symbols: string[],
  classification: "NON_DEFENSE" | "DEFENSE_SECONDARY" = "NON_DEFENSE"
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const symbol of symbols) {
    const existing = await prisma.ticker.findUnique({
      where: { symbol },
      select: { defenseClassification: true },
    });

    // Skip if already marked as DEFENSE_PRIMARY (manually excluded)
    if (existing?.defenseClassification === "DEFENSE_PRIMARY") {
      console.log(`Skipping ${symbol} - marked as DEFENSE_PRIMARY`);
      skipped++;
      continue;
    }

    await prisma.ticker.upsert({
      where: { symbol },
      update: {
        enabled: true,
        defenseClassification: existing?.defenseClassification ?? classification,
      },
      create: {
        symbol,
        enabled: true,
        defenseClassification: classification,
      },
    });
    added++;
  }

  console.log(`Seeded universe: ${added} added, ${skipped} skipped`);
  return { added, skipped };
}

export async function getFullUniverse(): Promise<string[]> {
  const tickers = await prisma.ticker.findMany({
    where: { enabled: true },
    select: { symbol: true },
  });
  return tickers.map((t) => t.symbol);
}
