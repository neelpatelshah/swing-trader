export default function Dashboard() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Swing Trader Dashboard
      </h1>
      <p style={{ color: "var(--muted)" }}>
        System initializing. Configure your environment variables and run the
        worker to begin.
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          Setup Checklist
        </h2>
        <ul style={{ color: "var(--muted)", paddingLeft: "1.5rem" }}>
          <li>DATABASE_URL configured</li>
          <li>TIINGO_TOKEN configured</li>
          <li>FMP_APIKEY configured</li>
          <li>Worker running on Railway</li>
        </ul>
      </section>
    </main>
  );
}
