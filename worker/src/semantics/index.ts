// News normalization and ingestion
export {
  fetchAndNormalizeNews,
  deduplicateNews,
  persistNews,
  ingestNews,
  type NormalizedNews,
} from "./normalize.js";

// Heuristic labeling
export {
  labelNewsHeuristic,
  labelNewsItemsBatch,
  labelAllUnlabeled,
  getItemsNeedingLLM,
  persistLabel,
  type NewsLabel,
  type SentimentDirection,
} from "./label.js";

// LLM labeling
export {
  labelNewsWithLLM,
  labelNewsWithLLMBatch,
  processLowConfidenceItems,
} from "./llm.js";

// Semantic aggregation
export {
  computeSemanticFeatures,
  computeSemanticFeaturesForUniverse,
  type SemanticFeatures,
} from "./aggregate.js";

// Earnings calendar
export {
  fetchAndPersistEarnings,
  getUpcomingEarnings,
  hasEarningsWithin,
  refreshEarningsCalendar,
} from "./earnings.js";

// Tax functions (re-exported for convenience)
export {
  calculateTaxDrag,
  formatTaxImpact,
  shouldWaitForLongTerm,
  type TaxImpact,
} from "../tax/rotation-cost.js";
