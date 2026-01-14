import pLimit from "p-limit";

// FMP migrated to /stable/ endpoints in 2025
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";
const FMP_V3_URL = "https://financialmodelingprep.com/api/v3"; // For endpoints not yet migrated
const limit = pLimit(10); // FMP Starter: 300 calls/min

// ============================================
// TYPES
// ============================================

export interface FMPBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}

export interface FMPNewsItem {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

export interface FMPEarningsEvent {
  date: string;
  symbol: string;
  eps: number | null;
  epsEstimated: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
}

export interface FMPCompanyProfile {
  symbol: string;
  companyName: string;
  currency: string;
  exchange: string;
  industry: string;
  sector: string;
  country: string;
  mktCap: number;
  price: number;
  volAvg: number;
  description: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
}

// ============================================
// HELPER
// ============================================

function getApiKey(): string {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY not configured");
  }
  return apiKey;
}

// ============================================
// EOD PRICE DATA
// ============================================

export async function fetchEODBars(
  symbol: string,
  from?: string,
  to?: string
): Promise<FMPBar[]> {
  return limit(async () => {
    const apiKey = getApiKey();

    // New stable endpoint: /stable/historical-price-eod/full
    const url = new URL(`${FMP_BASE_URL}/historical-price-eod/full`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", apiKey);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    // New format returns flat array, need to map to FMPBar format
    const data = (await response.json()) as Array<{
      symbol: string;
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      change: number;
      changePercent: number;
      vwap: number;
    }>;

    // Map to FMPBar format (adding missing fields with defaults)
    return data.map((bar) => ({
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      adjClose: bar.close, // Stable API doesn't return adjClose separately
      volume: bar.volume,
      unadjustedVolume: bar.volume,
      change: bar.change,
      changePercent: bar.changePercent,
      vwap: bar.vwap,
      label: bar.date,
      changeOverTime: 0,
    }));
  });
}

export async function fetchMultipleEODBars(
  symbols: string[],
  from?: string,
  to?: string
): Promise<Map<string, FMPBar[]>> {
  const results = new Map<string, FMPBar[]>();

  const fetches = symbols.map(async (symbol) => {
    try {
      const bars = await fetchEODBars(symbol, from, to);
      results.set(symbol, bars);
    } catch (error) {
      console.error(`Failed to fetch bars for ${symbol}:`, error);
      results.set(symbol, []);
    }
  });

  await Promise.all(fetches);
  return results;
}

// ============================================
// NEWS
// ============================================

export async function fetchStockNews(
  symbols: string[],
  limitCount = 50
): Promise<FMPNewsItem[]> {
  return limit(async () => {
    const apiKey = getApiKey();

    const url = new URL(`${FMP_BASE_URL}/stock_news`);
    url.searchParams.set("tickers", symbols.join(","));
    url.searchParams.set("limit", String(limitCount));
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<FMPNewsItem[]>;
  });
}

// ============================================
// EARNINGS CALENDAR
// ============================================

export async function fetchEarningsCalendar(
  from: string,
  to: string
): Promise<FMPEarningsEvent[]> {
  return limit(async () => {
    const apiKey = getApiKey();

    const url = new URL(`${FMP_BASE_URL}/earning_calendar`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<FMPEarningsEvent[]>;
  });
}

// ============================================
// COMPANY PROFILE
// ============================================

export async function fetchCompanyProfile(
  symbol: string
): Promise<FMPCompanyProfile | null> {
  return limit(async () => {
    const apiKey = getApiKey();

    const url = new URL(`${FMP_BASE_URL}/profile/${symbol}`);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const profile = Array.isArray(data) ? data[0] : data;
    return profile || null;
  });
}

export async function fetchMultipleProfiles(
  symbols: string[]
): Promise<Map<string, FMPCompanyProfile>> {
  const results = new Map<string, FMPCompanyProfile>();

  // FMP supports batch profile requests
  const batchSize = 50;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await limit(async () => {
      const apiKey = getApiKey();
      const url = new URL(`${FMP_BASE_URL}/profile/${batch.join(",")}`);
      url.searchParams.set("apikey", apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status}`);
      }
      return response.json() as Promise<FMPCompanyProfile[]>;
    });

    for (const profile of batchResults) {
      if (profile?.symbol) {
        results.set(profile.symbol, profile);
      }
    }
  }

  return results;
}

// ============================================
// SCREENING / STOCK LIST
// ============================================

export async function fetchStockScreener(params: {
  marketCapMoreThan?: number;
  marketCapLessThan?: number;
  volumeMoreThan?: number;
  sector?: string;
  industry?: string;
  exchange?: string;
  limit?: number;
}): Promise<FMPCompanyProfile[]> {
  return limit(async () => {
    const apiKey = getApiKey();

    const url = new URL(`${FMP_BASE_URL}/stock-screener`);
    url.searchParams.set("apikey", apiKey);

    if (params.marketCapMoreThan) {
      url.searchParams.set("marketCapMoreThan", String(params.marketCapMoreThan));
    }
    if (params.marketCapLessThan) {
      url.searchParams.set("marketCapLessThan", String(params.marketCapLessThan));
    }
    if (params.volumeMoreThan) {
      url.searchParams.set("volumeMoreThan", String(params.volumeMoreThan));
    }
    if (params.sector) {
      url.searchParams.set("sector", params.sector);
    }
    if (params.industry) {
      url.searchParams.set("industry", params.industry);
    }
    if (params.exchange) {
      url.searchParams.set("exchange", params.exchange);
    }
    if (params.limit) {
      url.searchParams.set("limit", String(params.limit));
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<FMPCompanyProfile[]>;
  });
}

// ============================================
// QUOTE (CURRENT PRICE)
// ============================================

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  volume: number;
  avgVolume: number;
  exchange: string;
  open: number;
  previousClose: number;
  timestamp: number;
}

export async function fetchQuotes(symbols: string[]): Promise<FMPQuote[]> {
  return limit(async () => {
    const apiKey = getApiKey();

    // New stable endpoint
    const url = new URL(`${FMP_BASE_URL}/quote`);
    url.searchParams.set("symbol", symbols.join(","));
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
    }

    // Map response to FMPQuote format (field name differences)
    const data = (await response.json()) as Array<{
      symbol: string;
      name: string;
      price: number;
      changePercentage: number;
      change: number;
      dayLow: number;
      dayHigh: number;
      yearHigh: number;
      yearLow: number;
      marketCap: number;
      priceAvg50: number;
      priceAvg200: number;
      volume: number;
      avgVolume?: number;
      exchange: string;
      open: number;
      previousClose: number;
      timestamp: number;
    }>;

    return data.map((q) => ({
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      changesPercentage: q.changePercentage,
      change: q.change,
      dayLow: q.dayLow,
      dayHigh: q.dayHigh,
      yearHigh: q.yearHigh,
      yearLow: q.yearLow,
      marketCap: q.marketCap,
      priceAvg50: q.priceAvg50,
      priceAvg200: q.priceAvg200,
      volume: q.volume,
      avgVolume: q.avgVolume ?? q.volume,
      exchange: q.exchange,
      open: q.open,
      previousClose: q.previousClose,
      timestamp: q.timestamp,
    }));
  });
}
