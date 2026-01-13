export default function SettingsPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Settings</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          Universe
        </h2>
        <p style={{ color: "var(--muted)" }}>
          Manage your ticker watchlist and screening criteria.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          Current Holding
        </h2>
        <p style={{ color: "var(--muted)" }}>
          Set your current position for signal generation.
        </p>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          Defense Exclusions
        </h2>
        <p style={{ color: "var(--muted)" }}>
          Override defense classifications for specific tickers.
        </p>
      </section>
    </main>
  );
}
