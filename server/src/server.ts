import express from "express";
import cors from "cors";
import cron from "node-cron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router } from "./api/routes.js";
import { loadCache, refreshCache } from "./cacheStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

const webDist = path.join(__dirname, "..", "..", "web", "dist");
app.use(express.static(webDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) res.status(404).send("Run `npm run build` in web/ to serve the frontend, or use `npm run dev:web` in development.");
  });
});

async function start() {
  const cached = await loadCache();
  if (!cached) {
    console.log("No cache found; running initial scrape (this can take a minute)...");
    try {
      await refreshCache();
    } catch (err) {
      console.error("Initial scrape failed; server will still start with no data.", err);
    }
  }

  // The city updates these documents on an irregular, infrequent basis, so
  // twice a day is enough to stay current without hammering the site.
  cron.schedule("0 */12 * * *", () => {
    console.log("Running scheduled scrape refresh...");
    refreshCache().catch((err) => console.error("Scheduled refresh failed:", err));
  });

  app.listen(PORT, () => {
    console.log(`SDPoolTracker API listening on http://localhost:${PORT}`);
  });
}

start();
