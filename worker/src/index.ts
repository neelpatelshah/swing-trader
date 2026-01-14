import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (parent of worker/)
config({ path: resolve(__dirname, "../../.env") });
import { createServer } from "http";
import { runDailyJob } from "./cron/daily.js";

const PORT = process.env.PORT || 3001;

// Simple HTTP server for health checks
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  if (req.url === "/trigger" && req.method === "POST") {
    const secret = req.headers["x-cron-secret"];
    if (secret !== process.env.CRON_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Trigger job asynchronously
    runDailyJob().catch(console.error);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "triggered" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Worker server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Schedule daily job (runs at 4:05 PM ET / 21:05 UTC on weekdays)
// For Railway, we'll use their cron feature or an internal scheduler
// For now, the /trigger endpoint allows manual and cron-triggered runs

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
