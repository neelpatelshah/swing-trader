import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PriceChart } from "./PriceChart";
import type { Projection, ScoreExplain, DefenseClassification } from "@swing-trader/contracts";

export const dynamic = "force-dynamic";

interface TickerPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function TickerPage({ params }: TickerPageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  // Fetch ticker
  const ticker = await prisma.ticker.findUnique({
    where: { symbol: upperSymbol },
  });

  if (!ticker) {
    notFound();
  }

  const isDefensePrimary = ticker.defenseClassification === "DEFENSE_PRIMARY";

  // Fetch data in parallel
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [bars, latestFeature, news, events, latestScore] = await Promise.all([
    prisma.dailyBar.findMany({
      where: { symbol: upperSymbol, date: { gte: sixMonthsAgo } },
      orderBy: { date: "asc" },
    }),
    prisma.feature.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { date: "desc" },
    }),
    prisma.newsItem.findMany({
      where: { symbol: upperSymbol },
      orderBy: { publishedAt: "desc" },
      take: 15,
      include: { label: true },
    }),
    prisma.event.findMany({
      where: { symbol: upperSymbol, eventDate: { gte: new Date() } },
      orderBy: { eventDate: "asc" },
      take: 5,
    }),
    prisma.score.findFirst({
      where: { symbol: upperSymbol },
      orderBy: { asOfDate: "desc" },
    }),
  ]);

  const chartData = bars.map((b) => ({
    date: b.date.toISOString().split("T")[0]!,
    close: b.close,
    high: b.high,
    low: b.low,
  }));

  const projection = latestScore?.projectionJson as unknown as Projection | undefined;
  const explain = latestScore?.explainJson as unknown as ScoreExplain | undefined;

  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <Link href="/candidates" style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
            ← Back
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>{upperSymbol}</h1>
          {ticker.name && (
            <span style={{ color: "var(--muted)", fontSize: "1rem" }}>{ticker.name}</span>
          )}
          <DefenseBadge classification={ticker.defenseClassification as DefenseClassification} />
        </div>
      </div>

      {isDefensePrimary && (
        <div style={warningBannerStyle}>
          This ticker is classified as DEFENSE_PRIMARY and is excluded from scoring and recommendations.
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem" }}>
        {/* Price Chart */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Price (6 Months)</h2>
          {chartData.length > 0 ? (
            <PriceChart data={chartData} />
          ) : (
            <p style={{ color: "var(--muted)" }}>No price data available.</p>
          )}
        </section>

        {/* Features and Score */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Feature Grid */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Technical Indicators</h2>
            {latestFeature ? (
              <div style={featureGridStyle}>
                <FeatureItem label="SMA20" value={latestFeature.sma20?.toFixed(2)} />
                <FeatureItem label="SMA50" value={latestFeature.sma50?.toFixed(2)} />
                <FeatureItem label="SMA200" value={latestFeature.sma200?.toFixed(2)} />
                <FeatureItem label="RSI14" value={latestFeature.rsi14?.toFixed(1)} highlight={getRsiHighlight(latestFeature.rsi14)} />
                <FeatureItem label="ATR14" value={latestFeature.atr14?.toFixed(2)} />
                <FeatureItem label="RS vs SPY" value={latestFeature.rsVsSpy ? `${latestFeature.rsVsSpy.toFixed(0)}%` : undefined} />
                <FeatureItem label="News Sentiment (7d)" value={latestFeature.newsSentiment7d?.toFixed(2)} />
                <FeatureItem label="Tail Risk (14d)" value={latestFeature.tailRiskScore14d?.toFixed(2)} />
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>No feature data available. Run the worker to compute features.</p>
            )}
          </section>

          {/* Score Breakdown */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Score Breakdown</h2>
            {latestScore && explain ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: "bold", color: getScoreColor(latestScore.swingScore) }}>
                    {latestScore.swingScore.toFixed(0)}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                    as of {latestScore.asOfDate.toISOString().split("T")[0]}
                  </span>
                </div>

                {/* Component bars */}
                <div style={{ marginBottom: "1rem" }}>
                  {Object.entries(explain.components).map(([name, value]) => (
                    <div key={name} style={{ marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                        <span style={{ textTransform: "capitalize" }}>{name}</span>
                        <span>{value.toFixed(1)}</span>
                      </div>
                      <div style={{ background: "var(--border)", height: "6px", borderRadius: "3px" }}>
                        <div style={{ background: "var(--accent)", height: "100%", width: `${Math.min(100, value)}%`, borderRadius: "3px" }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reasons */}
                {explain.topReasons.length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <span style={labelStyle}>Top Reasons</span>
                    <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.875rem" }}>
                      {explain.topReasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {explain.warnings.length > 0 && (
                  <div>
                    <span style={{ ...labelStyle, color: "var(--warning)" }}>Warnings</span>
                    <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.875rem", color: "var(--warning)" }}>
                      {explain.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "var(--muted)" }}>No score available. Run the daily evaluation to generate scores.</p>
            )}
          </section>
        </div>

        {/* Projection and Events */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Projection */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Projection</h2>
            {projection ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <span style={labelStyle}>Expected Move</span>
                  <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: projection.expectedMovePct >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {projection.expectedMovePct >= 0 ? "+" : ""}{projection.expectedMovePct.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span style={labelStyle}>Horizon</span>
                  <span style={{ fontSize: "1.25rem" }}>{projection.horizonDays} days</span>
                </div>
                <div>
                  <span style={labelStyle}>Expected Range</span>
                  <span>
                    {projection.expectedRangePct[0].toFixed(1)}% to {projection.expectedRangePct[1].toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span style={labelStyle}>Confidence</span>
                  <span style={{ color: getConfidenceColor(projection.confidence) }}>{projection.confidence}</span>
                </div>
                {projection.notes.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={labelStyle}>Notes</span>
                    <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                      {projection.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>No projection available.</p>
            )}
          </section>

          {/* Events */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Upcoming Events</h2>
            {events.length > 0 ? (
              <div>
                {events.map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={getEventStyle(e.eventType)}>{e.eventType}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                      {e.eventDate.toISOString().split("T")[0]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)" }}>No upcoming events scheduled.</p>
            )}
          </section>
        </div>

        {/* News */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Recent News</h2>
          {news.length > 0 ? (
            <div>
              {news.map((n) => (
                <div key={n.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                    {n.label?.direction && (
                      <span style={getDirectionStyle(n.label.direction)}>
                        {n.label.direction}
                      </span>
                    )}
                    <span style={{ fontSize: "0.875rem" }}>{n.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                    <span>{n.source}</span>
                    <span>{formatDate(n.publishedAt)}</span>
                    {n.label?.severity !== undefined && n.label.severity > 0 && (
                      <span>Severity: {n.label.severity}/3</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>No recent news available.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function DefenseBadge({ classification }: { classification: DefenseClassification }) {
  if (classification === "NON_DEFENSE") return null;

  const isPrimary = classification === "DEFENSE_PRIMARY";
  return (
    <span style={{
      padding: "0.25rem 0.5rem",
      borderRadius: "4px",
      fontSize: "0.75rem",
      fontWeight: "bold",
      background: isPrimary ? "var(--danger)" : "var(--warning)",
      color: isPrimary ? "#fff" : "#000",
    }}>
      {isPrimary ? "Excluded" : "Defense"}
    </span>
  );
}

function FeatureItem({ label, value, highlight }: { label: string; value?: string; highlight?: string }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: highlight || "var(--foreground)" }}>{value || "-"}</span>
    </div>
  );
}

function getRsiHighlight(rsi?: number | null): string | undefined {
  if (!rsi) return undefined;
  if (rsi >= 70) return "var(--danger)";
  if (rsi <= 30) return "var(--success)";
  return undefined;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--accent)";
  if (score >= 40) return "var(--warning)";
  return "var(--muted)";
}

function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case "HIGH": return "var(--success)";
    case "MEDIUM": return "var(--warning)";
    default: return "var(--muted)";
  }
}

function getEventStyle(eventType: string): React.CSSProperties {
  const colors: Record<string, string> = {
    EARNINGS: "var(--warning)",
    DIVIDEND: "var(--success)",
    SPLIT: "var(--accent)",
  };
  return { fontWeight: "bold", color: colors[eventType] || "var(--foreground)" };
}

function getDirectionStyle(direction: string): React.CSSProperties {
  const colorMap: Record<string, { bg: string; text: string }> = {
    POSITIVE: { bg: "var(--success)", text: "#000" },
    NEGATIVE: { bg: "var(--danger)", text: "#fff" },
    NEUTRAL: { bg: "var(--border)", text: "var(--foreground)" },
  };
  const config = colorMap[direction] ?? { bg: "var(--border)", text: "var(--foreground)" };
  return {
    padding: "0.125rem 0.375rem",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: "bold",
    background: config.bg,
    color: config.text,
  };
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "1rem",
  fontWeight: "normal",
  color: "var(--muted)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "1rem",
};

const warningBannerStyle: React.CSSProperties = {
  padding: "1rem",
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid var(--danger)",
  borderRadius: "8px",
  marginBottom: "1.5rem",
  color: "var(--danger)",
};
