import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScrape } from "./scraper/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", "data", "cache.json");

async function main() {
  console.log("Scraping sandiego.gov/pools ...");
  const result = await runScrape();
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(result, null, 2));
  console.log(`Scraped ${result.pools.length} pools -> ${CACHE_PATH}`);
  if (result.warnings.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(" -", w);
  }
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exitCode = 1;
});
