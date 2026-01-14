import type { SellSignalLevel, SignalExplain } from "@swing-trader/contracts";

interface SignalBannerProps {
  level: SellSignalLevel;
  explain: SignalExplain;
}

const SIGNAL_COLORS: Record<SellSignalLevel, { bg: string; text: string; label: string }> = {
  NONE: { bg: "#166534", text: "#fff", label: "No Signal" },
  WATCH: { bg: "#ca8a04", text: "#000", label: "Watch" },
  SELL: { bg: "#ea580c", text: "#fff", label: "Sell" },
  STRONG_SELL: { bg: "#dc2626", text: "#fff", label: "Strong Sell" },
};

export function SignalBanner({ level, explain }: SignalBannerProps) {
  const config = SIGNAL_COLORS[level];

  return (
    <div style={bannerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          style={{
            ...badgeStyle,
            background: config.bg,
            color: config.text,
          }}
        >
          {config.label}
        </div>
        <div>
          <span style={labelStyle}>Asymmetry Ratio</span>
          <span style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
            {explain.asymmetry.toFixed(2)}
          </span>
        </div>
      </div>

      {explain.reasons.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <span style={labelStyle}>Reasons</span>
          <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
            {explain.reasons.map((reason, i) => (
              <li key={i} style={{ color: "var(--foreground)", marginBottom: "0.25rem" }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "flex", gap: "2rem" }}>
        <div>
          <span style={labelStyle}>Upside Remaining</span>
          <span style={{ color: "var(--success)" }}>
            +{explain.upsideRemainingPct.toFixed(1)}%
          </span>
        </div>
        <div>
          <span style={labelStyle}>Downside Tail Risk</span>
          <span style={{ color: "var(--danger)" }}>
            -{explain.downsideTailPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function EmptySignalBanner() {
  return (
    <div style={bannerStyle}>
      <h3 style={{ margin: 0, fontSize: "1rem" }}>Sell Signal</h3>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        No signal generated. Set a holding first to generate signals.
      </p>
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const badgeStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  fontWeight: "bold",
  fontSize: "0.875rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};
