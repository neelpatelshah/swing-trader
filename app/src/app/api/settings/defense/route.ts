import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DefenseClassification } from "@swing-trader/contracts";

const VALID_CLASSIFICATIONS: DefenseClassification[] = [
  "NON_DEFENSE",
  "DEFENSE_SECONDARY",
  "DEFENSE_PRIMARY",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.symbol || !body.classification) {
      return NextResponse.json(
        { error: "Missing required fields: symbol, classification" },
        { status: 400 }
      );
    }

    const symbol = body.symbol.toUpperCase();
    const classification = body.classification as DefenseClassification;

    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      return NextResponse.json(
        { error: "Invalid classification" },
        { status: 400 }
      );
    }

    const ticker = await prisma.ticker.update({
      where: { symbol },
      data: {
        defenseClassification: classification,
        manualOverride: true,
      },
    });

    return NextResponse.json({
      success: true,
      ticker: {
        symbol: ticker.symbol,
        defenseClassification: ticker.defenseClassification,
        manualOverride: ticker.manualOverride,
      },
    });
  } catch (error) {
    console.error("Error updating defense classification:", error);
    return NextResponse.json(
      { error: "Failed to update defense classification" },
      { status: 500 }
    );
  }
}
