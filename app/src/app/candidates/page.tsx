export default function CandidatesPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Candidate Leaderboard
      </h1>
      <p style={{ color: "var(--muted)" }}>
        No scores available yet. Run the daily evaluation to populate candidates.
      </p>
    </main>
  );
}
