import Link from "next/link";
import type { ScoreRow } from "@swing-trader/contracts";

interface TopCandidatesProps {
  scores: ScoreRow[];
  asOfDate: string;
}

export function TopCandidates({ scores, asOfDate }: TopCandidatesProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Top Candidates</h3>
        <Link href="/candidates" style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
          View All
        </Link>
      </div>

      {scores.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No scores available. Run the daily evaluation to generate candidates.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
            As of {asOfDate}
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Symbol</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Score</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Projection</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score) => (
                <tr key={score.symbol}>
                  <td style={tdStyle}>
                    <Link href={`/ticker/${score.symbol}`} style={{ color: "var(--accent)" }}>
                      {score.symbol}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <span style={getScoreStyle(score.swingScore)}>
                      {score.swingScore.toFixed(0)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <span style={{ color: score.projection.expectedMovePct >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {score.projection.expectedMovePct >= 0 ? "+" : ""}
                      {score.projection.expectedMovePct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function getScoreStyle(score: number): React.CSSProperties {
  let color = "var(--muted)";
  if (score >= 80) color = "var(--success)";
  else if (score >= 60) color = "var(--accent)";
  else if (score >= 40) color = "var(--warning)";

  return { fontWeight: "bold", color };
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.75rem",
  color: "var(--muted)",
  fontWeight: "normal",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.875rem",
};
