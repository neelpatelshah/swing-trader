import { prisma } from "@/lib/prisma";
import { UniverseManager } from "./UniverseManager";
import { HoldingEditor } from "./HoldingEditor";
import { DefenseOverrides } from "./DefenseOverrides";
import { RunHistory } from "./RunHistory";
import type { DefenseClassification } from "@swing-trader/contracts";

export const dynamic = "force-dynamic";

interface TickerRow {
  symbol: string;
  name?: string;
  enabled: boolean;
  defenseClassification: DefenseClassification;
  manualOverride: boolean;
}

interface JobRunRow {
  id: string;
  runType: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  tickersProcessed?: number;
}

export default async function SettingsPage() {
  const [tickers, portfolio, jobRuns] = await Promise.all([
    prisma.ticker.findMany({
      orderBy: { symbol: "asc" },
    }),
    prisma.portfolioState.findFirst(),
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const tickerRows: TickerRow[] = tickers.map((t) => ({
    symbol: t.symbol,
    name: t.name || undefined,
    enabled: t.enabled,
    defenseClassification: t.defenseClassification as DefenseClassification,
    manualOverride: t.manualOverride,
  }));

  const portfolioData = portfolio
    ? {
        currentSymbol: portfolio.currentSymbol || "",
        entryDate: portfolio.entryDate?.toISOString().split("T")[0] || "",
        entryPrice: portfolio.entryPrice || 0,
        shares: portfolio.shares || 1,
      }
    : null;

  const jobRunRows: JobRunRow[] = jobRuns.map((r) => {
    const summary = r.summaryJson as { tickersProcessed?: number } | null;
    return {
      id: r.id,
      runType: r.runType,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString(),
      status: r.status,
      tickersProcessed: summary?.tickersProcessed,
    };
  });

  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Settings</h1>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <HoldingEditor initialData={portfolioData} />
        <UniverseManager tickers={tickerRows} />
        <DefenseOverrides tickers={tickerRows} />
        <RunHistory runs={jobRunRows} />
      </div>
    </main>
  );
}
