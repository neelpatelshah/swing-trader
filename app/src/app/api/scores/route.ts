import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ScoresResponse, ScoreRow, Projection, ScoreExplain } from "@swing-trader/contracts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("asOf");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    // If no date specified, get the most recent date with scores
    let targetDate: Date;
    if (asOf) {
      targetDate = new Date(asOf);
    } else {
      const latestScore = await prisma.score.findFirst({
        orderBy: { asOfDate: "desc" },
        select: { asOfDate: true },
      });
      if (!latestScore) {
        const today = new Date().toISOString().split("T")[0];
        return NextResponse.json({
          asOfDate: today!,
          rows: [],
        } satisfies ScoresResponse);
      }
      targetDate = latestScore.asOfDate;
    }

    // Get scores for the target date, excluding DEFENSE_PRIMARY tickers
    const scores = await prisma.score.findMany({
      where: {
        asOfDate: targetDate,
        ticker: {
          defenseClassification: { not: "DEFENSE_PRIMARY" },
        },
      },
      orderBy: { swingScore: "desc" },
      take: limit,
      include: {
        ticker: {
          select: { name: true, defenseClassification: true },
        },
      },
    });

    const rows: ScoreRow[] = scores.map((s) => ({
      symbol: s.symbol,
      asOfDate: s.asOfDate.toISOString().split("T")[0]!,
      swingScore: s.swingScore,
      projection: s.projectionJson as unknown as Projection,
      explain: s.explainJson as unknown as ScoreExplain,
    }));

    return NextResponse.json({
      asOfDate: targetDate.toISOString().split("T")[0]!,
      rows,
    } satisfies ScoresResponse);
  } catch (error) {
    console.error("Error fetching scores:", error);
    return NextResponse.json(
      { error: "Failed to fetch scores" },
      { status: 500 }
    );
  }
}
