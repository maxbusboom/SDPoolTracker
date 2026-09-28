import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScrape } from "./scraper/index.js";
import type { ScrapeResult } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", "data", "cache.json");
// The static frontend (deployed to GitHub Pages) has no backend to query,
// so it reads this file directly instead of calling the API.
const STATIC_DATA_PATH = path.join(__dirname, "..", "..", "web", "public", "data.json");

// The previous scrape tells us when each pool's program guide was last read
// successfully. In CI there's no local cache between runs, so the workflow
// points PREVIOUS_DATA_URL at the data.json currently deployed on Pages.
async function loadPrevious(): Promise<ScrapeResult | undefined> {
  const url = process.env.PREVIOUS_DATA_URL;
  try {
    if (url) {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ScrapeResult;
    }
    return JSON.parse(await readFile(CACHE_PATH, "utf8")) as ScrapeResult;
  } catch (err) {
    console.log(`No previous scrape loaded (${url ?? CACHE_PATH}): ${(err as Error).message}`);
    return undefined;
  }
}

async function main() {
  const previous = await loadPrevious();
  if (previous) console.log(`Loaded previous scrape from ${previous.scrapedAt}`);
  console.log("Scraping sandiego.gov/pools ...");
  const result = await runScrape(previous);
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
