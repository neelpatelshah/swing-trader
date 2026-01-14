import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalResponse, SignalRow, SignalExplain, TaxImpact, SellSignalLevel } from "@swing-trader/contracts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("asOf");

  try {
    // If no date specified, get the most recent signal
    let signal;
    if (asOf) {
      signal = await prisma.signal.findUnique({
        where: { asOfDate: new Date(asOf) },
      });
    } else {
      signal = await prisma.signal.findFirst({
        orderBy: { asOfDate: "desc" },
      });
    }

    const today = new Date().toISOString().split("T")[0]!;

    if (!signal) {
      return NextResponse.json({
        asOfDate: asOf || today,
        row: null,
      } satisfies SignalResponse);
    }

    const signalDate = signal.asOfDate.toISOString().split("T")[0]!;

    const row: SignalRow = {
      asOfDate: signalDate,
      currentSymbol: signal.currentSymbol,
      sellSignalLevel: signal.sellSignalLevel as SellSignalLevel,
      rotateRecommendation: signal.rotateRecommendation as "HOLD" | "ROTATE",
      rotateToSymbol: signal.rotateToSymbol || undefined,
      explain: signal.explainJson as unknown as SignalExplain,
      taxImpact: signal.taxImpactJson as unknown as TaxImpact | undefined,
    };

    return NextResponse.json({
      asOfDate: signalDate,
      row,
    } satisfies SignalResponse);
  } catch (error) {
    console.error("Error fetching signal:", error);
    return NextResponse.json(
      { error: "Failed to fetch signal" },
      { status: 500 }
    );
  }
}
