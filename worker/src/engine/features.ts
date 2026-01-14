import { prisma } from "../lib/prisma.js";

interface Bar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

export interface ComputedFeatures {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  atr14: number | null;
  rsVsSpy: number | null;
}

// Lookback period for relative strength calculation
const RS_LOOKBACK_DAYS = 20;

export async function computeFeatures(
  symbol: string,
  asOfDate: Date,
  spyBars?: Bar[]
): Promise<ComputedFeatures> {
  // Fetch last 200 bars for this symbol
  const bars = await prisma.dailyBar.findMany({
    where: {
      symbol,
      date: { lte: asOfDate },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  if (bars.length < 20) {
    return {
      sma20: null,
      sma50: null,
      sma200: null,
      rsi14: null,
      atr14: null,
      rsVsSpy: null,
    };
  }

  // Reverse to chronological order for calculations
  const chronoBars = bars.reverse();

  // Calculate relative strength vs SPY
  let rsVsSpy: number | null = null;
  if (spyBars && spyBars.length >= RS_LOOKBACK_DAYS && chronoBars.length >= RS_LOOKBACK_DAYS) {
    rsVsSpy = computeRelativeStrength(chronoBars, spyBars, RS_LOOKBACK_DAYS);
  }

  return {
    sma20: computeSMA(chronoBars, 20),
    sma50: bars.length >= 50 ? computeSMA(chronoBars, 50) : null,
    sma200: bars.length >= 200 ? computeSMA(chronoBars, 200) : null,
    rsi14: computeRSI(chronoBars, 14),
    atr14: computeATR(chronoBars, 14),
    rsVsSpy,
  };
}

function computeSMA(bars: Bar[], period: number): number | null {
  if (bars.length < period) return null;

  const recentBars = bars.slice(-period);
  const sum = recentBars.reduce((acc, bar) => acc + bar.close, 0);
  return sum / period;
}

function computeRSI(bars: Bar[], period: number): number | null {
  if (bars.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    changes.push(bars[i]!.close - bars[i - 1]!.close);
  }

  const recentChanges = changes.slice(-period);
  let gains = 0;
  let losses = 0;

  for (const change of recentChanges) {
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeATR(bars: Bar[], period: number): number | null {
  if (bars.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const current = bars[i]!;
    const prev = bars[i - 1]!;

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRanges.push(tr);
  }

  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((a, b) => a + b, 0) / period;
}

export async function persistFeatures(
  symbol: string,
  date: Date,
  features: ComputedFeatures
): Promise<void> {
  await prisma.feature.upsert({
    where: {
      symbol_date: { symbol, date },
    },
    update: features,
    create: {
      symbol,
      date,
      ...features,
    },
  });
}

function computeRelativeStrength(
  stockBars: Bar[],
  spyBars: Bar[],
  lookback: number
): number {
  // Calculate returns over lookback period
  const stockRecent = stockBars.slice(-lookback);
  const spyRecent = spyBars.slice(-lookback);

  if (stockRecent.length < lookback || spyRecent.length < lookback) {
    return 50; // Default to median
  }

  const stockReturn =
    (stockRecent[stockRecent.length - 1]!.close - stockRecent[0]!.close) /
    stockRecent[0]!.close;
  const spyReturn =
    (spyRecent[spyRecent.length - 1]!.close - spyRecent[0]!.close) /
    spyRecent[0]!.close;

  // Relative strength ratio
  const rsRatio = spyReturn !== 0 ? stockReturn / spyReturn : 1;

  // Convert to percentile-like score (0-100)
  // rsRatio of 1.0 = 50, 1.5 = ~75, 0.5 = ~25
  const percentile = Math.min(100, Math.max(0, 50 + (rsRatio - 1) * 50));

  return Math.round(percentile * 100) / 100;
}

export async function computeFeaturesForUniverse(
  symbols: string[],
  asOfDate: Date
): Promise<{ computed: number; errors: string[] }> {
  let computed = 0;
  const errors: string[] = [];

  // Fetch SPY bars once for all calculations
  const spyBars = await prisma.dailyBar.findMany({
    where: {
      symbol: "SPY",
      date: { lte: asOfDate },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  const spyBarsChronological = spyBars.reverse();

  // First pass: compute features for all symbols
  const allFeatures: Map<string, ComputedFeatures> = new Map();
  const stockReturns: { symbol: string; return20d: number }[] = [];

  for (const symbol of symbols) {
    try {
      const features = await computeFeatures(symbol, asOfDate, spyBarsChronological);
      allFeatures.set(symbol, features);

      // Calculate 20-day return for percentile ranking
      const bars = await prisma.dailyBar.findMany({
        where: { symbol, date: { lte: asOfDate } },
        orderBy: { date: "desc" },
        take: RS_LOOKBACK_DAYS + 1,
      });

      if (bars.length >= RS_LOOKBACK_DAYS) {
        const chronoBars = bars.reverse();
        const return20d =
          (chronoBars[chronoBars.length - 1]!.close - chronoBars[0]!.close) /
          chronoBars[0]!.close;
        stockReturns.push({ symbol, return20d });
      }
    } catch (error) {
      errors.push(`${symbol}: ${String(error)}`);
    }
  }

  // Calculate SPY return for the same period
  let spyReturn20d = 0;
  if (spyBarsChronological.length >= RS_LOOKBACK_DAYS) {
    const spyRecent = spyBarsChronological.slice(-RS_LOOKBACK_DAYS);
    spyReturn20d =
      (spyRecent[spyRecent.length - 1]!.close - spyRecent[0]!.close) /
      spyRecent[0]!.close;
  }

  // Second pass: compute relative strength percentile across universe
  if (stockReturns.length > 0) {
    // Calculate RS ratio for each stock
    const rsRatios = stockReturns.map((s) => ({
      symbol: s.symbol,
      rsRatio: spyReturn20d !== 0 ? s.return20d / spyReturn20d : 1,
    }));

    // Sort by RS ratio to get percentiles
    rsRatios.sort((a, b) => a.rsRatio - b.rsRatio);

    // Assign percentile based on rank
    for (let i = 0; i < rsRatios.length; i++) {
      const { symbol } = rsRatios[i]!;
      const percentile = Math.round((i / (rsRatios.length - 1)) * 100);

      const features = allFeatures.get(symbol);
      if (features) {
        features.rsVsSpy = percentile;
      }
    }
  }

  // Third pass: persist all features
  for (const [symbol, features] of allFeatures) {
    try {
      await persistFeatures(symbol, asOfDate, features);
      computed++;
    } catch (error) {
      errors.push(`${symbol} (persist): ${String(error)}`);
    }
  }

  console.log(`Features computed: ${computed}/${symbols.length}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }

  return { computed, errors };
}
