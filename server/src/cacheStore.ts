import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScrape } from "./scraper/index.js";
import type { ScrapeResult } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "..", "data", "cache.json");

let current: ScrapeResult | undefined;
let refreshing: Promise<ScrapeResult> | undefined;

export async function loadCache(): Promise<ScrapeResult | undefined> {
  if (current) return current;
  try {
    const raw = await readFile(CACHE_PATH, "utf8");
    current = JSON.parse(raw);
    return current;
  } catch {
    return undefined;
  }
}

export function getCache(): ScrapeResult | undefined {
  return current;
}

export async function refreshCache(): Promise<ScrapeResult> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const result = await runScrape();
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(result, null, 2));
    current = result;
    return result;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = undefined;
  }
}
