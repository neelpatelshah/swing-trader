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

interface UniverseManagerProps {
  tickers: TickerRow[];
}

export function UniverseManager({ tickers }: UniverseManagerProps) {
  const router = useRouter();
  const [newSymbol, setNewSymbol] = useState("");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const enabledTickers = tickers.filter((t) => t.enabled);

  const handleAdd = async () => {
    if (!newSymbol.trim()) return;

    setAdding(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/universe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase() }),
      });

      if (!response.ok) {
        throw new Error("Failed to add ticker");
      }

      setNewSymbol("");
      setMessage({ type: "success", text: `Added ${newSymbol.toUpperCase()}` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Failed to add ticker" });
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (symbol: string, currentEnabled: boolean) => {
    setToggling(symbol);
    setMessage(null);

    try {
      if (currentEnabled) {
        // Disable
        const response = await fetch(`/api/settings/universe?symbol=${symbol}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to disable");
      } else {
        // Enable
        const response = await fetch("/api/settings/universe", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (!response.ok) throw new Error("Failed to enable");
      }

      router.refresh();
    } catch {
      setMessage({ type: "error", text: `Failed to ${currentEnabled ? "disable" : "enable"} ${symbol}` });
    } finally {
      setToggling(null);
    }
  };

  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Universe</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
        Manage your ticker watchlist. {enabledTickers.length} tickers enabled.
      </p>

      {/* Add ticker form */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g., MSFT)"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          style={{ ...inputStyle, width: "200px" }}
        />
        <button onClick={handleAdd} disabled={adding || !newSymbol.trim()} style={primaryButtonStyle}>
          {adding ? "Adding..." : "Add Ticker"}
        </button>
        {message && (
          <span style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", fontSize: "0.875rem", alignSelf: "center" }}>
            {message.text}
          </span>
        )}
      </div>

      {/* Ticker list */}
      {tickers.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No tickers in universe. Add some to get started.</p>
      ) : (
        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Symbol</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Classification</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.symbol} style={{ opacity: t.enabled ? 1 : 0.5 }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: "bold", color: "var(--accent)" }}>{t.symbol}</span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.name || "-"}
                  </td>
                  <td style={tdStyle}>
                    <span style={getClassificationStyle(t.defenseClassification)}>
                      {t.defenseClassification.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => handleToggle(t.symbol, t.enabled)}
                      disabled={toggling === t.symbol}
                      style={{
                        ...toggleButtonStyle,
                        background: t.enabled ? "var(--success)" : "var(--border)",
                      }}
                    >
                      {toggling === t.symbol ? "..." : t.enabled ? "On" : "Off"}
                    </button>
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

function getClassificationStyle(classification: DefenseClassification): React.CSSProperties {
  const colors: Record<DefenseClassification, string> = {
    NON_DEFENSE: "var(--muted)",
    DEFENSE_SECONDARY: "var(--warning)",
    DEFENSE_PRIMARY: "var(--danger)",
  };
  return { fontSize: "0.75rem", color: colors[classification] };
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

const inputStyle: React.CSSProperties = {
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

const toggleButtonStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  border: "none",
  borderRadius: "4px",
  color: "#000",
  fontSize: "0.75rem",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "40px",
};
