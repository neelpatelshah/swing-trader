interface JobRun {
  id: string;
  runType: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  summaryJson: unknown;
}

interface RunStatusProps {
  lastRun: JobRun | null;
}

interface JobSummary {
  tickersProcessed?: number;
  scoresGenerated?: number;
  signalGenerated?: boolean;
}

export function RunStatus({ lastRun }: RunStatusProps) {
  if (!lastRun) {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Last Run</h3>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
          No job runs recorded yet. The worker has not executed.
        </p>
      </div>
    );
  }

  const statusColor = getStatusColor(lastRun.status);
  const duration = lastRun.finishedAt
    ? Math.round((new Date(lastRun.finishedAt).getTime() - new Date(lastRun.startedAt).getTime()) / 1000)
    : null;
  const summary = lastRun.summaryJson as JobSummary | null;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Last Run</h3>
        <span style={{ ...statusBadgeStyle, background: statusColor }}>
          {lastRun.status}
        </span>
      </div>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div>
          <span style={labelStyle}>Type</span>
          <span>{lastRun.runType}</span>
        </div>
        <div>
          <span style={labelStyle}>Started</span>
          <span>{formatDate(lastRun.startedAt)}</span>
        </div>
        {duration !== null && (
          <div>
            <span style={labelStyle}>Duration</span>
            <span>{duration}s</span>
          </div>
        )}
        {summary?.tickersProcessed !== undefined && (
          <div>
            <span style={labelStyle}>Tickers</span>
            <span>{summary.tickersProcessed}</span>
          </div>
        )}
        {summary?.scoresGenerated !== undefined && (
          <div>
            <span style={labelStyle}>Scores</span>
            <span>{summary.scoresGenerated}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "var(--success)";
    case "RUNNING":
      return "var(--accent)";
    case "FAILED":
      return "var(--danger)";
    default:
      return "var(--muted)";
  }
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "1.25rem",
};

const statusBadgeStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderRadius: "4px",
  fontSize: "0.75rem",
  fontWeight: "bold",
  color: "#000",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "var(--muted)",
  marginBottom: "0.25rem",
};
