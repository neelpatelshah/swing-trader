"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface HoldingEditorProps {
  initialData: {
    currentSymbol: string;
    entryDate: string;
    entryPrice: number;
    shares: number;
  } | null;
}

export function HoldingEditor({ initialData }: HoldingEditorProps) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(initialData?.currentSymbol || "");
  const [entryDate, setEntryDate] = useState(initialData?.entryDate || "");
  const [entryPrice, setEntryPrice] = useState(initialData?.entryPrice?.toString() || "");
  const [shares, setShares] = useState(initialData?.shares?.toString() || "1");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (!symbol || !entryDate || !entryPrice) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSymbol: symbol.toUpperCase(),
          entryDate,
          entryPrice: parseFloat(entryPrice),
          shares: parseFloat(shares) || 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setMessage({ type: "success", text: "Holding saved successfully" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Failed to save holding" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/portfolio", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear");
      }

      setSymbol("");
      setEntryDate("");
      setEntryPrice("");
      setShares("1");
      setMessage({ type: "success", text: "Holding cleared" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Failed to clear holding" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Current Holding</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
        Set your current position for signal generation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Symbol *</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Entry Date *</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Entry Price *</label>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            placeholder="150.00"
            step="0.01"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Shares</label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="100"
            step="1"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving..." : "Save Holding"}
        </button>
        <button onClick={handleClear} disabled={saving} style={secondaryButtonStyle}>
          Clear Holding
        </button>
        {message && (
          <span style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: "0.875rem" }}>
            {message.text}
          </span>
        )}
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "1.125rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--foreground)",
  fontSize: "0.875rem",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "var(--accent)",
  border: "none",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--foreground)",
  fontSize: "0.875rem",
  cursor: "pointer",
};
