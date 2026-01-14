import Link from "next/link";

interface HoldingCardProps {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  shares: number;
  currentPrice?: number;
}

export function HoldingCard({
  symbol,
  entryDate,
  entryPrice,
  shares,
  currentPrice,
}: HoldingCardProps) {
  const entryDateObj = new Date(entryDate);
  const today = new Date();
  const holdingDays = Math.floor(
    (today.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysToLongTerm = Math.max(0, 365 - holdingDays);
  const isLongTerm = holdingDays >= 365;

  const costBasis = entryPrice * shares;
  const currentValue = currentPrice ? currentPrice * shares : null;
  const pnlDollar = currentValue ? currentValue - costBasis : null;
  const pnlPercent = currentValue ? ((currentValue - costBasis) / costBasis) * 100 : null;

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Current Holding</h3>
        <Link href={`/ticker/${symbol}`} style={symbolLinkStyle}>
          {symbol}
        </Link>
      </div>

      <div style={gridStyle}>
        <div>
          <span style={labelStyle}>Entry Date</span>
          <span style={valueStyle}>{entryDate}</span>
        </div>
        <div>
          <span style={labelStyle}>Entry Price</span>
          <span style={valueStyle}>${entryPrice.toFixed(2)}</span>
        </div>
        <div>
          <span style={labelStyle}>Shares</span>
          <span style={valueStyle}>{shares}</span>
        </div>
        <div>
          <span style={labelStyle}>Cost Basis</span>
          <span style={valueStyle}>${costBasis.toFixed(2)}</span>
        </div>
      </div>

      {currentPrice && (
        <div style={{ ...gridStyle, marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <div>
            <span style={labelStyle}>Current Price</span>
            <span style={valueStyle}>${currentPrice.toFixed(2)}</span>
          </div>
          <div>
            <span style={labelStyle}>Current Value</span>
            <span style={valueStyle}>${currentValue?.toFixed(2)}</span>
          </div>
          <div>
            <span style={labelStyle}>P&L ($)</span>
            <span style={{ ...valueStyle, color: pnlDollar && pnlDollar >= 0 ? "var(--success)" : "var(--danger)" }}>
              {pnlDollar && pnlDollar >= 0 ? "+" : ""}${pnlDollar?.toFixed(2)}
            </span>
          </div>
          <div>
            <span style={labelStyle}>P&L (%)</span>
            <span style={{ ...valueStyle, color: pnlPercent && pnlPercent >= 0 ? "var(--success)" : "var(--danger)" }}>
              {pnlPercent && pnlPercent >= 0 ? "+" : ""}{pnlPercent?.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <div style={tagStyle}>
          {holdingDays} days held
        </div>
        <div style={{ ...tagStyle, background: isLongTerm ? "var(--success)" : "var(--warning)", color: "#000" }}>
          {isLongTerm ? "Long-term" : `${daysToLongTerm}d to LT`}
        </div>
      </div>
    </div>
  );
}

export function EmptyHoldingCard() {
  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Current Holding</h3>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        No position set. Go to{" "}
        <Link href="/settings" style={{ color: "var(--accent)" }}>
          Settings
        </Link>{" "}
        to configure your current holding.
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1rem",
};

const symbolLinkStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: "bold",
  color: "var(--accent)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "1rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};

const valueStyle: React.CSSProperties = {
  display: "block",
  fontSize: "1rem",
};

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.5rem",
  background: "var(--border)",
  borderRadius: "4px",
  fontSize: "0.75rem",
};
