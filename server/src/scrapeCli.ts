import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScrape } from "./scraper/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", "data", "cache.json");
// The static frontend (deployed to GitHub Pages) has no backend to query,
// so it reads this file directly instead of calling the API.
const STATIC_DATA_PATH = path.join(__dirname, "..", "..", "web", "public", "data.json");

async function main() {
  console.log("Scraping sandiego.gov/pools ...");
  const result = await runScrape();
  const json = JSON.stringify(result, null, 2);

  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, json);
  console.log(`Scraped ${result.pools.length} pools -> ${CACHE_PATH}`);

  await mkdir(path.dirname(STATIC_DATA_PATH), { recursive: true });
  await writeFile(STATIC_DATA_PATH, json);
  console.log(`Also wrote -> ${STATIC_DATA_PATH}`);

  if (result.warnings.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(" -", w);
  }
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exitCode = 1;
});
