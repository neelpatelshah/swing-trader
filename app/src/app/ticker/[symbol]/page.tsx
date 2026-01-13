interface TickerPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function TickerPage({ params }: TickerPageProps) {
  const { symbol } = await params;

  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        {symbol.toUpperCase()}
      </h1>
      <p style={{ color: "var(--muted)" }}>
        Ticker detail view. Data will appear after the worker fetches bars and
        computes features.
      </p>
    </main>
  );
}
