export interface TaxImpact {
  holdingDays: number;
  isLongTerm: boolean;
  estimatedGainPct: number;
  estimatedTaxRate: number;
  taxDragPct: number;
  daysToLongTerm: number;
  requiredEdgeToRotate: number;
}

// Approximate tax rates
const SHORT_TERM_TAX_RATE = 0.37; // Top marginal rate
const LONG_TERM_TAX_RATE = 0.15; // Typical long-term rate
const TRANSACTION_BUFFER = 0.02; // 2% for slippage + commissions

export function calculateTaxDrag(
  entryDate: Date,
  entryPrice: number,
  currentPrice: number
): TaxImpact {
  const now = new Date();
  const holdingDays = Math.floor(
    (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isLongTerm = holdingDays >= 365;
  const daysToLongTerm = Math.max(0, 365 - holdingDays);

  const gainPct = (currentPrice - entryPrice) / entryPrice;

  // If at a loss, no tax drag (could even be a benefit via tax loss harvesting)
  if (gainPct <= 0) {
    return {
      holdingDays,
      isLongTerm,
      estimatedGainPct: gainPct,
      estimatedTaxRate: 0,
      taxDragPct: 0,
      daysToLongTerm,
      requiredEdgeToRotate: TRANSACTION_BUFFER,
    };
  }

  const taxRate = isLongTerm ? LONG_TERM_TAX_RATE : SHORT_TERM_TAX_RATE;
  const taxDragPct = gainPct * taxRate;

  // If close to long-term status, add a holding bonus
  let requiredEdge = taxDragPct + TRANSACTION_BUFFER;

  // Incentivize holding if within 30 days of long-term status
  if (!isLongTerm && daysToLongTerm <= 30 && gainPct > 0.1) {
    // Add extra threshold to encourage waiting for long-term rates
    const potentialSavings = gainPct * (SHORT_TERM_TAX_RATE - LONG_TERM_TAX_RATE);
    requiredEdge += potentialSavings * 0.5; // Weight potential savings
  }

  return {
    holdingDays,
    isLongTerm,
    estimatedGainPct: Math.round(gainPct * 10000) / 10000,
    estimatedTaxRate: taxRate,
    taxDragPct: Math.round(taxDragPct * 10000) / 10000,
    daysToLongTerm,
    requiredEdgeToRotate: Math.round(requiredEdge * 10000) / 10000,
  };
}

export function formatTaxImpact(impact: TaxImpact): string {
  if (impact.estimatedGainPct <= 0) {
    return `Position at ${(impact.estimatedGainPct * 100).toFixed(1)}% - no tax drag`;
  }

  const lines = [
    `Gain: ${(impact.estimatedGainPct * 100).toFixed(1)}%`,
    `Status: ${impact.isLongTerm ? "Long-term" : "Short-term"} (${impact.holdingDays} days)`,
    `Est. tax rate: ${(impact.estimatedTaxRate * 100).toFixed(0)}%`,
    `Tax drag: ${(impact.taxDragPct * 100).toFixed(1)}%`,
  ];

  if (!impact.isLongTerm && impact.daysToLongTerm <= 60) {
    lines.push(`Days to long-term: ${impact.daysToLongTerm}`);
  }

  lines.push(`Min edge to rotate: ${(impact.requiredEdgeToRotate * 100).toFixed(1)}%`);

  return lines.join("\n");
}

/**
 * Determine if we should wait for long-term capital gains status.
 *
 * Returns true if:
 * 1. Position is short-term with meaningful gains
 * 2. Close to long-term status (within 60 days)
 * 3. Best candidate edge doesn't exceed tax savings threshold
 *
 * @param impact - Current tax impact of the position
 * @param bestCandidateEdge - Expected edge (%) of the best rotation candidate
 */
export function shouldWaitForLongTerm(
  impact: TaxImpact,
  bestCandidateEdge: number
): boolean {
  // Already long-term, no need to wait
  if (impact.isLongTerm) {
    return false;
  }

  // No gains, no tax benefit to waiting
  if (impact.estimatedGainPct <= 0) {
    return false;
  }

  // Calculate potential tax savings from waiting
  const potentialSavings =
    impact.estimatedGainPct * (SHORT_TERM_TAX_RATE - LONG_TERM_TAX_RATE);

  // If very close to long-term (within 30 days), use a higher threshold
  if (impact.daysToLongTerm <= 30) {
    // Wait unless candidate edge is significantly better than tax savings
    return bestCandidateEdge < potentialSavings * 1.5 + TRANSACTION_BUFFER;
  }

  // If moderately close (30-60 days), use a moderate threshold
  if (impact.daysToLongTerm <= 60) {
    // Wait if candidate edge doesn't exceed 2x the tax savings
    return bestCandidateEdge < potentialSavings * 2.0 + TRANSACTION_BUFFER;
  }

  // More than 60 days away - don't factor in long-term timing
  return false;
}
