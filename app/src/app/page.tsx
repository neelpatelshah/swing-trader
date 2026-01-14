import { prisma } from "@/lib/prisma";
import { HoldingCard, EmptyHoldingCard } from "@/components/HoldingCard";
import { SignalBanner, EmptySignalBanner } from "@/components/SignalBanner";
import { RotationCard } from "@/components/RotationCard";
import { TopCandidates } from "@/components/TopCandidates";
import { RunStatus } from "@/components/RunStatus";
import type { ScoreRow, Projection, ScoreExplain, SignalExplain, TaxImpact, SellSignalLevel } from "@swing-trader/contracts";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Fetch all data in parallel
  const [portfolio, latestSignal, lastRun] = await Promise.all([
    prisma.portfolioState.findFirst(),
    prisma.signal.findFirst({ orderBy: { asOfDate: "desc" } }),
    prisma.jobRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  // Get top scores if we have a signal date, otherwise get latest available
  let topScores: ScoreRow[] = [];
  let scoresAsOfDate = new Date().toISOString().split("T")[0]!;

  const latestScore = await prisma.score.findFirst({
    orderBy: { asOfDate: "desc" },
    select: { asOfDate: true },
  });

  if (latestScore) {
    const scores = await prisma.score.findMany({
      where: {
        asOfDate: latestScore.asOfDate,
        ticker: { defenseClassification: { not: "DEFENSE_PRIMARY" } },
      },
      orderBy: { swingScore: "desc" },
      take: 10,
    });

    scoresAsOfDate = latestScore.asOfDate.toISOString().split("T")[0]!;
    topScores = scores.map((s) => ({
      symbol: s.symbol,
      asOfDate: s.asOfDate.toISOString().split("T")[0]!,
      swingScore: s.swingScore,
      projection: s.projectionJson as unknown as Projection,
      explain: s.explainJson as unknown as ScoreExplain,
    }));
  }

  // Get current price for holding if we have one
  let currentPrice: number | undefined;
  if (portfolio?.currentSymbol) {
    const latestBar = await prisma.dailyBar.findFirst({
      where: { symbol: portfolio.currentSymbol },
      orderBy: { date: "desc" },
    });
    currentPrice = latestBar?.close;
  }

  // Get scores for rotation comparison
  let currentScore: number | undefined;
  let targetScore: number | undefined;
  if (latestSignal?.currentSymbol && latestScore) {
    const currentScoreRow = await prisma.score.findUnique({
      where: {
        symbol_asOfDate: {
          symbol: latestSignal.currentSymbol,
          asOfDate: latestScore.asOfDate,
        },
      },
    });
    currentScore = currentScoreRow?.swingScore;

    if (latestSignal.rotateToSymbol) {
      const targetScoreRow = await prisma.score.findUnique({
        where: {
          symbol_asOfDate: {
            symbol: latestSignal.rotateToSymbol,
            asOfDate: latestScore.asOfDate,
          },
        },
      });
      targetScore = targetScoreRow?.swingScore;
    }
  }

  const hasHolding = portfolio?.currentSymbol && portfolio?.entryDate && portfolio?.entryPrice;
  const entryDateStr = portfolio?.entryDate?.toISOString().split("T")[0] ?? "";

  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>
        Swing Trader Dashboard
      </h1>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        {/* Holding Section */}
        {hasHolding ? (
          <HoldingCard
            symbol={portfolio.currentSymbol!}
            entryDate={entryDateStr}
            entryPrice={portfolio.entryPrice!}
            shares={portfolio.shares || 1}
            currentPrice={currentPrice}
          />
        ) : (
          <EmptyHoldingCard />
        )}

        {/* Signal Section */}
        {latestSignal ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <SignalBanner
              level={latestSignal.sellSignalLevel as SellSignalLevel}
              explain={latestSignal.explainJson as unknown as SignalExplain}
            />
            <RotationCard
              recommendation={latestSignal.rotateRecommendation as "HOLD" | "ROTATE"}
              currentSymbol={latestSignal.currentSymbol}
              rotateToSymbol={latestSignal.rotateToSymbol || undefined}
              currentScore={currentScore}
              targetScore={targetScore}
              taxImpact={latestSignal.taxImpactJson as unknown as TaxImpact | undefined}
            />
          </div>
        ) : (
          <EmptySignalBanner />
        )}

        {/* Top Candidates and Run Status */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          <TopCandidates scores={topScores} asOfDate={scoresAsOfDate} />
          <RunStatus lastRun={lastRun} />
        </div>
      </div>
    </main>
  );
}
