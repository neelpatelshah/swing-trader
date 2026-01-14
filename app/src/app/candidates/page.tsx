import { prisma } from "@/lib/prisma";
import { CandidatesTable } from "./CandidatesTable";
import type { Projection, ScoreExplain } from "@swing-trader/contracts";

export const dynamic = "force-dynamic";

interface CandidateRow {
  symbol: string;
  name?: string;
  swingScore: number;
  rsVsSpy?: number;
  atr14?: number;
  expectedMovePct: number;
  earningsWithin5d: boolean;
  topReasons: string[];
}

export default async function CandidatesPage() {
  // Get the latest score date
  const latestScore = await prisma.score.findFirst({
    orderBy: { asOfDate: "desc" },
    select: { asOfDate: true },
  });

  if (!latestScore) {
    return (
      <main style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          Candidate Leaderboard
        </h1>
        <p style={{ color: "var(--muted)" }}>
          No scores available yet. Run the daily evaluation to populate candidates.
        </p>
      </main>
    );
  }

  // Get all scores with ticker and feature data
  const scores = await prisma.score.findMany({
    where: {
      asOfDate: latestScore.asOfDate,
      ticker: { defenseClassification: { not: "DEFENSE_PRIMARY" } },
    },
    orderBy: { swingScore: "desc" },
    include: {
      ticker: {
        select: { name: true },
      },
    },
  });

  // Get features for each symbol
  const features = await prisma.feature.findMany({
    where: {
      symbol: { in: scores.map((s) => s.symbol) },
      date: latestScore.asOfDate,
    },
  });

  const featuresMap = new Map(features.map((f) => [f.symbol, f]));

  const candidates: CandidateRow[] = scores.map((s) => {
    const feature = featuresMap.get(s.symbol);
    const projection = s.projectionJson as unknown as Projection;
    const explain = s.explainJson as unknown as ScoreExplain;

    return {
      symbol: s.symbol,
      name: s.ticker.name || undefined,
      swingScore: s.swingScore,
      rsVsSpy: feature?.rsVsSpy || undefined,
      atr14: feature?.atr14 || undefined,
      expectedMovePct: projection.expectedMovePct,
      earningsWithin5d: feature?.earningsWithin5d || false,
      topReasons: explain.topReasons,
    };
  });

  return (
    <main style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Candidate Leaderboard
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        As of {latestScore.asOfDate.toISOString().split("T")[0]}
      </p>

      <CandidatesTable candidates={candidates} />
    </main>
  );
}
