// ============================================
// SHARED TYPES FOR SWING TRADER
// ============================================

// Run types
export type RunType = "DAILY" | "MANUAL";

// Defense classification
export type DefenseClassification =
  | "DEFENSE_PRIMARY"
  | "DEFENSE_SECONDARY"
  | "NON_DEFENSE";

// ============================================
// SCORING TYPES
// ============================================

export interface Projection {
  horizonDays: number;
  expectedMovePct: number;
  expectedRangePct: [number, number];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  notes: string[];
}

export interface ScoreExplain {
  components: Record<string, number>;
  topReasons: string[];
  warnings: string[];
}

export interface ScoreRow {
  symbol: string;
  asOfDate: string; // YYYY-MM-DD
  swingScore: number; // 0-100
  projection: Projection;
  explain: ScoreExplain;
}

// ============================================
// SIGNAL TYPES
// ============================================

export type SellSignalLevel = "NONE" | "WATCH" | "SELL" | "STRONG_SELL";

export interface TaxImpact {
  holdingDays: number;
  isLongTerm: boolean; // >= 365 days
  estimatedGainPct: number;
  estimatedTaxRate: number; // 0.15 long-term, 0.37 short-term (approx)
  taxDragPct: number; // gainPct * taxRate
  daysToLongTerm: number; // 0 if already long-term
  requiredEdgeToRotate: number; // taxDrag + transaction buffer
}

export interface SignalExplain {
  asymmetry: number;
  upsideRemainingPct: number;
  downsideTailPct: number;
  reasons: string[];
}

export interface SignalRow {
  asOfDate: string;
  currentSymbol: string;
  sellSignalLevel: SellSignalLevel;
  rotateRecommendation: "HOLD" | "ROTATE";
  rotateToSymbol?: string;
  explain: SignalExplain;
  taxImpact?: TaxImpact;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ScoresResponse {
  asOfDate: string;
  rows: ScoreRow[];
}

export interface SignalResponse {
  asOfDate: string;
  row: SignalRow | null;
}

export interface TickerDetailResponse {
  symbol: string;
  name?: string;
  defenseClassification: DefenseClassification;
  bars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  features: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    atr14?: number;
    rsVsSpy?: number;
    newsSentiment7d?: number;
    tailRiskScore14d?: number;
  } | null;
  news: Array<{
    id: string;
    publishedAt: string;
    title: string;
    source: string;
    direction?: string;
    severity?: number;
  }>;
  events: Array<{
    eventDate: string;
    eventType: string;
  }>;
  latestScore: ScoreRow | null;
}

export interface PortfolioResponse {
  currentSymbol: string | null;
  entryDate: string | null;
  entryPrice: number | null;
  shares: number | null;
}

export interface TickersResponse {
  tickers: Array<{
    symbol: string;
    name?: string;
    enabled: boolean;
    defenseClassification: DefenseClassification;
  }>;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface UpdatePortfolioRequest {
  currentSymbol: string;
  entryDate: string; // YYYY-MM-DD
  entryPrice: number;
  shares?: number;
}

export interface UpdateUniverseRequest {
  symbols: string[];
}

// ============================================
// SCREENING TYPES
// ============================================

export interface ScreenCriteria {
  minAvgVolume20d: number;
  minMarketCap: number;
  priceAboveSMA50: boolean;
  priceAboveSMA200: boolean;
  rsVsSpyPercentile: number;
}

export const DEFAULT_SCREEN_CRITERIA: ScreenCriteria = {
  minAvgVolume20d: 500_000,
  minMarketCap: 1_000_000_000,
  priceAboveSMA50: true,
  priceAboveSMA200: true,
  rsVsSpyPercentile: 50,
};

// ============================================
// SCORING CONFIG
// ============================================

export interface ScoringWeights {
  trend: number;
  relativeStrength: number;
  volatility: number;
  drawdownRisk: number;
  liquidity: number;
  catalyst: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  trend: 30,
  relativeStrength: 20,
  volatility: 15,
  drawdownRisk: 15,
  liquidity: 10,
  catalyst: 10,
};

// ============================================
// SIGNAL THRESHOLDS
// ============================================

export interface SignalThresholds {
  asymmetryNone: number;
  asymmetryWatch: number;
  asymmetrySell: number;
  rotateThreshold: number;
}

export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  asymmetryNone: 2.0,
  asymmetryWatch: 1.2,
  asymmetrySell: 0.8,
  rotateThreshold: 8,
};
