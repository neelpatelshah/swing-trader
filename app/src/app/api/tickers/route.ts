import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TickersResponse, DefenseClassification } from "@swing-trader/contracts";

export async function GET() {
  try {
    const tickers = await prisma.ticker.findMany({
      orderBy: { symbol: "asc" },
      select: {
        symbol: true,
        name: true,
        enabled: true,
        defenseClassification: true,
        screenPassed: true,
      },
    });

    return NextResponse.json({
      tickers: tickers.map((t) => ({
        symbol: t.symbol,
        name: t.name || undefined,
        enabled: t.enabled,
        defenseClassification: t.defenseClassification as DefenseClassification,
        screenPassed: t.screenPassed,
      })),
    } satisfies TickersResponse);
  } catch (error) {
    console.error("Error fetching tickers:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickers" },
      { status: 500 }
    );
  }
}
