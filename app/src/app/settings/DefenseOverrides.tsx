"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DefenseClassification } from "@swing-trader/contracts";

interface TickerRow {
  symbol: string;
  name?: string;
  enabled: boolean;
  defenseClassification: DefenseClassification;
  manualOverride: boolean;
}

interface DefenseOverridesProps {
  tickers: TickerRow[];
}

export function DefenseOverrides({ tickers }: DefenseOverridesProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Only show enabled tickers that might need classification override
  const relevantTickers = tickers.filter((t) => t.enabled);

  const handleClassificationChange = async (symbol: string, newClassification: DefenseClassification) => {
    setUpdating(symbol);
    setMessage(null);

    try {
      const response = await fetch(`/api/settings/defense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, classification: newClassification }),
      });

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      setMessage({ type: "success", text: `Updated ${symbol}` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: `Failed to update ${symbol}` });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Defense Classifications</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
        Override defense classifications. DEFENSE_PRIMARY tickers are excluded from the leaderboard.
      </p>

      {message && (
        <div style={{ marginBottom: "1rem", color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: "0.875rem" }}>
          {message.text}
        </div>
      )}

      {relevantTickers.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No enabled tickers to configure.</p>
      ) : (
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Symbol</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Classification</th>
                <th style={thStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {relevantTickers.map((t) => (
                <tr key={t.symbol}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: "bold", color: "var(--accent)" }}>{t.symbol}</span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.name || "-"}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={t.defenseClassification}
                      onChange={(e) => handleClassificationChange(t.symbol, e.target.value as DefenseClassification)}
                      disabled={updating === t.symbol}
                      style={selectStyle}
                    >
                      <option value="NON_DEFENSE">Non-Defense</option>
                      <option value="DEFENSE_SECONDARY">Defense Secondary</option>
                      <option value="DEFENSE_PRIMARY">Defense Primary (Excluded)</option>
                    </select>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--muted)", fontSize: "0.75rem" }}>
                    {t.manualOverride ? "Manual" : "Auto"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.75rem",
  color: "var(--muted)",
  fontWeight: "normal",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.875rem",
};

const selectStyle: React.CSSProperties = {
  padding: "0.375rem 0.5rem",
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--foreground)",
  fontSize: "0.75rem",
  cursor: "pointer",
};
