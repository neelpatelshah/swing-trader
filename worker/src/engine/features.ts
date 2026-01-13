import { prisma } from "../lib/prisma.js";

interface Bar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

interface ComputedFeatures {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  atr14: number | null;
  rsVsSpy: number | null;
}

export async function computeFeatures(
  symbol: string,
  asOfDate: Date
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

  return {
    sma20: computeSMA(chronoBars, 20),
    sma50: bars.length >= 50 ? computeSMA(chronoBars, 50) : null,
    sma200: bars.length >= 200 ? computeSMA(chronoBars, 200) : null,
    rsi14: computeRSI(chronoBars, 14),
    atr14: computeATR(chronoBars, 14),
    rsVsSpy: null, // TODO: Implement relative strength vs SPY
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
