"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface CandidateRow {
  symbol: string;
  name?: string;
  swingScore: number;
  rsVsSpy?: number;
  atr14?: number;
  expectedMovePct: number;
  earningsWithin5d: boolean;
  topReasons: string[];
}

interface CandidatesTableProps {
  candidates: CandidateRow[];
}

type SortField = "symbol" | "swingScore" | "rsVsSpy" | "atr14" | "expectedMovePct";
type SortDir = "asc" | "desc";

export function CandidatesTable({ candidates }: CandidatesTableProps) {
  const [sortField, setSortField] = useState<SortField>("swingScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minScore, setMinScore] = useState(0);
  const [hideEarnings, setHideEarnings] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let result = [...candidates];

    // Apply filters
    if (minScore > 0) {
      result = result.filter((c) => c.swingScore >= minScore);
    }
    if (hideEarnings) {
      result = result.filter((c) => !c.earningsWithin5d);
    }

    // Apply sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "symbol":
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case "swingScore":
          aVal = a.swingScore;
          bVal = b.swingScore;
          break;
        case "rsVsSpy":
          aVal = a.rsVsSpy ?? -Infinity;
          bVal = b.rsVsSpy ?? -Infinity;
          break;
        case "atr14":
          aVal = a.atr14 ?? -Infinity;
          bVal = b.atr14 ?? -Infinity;
          break;
        case "expectedMovePct":
          aVal = a.expectedMovePct;
          bVal = b.expectedMovePct;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [candidates, sortField, sortDir, minScore, hideEarnings]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (field !== sortField) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div>
      {/* Filters */}
      <div style={filtersStyle}>
        <div style={filterGroupStyle}>
          <label style={filterLabelStyle}>
            Min Score: {minScore}
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: "150px" }}
          />
        </div>
        <div style={filterGroupStyle}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideEarnings}
              onChange={(e) => setHideEarnings(e.target.checked)}
            />
            <span style={filterLabelStyle}>Hide earnings within 5d</span>
          </label>
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          Showing {filteredAndSorted.length} of {candidates.length}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort("symbol")}>
                Symbol{getSortIndicator("symbol")}
              </th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("swingScore")}>
                Score{getSortIndicator("swingScore")}
              </th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("rsVsSpy")}>
                RS %{getSortIndicator("rsVsSpy")}
              </th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("atr14")}>
                ATR{getSortIndicator("atr14")}
              </th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("expectedMovePct")}>
                Projection{getSortIndicator("expectedMovePct")}
              </th>
              <th style={thStyle}>Earnings</th>
              <th style={thStyle}>Top Reasons</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((c) => (
              <tr key={c.symbol} style={rowStyle}>
                <td style={tdStyle}>
                  <Link href={`/ticker/${c.symbol}`} style={{ color: "var(--accent)", fontWeight: "bold" }}>
                    {c.symbol}
                  </Link>
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name || "-"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <span style={getScoreStyle(c.swingScore)}>{c.swingScore.toFixed(0)}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {c.rsVsSpy !== undefined ? `${c.rsVsSpy.toFixed(0)}%` : "-"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {c.atr14 !== undefined ? c.atr14.toFixed(2) : "-"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <span style={{ color: c.expectedMovePct >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {c.expectedMovePct >= 0 ? "+" : ""}{c.expectedMovePct.toFixed(1)}%
                  </span>
                </td>
                <td style={tdStyle}>
                  {c.earningsWithin5d ? (
                    <span style={{ color: "var(--warning)", fontSize: "0.75rem" }}>Within 5d</span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>-</span>
                  )}
                </td>
                <td style={{ ...tdStyle, maxWidth: "300px", fontSize: "0.75rem", color: "var(--muted)" }}>
                  {c.topReasons.slice(0, 2).join(", ") || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && (
        <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
          No candidates match the current filters.
        </p>
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

const filtersStyle: React.CSSProperties = {
  display: "flex",
  gap: "2rem",
  alignItems: "center",
  marginBottom: "1rem",
  padding: "1rem",
  background: "#111",
  borderRadius: "8px",
  border: "1px solid var(--border)",
};

const filterGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.75rem",
  color: "var(--muted)",
  fontWeight: "normal",
  cursor: "pointer",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.875rem",
};

const rowStyle: React.CSSProperties = {
  transition: "background 0.1s",
};
