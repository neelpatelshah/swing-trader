import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TickerDetailResponse, DefenseClassification, Projection, ScoreExplain } from "@swing-trader/contracts";

interface RouteParams {
  params: Promise<{ symbol: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  try {
    // Get ticker info
    const ticker = await prisma.ticker.findUnique({
      where: { symbol: upperSymbol },
    });

    if (!ticker) {
      return NextResponse.json(
        { error: `Ticker ${upperSymbol} not found` },
        { status: 404 }
      );
    }

    // Get last 6 months of bars
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const bars = await prisma.dailyBar.findMany({
      where: {
        symbol: upperSymbol,
        date: { gte: sixMonthsAgo },
      },
      orderBy: { date: "asc" },
    });

    // Get latest features
    const latestFeature = await prisma.feature.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { date: "desc" },
    });

    // Get recent news with labels
    const news = await prisma.newsItem.findMany({
      where: { symbol: upperSymbol },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: { label: true },
    });

    // Get upcoming events
    const events = await prisma.event.findMany({
      where: {
        symbol: upperSymbol,
        eventDate: { gte: new Date() },
      },
      orderBy: { eventDate: "asc" },
      take: 5,
    });

    // Get latest score
    const latestScore = await prisma.score.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { asOfDate: "desc" },
    });

    const response: TickerDetailResponse = {
      symbol: upperSymbol,
      name: ticker.name || undefined,
      defenseClassification: ticker.defenseClassification as DefenseClassification,
      bars: bars.map((b) => ({
        date: b.date.toISOString().split("T")[0]!,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: Number(b.volume),
      })),
      features: latestFeature
        ? {
            sma20: latestFeature.sma20 || undefined,
            sma50: latestFeature.sma50 || undefined,
            sma200: latestFeature.sma200 || undefined,
            rsi14: latestFeature.rsi14 || undefined,
            atr14: latestFeature.atr14 || undefined,
            rsVsSpy: latestFeature.rsVsSpy || undefined,
            newsSentiment7d: latestFeature.newsSentiment7d || undefined,
            tailRiskScore14d: latestFeature.tailRiskScore14d || undefined,
          }
        : null,
      news: news.map((n) => ({
        id: n.id,
        publishedAt: n.publishedAt.toISOString(),
        title: n.title,
        source: n.source,
        direction: n.label?.direction || undefined,
        severity: n.label?.severity || undefined,
      })),
      events: events.map((e) => ({
        eventDate: e.eventDate.toISOString().split("T")[0]!,
        eventType: e.eventType,
      })),
      latestScore: latestScore
        ? {
            symbol: latestScore.symbol,
            asOfDate: latestScore.asOfDate.toISOString().split("T")[0]!,
            swingScore: latestScore.swingScore,
            projection: latestScore.projectionJson as unknown as Projection,
            explain: latestScore.explainJson as unknown as ScoreExplain,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching ticker detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker detail" },
      { status: 500 }
    );
  }
}
