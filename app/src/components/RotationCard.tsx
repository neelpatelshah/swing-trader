import Link from "next/link";
import type { TaxImpact } from "@swing-trader/contracts";

interface RotationCardProps {
  recommendation: "HOLD" | "ROTATE";
  currentSymbol: string;
  rotateToSymbol?: string;
  currentScore?: number;
  targetScore?: number;
  taxImpact?: TaxImpact;
}

export function RotationCard({
  recommendation,
  currentSymbol,
  rotateToSymbol,
  currentScore,
  targetScore,
  taxImpact,
}: RotationCardProps) {
  const isRotate = recommendation === "ROTATE";

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Rotation</h3>
        <div
          style={{
            ...badgeStyle,
            background: isRotate ? "var(--accent)" : "var(--success)",
          }}
        >
          {recommendation}
        </div>
      </div>

      {isRotate && rotateToSymbol ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ color: "var(--muted)" }}>{currentSymbol}</span>
            <span style={{ color: "var(--muted)" }}>→</span>
            <Link href={`/ticker/${rotateToSymbol}`} style={{ color: "var(--accent)", fontWeight: "bold" }}>
              {rotateToSymbol}
            </Link>
          </div>

          {currentScore !== undefined && targetScore !== undefined && (
            <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem" }}>
              <div>
                <span style={labelStyle}>Current Score</span>
                <span>{currentScore.toFixed(0)}</span>
              </div>
              <div>
                <span style={labelStyle}>Target Score</span>
                <span style={{ color: "var(--success)" }}>{targetScore.toFixed(0)}</span>
              </div>
              <div>
                <span style={labelStyle}>Score Edge</span>
                <span style={{ color: "var(--success)" }}>+{(targetScore - currentScore).toFixed(0)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Current position is optimal. No rotation recommended.
        </p>
      )}

      {taxImpact && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem" }}>
          <span style={{ ...labelStyle, marginBottom: "0.5rem" }}>Tax Impact</span>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <span style={labelStyle}>Tax Drag</span>
              <span style={{ color: "var(--danger)" }}>{(taxImpact.taxDragPct * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span style={labelStyle}>Required Edge</span>
              <span>{(taxImpact.requiredEdgeToRotate * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span style={labelStyle}>Tax Status</span>
              <span style={{ color: taxImpact.isLongTerm ? "var(--success)" : "var(--warning)" }}>
                {taxImpact.isLongTerm ? "Long-term" : "Short-term"}
              </span>
            </div>
            {!taxImpact.isLongTerm && taxImpact.daysToLongTerm > 0 && (
              <div>
                <span style={labelStyle}>Days to LT</span>
                <span>{taxImpact.daysToLongTerm}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const badgeStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  fontWeight: "bold",
  fontSize: "0.75rem",
  color: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};
