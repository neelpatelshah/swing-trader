"use client";

interface JobRunRow {
  id: string;
  runType: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  tickersProcessed?: number;
}

interface RunHistoryProps {
  runs: JobRunRow[];
}

export function RunHistory({ runs }: RunHistoryProps) {
  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>Run History</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.875rem" }}>
        Recent worker job executions.
      </p>

      {runs.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No job runs recorded yet.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Started</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Tickers</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const startedAt = new Date(r.startedAt);
              const finishedAt = r.finishedAt ? new Date(r.finishedAt) : null;
              const duration = finishedAt
                ? Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
                : null;

              return (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.runType}</td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>
                    {formatDate(startedAt)}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--muted)" }}>
                    {duration !== null ? `${duration}s` : "-"}
                  </td>
                  <td style={tdStyle}>
                    <span style={getStatusStyle(r.status)}>{r.status}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {r.tickersProcessed !== undefined ? r.tickersProcessed : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    SUCCESS: { bg: "var(--success)", text: "#000" },
    RUNNING: { bg: "var(--accent)", text: "#fff" },
    FAILED: { bg: "var(--danger)", text: "#fff" },
  };
  const config = colors[status] || { bg: "var(--border)", text: "var(--foreground)" };

  return {
    padding: "0.125rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    background: config.bg,
    color: config.text,
  };
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
