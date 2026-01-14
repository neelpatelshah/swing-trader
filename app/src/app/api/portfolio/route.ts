import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PortfolioResponse, UpdatePortfolioRequest } from "@swing-trader/contracts";

export async function GET() {
  try {
    const portfolio = await prisma.portfolioState.findFirst();

    return NextResponse.json({
      currentSymbol: portfolio?.currentSymbol || null,
      entryDate: portfolio?.entryDate?.toISOString().split("T")[0] || null,
      entryPrice: portfolio?.entryPrice || null,
      shares: portfolio?.shares || null,
    } satisfies PortfolioResponse);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: UpdatePortfolioRequest = await request.json();

    // Validate required fields
    if (!body.currentSymbol || !body.entryDate || body.entryPrice === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: currentSymbol, entryDate, entryPrice" },
        { status: 400 }
      );
    }

    // Upsert the portfolio state (singleton with id=1)
    const portfolio = await prisma.portfolioState.upsert({
      where: { id: 1 },
      update: {
        currentSymbol: body.currentSymbol.toUpperCase(),
        entryDate: new Date(body.entryDate),
        entryPrice: body.entryPrice,
        shares: body.shares || 1,
      },
      create: {
        id: 1,
        currentSymbol: body.currentSymbol.toUpperCase(),
        entryDate: new Date(body.entryDate),
        entryPrice: body.entryPrice,
        shares: body.shares || 1,
      },
    });

    return NextResponse.json({
      currentSymbol: portfolio.currentSymbol,
      entryDate: portfolio.entryDate?.toISOString().split("T")[0] || null,
      entryPrice: portfolio.entryPrice,
      shares: portfolio.shares,
    } satisfies PortfolioResponse);
  } catch (error) {
    console.error("Error updating portfolio:", error);
    return NextResponse.json(
      { error: "Failed to update portfolio" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.portfolioState.update({
      where: { id: 1 },
      data: {
        currentSymbol: null,
        entryDate: null,
        entryPrice: null,
        shares: null,
      },
    });

    return NextResponse.json({
      currentSymbol: null,
      entryDate: null,
      entryPrice: null,
      shares: null,
    } satisfies PortfolioResponse);
  } catch (error) {
    console.error("Error clearing portfolio:", error);
    return NextResponse.json(
      { error: "Failed to clear portfolio" },
      { status: 500 }
    );
  }
}
