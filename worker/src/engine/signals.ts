import { prisma } from "../lib/prisma.js";
import { calculateTaxDrag, type TaxImpact } from "../tax/rotation-cost.js";

export type SellSignalLevel = "NONE" | "WATCH" | "SELL" | "STRONG_SELL";

interface SignalResult {
  sellSignalLevel: SellSignalLevel;
  asymmetry: number;
  upsideRemainingPct: number;
  downsideTailPct: number;
  reasons: string[];
}

// Thresholds (to be backtested)
const ASYMMETRY_THRESHOLDS = {
  NONE: 2.0,
  WATCH: 1.2,
  SELL: 0.8,
};

export async function computeSellSignal(
  symbol: string,
  currentPrice: number,
  asOfDate: Date
): Promise<SignalResult> {
  const reasons: string[] = [];

  // Get features for tail risk assessment
  const features = await prisma.feature.findFirst({
    where: { symbol, date: { lte: asOfDate } },
    orderBy: { date: "desc" },
  });

  // Compute upside remaining (ATR-based runway)
  const atr = features?.atr14 || currentPrice * 0.02; // Default 2% if no ATR
  const upsideRemainingPct = (atr * 3) / currentPrice; // ~3 ATR upside runway

  // Compute downside tail risk
  let downsideTailPct = (atr * 2) / currentPrice; // Base: 2 ATR downside

  // Add semantic tail risk if available
  if (features?.tailRiskScore14d && features.tailRiskScore14d > 0) {
    downsideTailPct *= 1 + features.tailRiskScore14d * 0.1;
    reasons.push(`Elevated tail risk from news (${features.tailRiskScore14d.toFixed(1)})`);
  }

  // Add earnings gap risk
  if (features?.earningsWithin5d) {
    downsideTailPct *= 1.5;
    reasons.push("Earnings within 5 days - elevated gap risk");
  } else if (features?.earningsWithin10d) {
    downsideTailPct *= 1.2;
    reasons.push("Earnings within 10 days");
  }

  // Compute asymmetry
  const asymmetry = downsideTailPct > 0 ? upsideRemainingPct / downsideTailPct : 10;

  // Map to signal level
  let sellSignalLevel: SellSignalLevel;
  if (asymmetry > ASYMMETRY_THRESHOLDS.NONE) {
    sellSignalLevel = "NONE";
    reasons.push(`Favorable risk/reward (${asymmetry.toFixed(2)} asymmetry)`);
  } else if (asymmetry > ASYMMETRY_THRESHOLDS.WATCH) {
    sellSignalLevel = "WATCH";
    reasons.push(`Risk/reward narrowing (${asymmetry.toFixed(2)} asymmetry)`);
  } else if (asymmetry > ASYMMETRY_THRESHOLDS.SELL) {
    sellSignalLevel = "SELL";
    reasons.push(`Unfavorable risk/reward (${asymmetry.toFixed(2)} asymmetry)`);
  } else {
    sellSignalLevel = "STRONG_SELL";
    reasons.push(`Poor risk/reward (${asymmetry.toFixed(2)} asymmetry)`);
  }

  return {
    sellSignalLevel,
    asymmetry,
    upsideRemainingPct: Math.round(upsideRemainingPct * 10000) / 100, // as percentage
    downsideTailPct: Math.round(downsideTailPct * 10000) / 100,
    reasons,
  };
}

export async function computeRotationRecommendation(
  currentSymbol: string,
  currentPrice: number,
  entryDate: Date,
  entryPrice: number,
  bestCandidate: { symbol: string; score: number },
  currentScore: number,
  rotateThreshold = 8
): Promise<{
  recommendation: "HOLD" | "ROTATE";
  rotateToSymbol?: string;
  reasons: string[];
  taxImpact: TaxImpact;
}> {
  const reasons: string[] = [];

  // Calculate tax drag
  const taxImpact = calculateTaxDrag(entryDate, entryPrice, currentPrice);

  // Adjust threshold based on tax impact
  const effectiveThreshold = rotateThreshold + taxImpact.requiredEdgeToRotate * 100;

  const scoreDiff = bestCandidate.score - currentScore;

  if (scoreDiff >= effectiveThreshold) {
    reasons.push(
      `${bestCandidate.symbol} scores ${scoreDiff.toFixed(1)} points higher`
    );
    if (taxImpact.taxDragPct > 0) {
      reasons.push(
        `Tax cost of ${(taxImpact.taxDragPct * 100).toFixed(1)}% factored in`
      );
    }
    if (taxImpact.daysToLongTerm > 0 && taxImpact.daysToLongTerm < 30) {
      reasons.push(
        `Note: ${taxImpact.daysToLongTerm} days until long-term status`
      );
    }

    return {
      recommendation: "ROTATE",
      rotateToSymbol: bestCandidate.symbol,
      reasons,
      taxImpact,
    };
  }

  // Hold reasons
  if (scoreDiff > 0) {
    reasons.push(
      `${bestCandidate.symbol} only ${scoreDiff.toFixed(1)} points higher (need ${effectiveThreshold.toFixed(1)})`
    );
  } else {
    reasons.push(`Current holding ${currentSymbol} remains top candidate`);
  }

  if (taxImpact.daysToLongTerm > 0 && taxImpact.daysToLongTerm < 30) {
    reasons.push(
      `Holding for long-term status in ${taxImpact.daysToLongTerm} days`
    );
  }

  return {
    recommendation: "HOLD",
    reasons,
    taxImpact,
  };
}

export async function persistSignal(
  asOfDate: Date,
  currentSymbol: string,
  sellSignal: SignalResult,
  rotation: {
    recommendation: "HOLD" | "ROTATE";
    rotateToSymbol?: string;
    reasons: string[];
    taxImpact: TaxImpact;
  }
): Promise<void> {
  await prisma.signal.upsert({
    where: { asOfDate },
    update: {
      currentSymbol,
      sellSignalLevel: sellSignal.sellSignalLevel,
      rotateRecommendation: rotation.recommendation,
      rotateToSymbol: rotation.rotateToSymbol,
      explainJson: {
        asymmetry: sellSignal.asymmetry,
        upsideRemainingPct: sellSignal.upsideRemainingPct,
        downsideTailPct: sellSignal.downsideTailPct,
        reasons: [...sellSignal.reasons, ...rotation.reasons],
      },
      taxImpactJson: rotation.taxImpact,
    },
    create: {
      asOfDate,
      currentSymbol,
      sellSignalLevel: sellSignal.sellSignalLevel,
      rotateRecommendation: rotation.recommendation,
      rotateToSymbol: rotation.rotateToSymbol,
      explainJson: {
        asymmetry: sellSignal.asymmetry,
        upsideRemainingPct: sellSignal.upsideRemainingPct,
        downsideTailPct: sellSignal.downsideTailPct,
        reasons: [...sellSignal.reasons, ...rotation.reasons],
      },
      taxImpactJson: rotation.taxImpact,
    },
  });
}
