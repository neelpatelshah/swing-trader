import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UpdateUniverseRequest } from "@swing-trader/contracts";

export async function POST(request: Request) {
  try {
    const body: UpdateUniverseRequest = await request.json();

    if (!body.symbols || !Array.isArray(body.symbols)) {
      return NextResponse.json(
        { error: "Missing required field: symbols (array)" },
        { status: 400 }
      );
    }

    const symbols = body.symbols.map((s) => s.toUpperCase());

    // Disable all tickers first
    await prisma.ticker.updateMany({
      data: { enabled: false },
    });

    // Enable the specified symbols (create if they don't exist)
    for (const symbol of symbols) {
      await prisma.ticker.upsert({
        where: { symbol },
        update: { enabled: true },
        create: { symbol, enabled: true },
      });
    }

    // Return updated list
    const tickers = await prisma.ticker.findMany({
      where: { enabled: true },
      orderBy: { symbol: "asc" },
      select: { symbol: true, name: true, enabled: true },
    });

    return NextResponse.json({
      success: true,
      enabledCount: tickers.length,
      tickers: tickers.map((t) => t.symbol),
    });
  } catch (error) {
    console.error("Error updating universe:", error);
    return NextResponse.json(
      { error: "Failed to update universe" },
      { status: 500 }
    );
  }
}

// Add/enable a single ticker
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.symbol) {
      return NextResponse.json(
        { error: "Missing required field: symbol" },
        { status: 400 }
      );
    }

    const symbol = body.symbol.toUpperCase();

    const ticker = await prisma.ticker.upsert({
      where: { symbol },
      update: { enabled: true },
      create: { symbol, enabled: true },
    });

    return NextResponse.json({
      success: true,
      ticker: {
        symbol: ticker.symbol,
        name: ticker.name,
        enabled: ticker.enabled,
      },
    });
  } catch (error) {
    console.error("Error adding ticker:", error);
    return NextResponse.json(
      { error: "Failed to add ticker" },
      { status: 500 }
    );
  }
}

// Disable a ticker
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing required query param: symbol" },
        { status: 400 }
      );
    }

    const ticker = await prisma.ticker.update({
      where: { symbol },
      data: { enabled: false },
    });

    return NextResponse.json({
      success: true,
      ticker: {
        symbol: ticker.symbol,
        enabled: ticker.enabled,
      },
    });
  } catch (error) {
    console.error("Error disabling ticker:", error);
    return NextResponse.json(
      { error: "Failed to disable ticker" },
      { status: 500 }
    );
  }
}
