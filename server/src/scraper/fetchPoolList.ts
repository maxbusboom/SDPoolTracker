import * as cheerio from "cheerio";
import { fetchText } from "./fetchHtml.js";

export const POOLS_URL = "https://www.sandiego.gov/pools";
const BASE = "https://www.sandiego.gov";

const NON_POOL_SLUGS = new Set([
  "fees",
  "programs",
  "rules-regulations",
]);

export interface PoolListing {
  slug: string;
  name: string;
  url: string;
}

export interface PoolsPageData {
  pools: PoolListing[];
  closureScheduleUrl: string;
  swimScheduleUrl: string;
}

function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return new URL(href, BASE).toString();
}

export async function fetchPoolsPageData(): Promise<PoolsPageData> {
  const html = await fetchText(POOLS_URL);
  const $ = cheerio.load(html);

  const pools = new Map<string, PoolListing>();
  $('a[href^="/pools/"], a[href^="https://www.sandiego.gov/pools/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = resolveUrl(href);
    const slug = url.replace(/\/$/, "").split("/pools/")[1];
    if (!slug || slug.includes("/") || NON_POOL_SLUGS.has(slug)) return;

    const name = $(el).find("h3, h2, .card__title, .field--name-title").first().text().trim()
      || $(el).attr("title")?.trim()
      || $(el).text().trim();
    if (!pools.has(slug)) {
      pools.set(slug, { slug, name: name || slugToName(slug), url });
    } else if (name && pools.get(slug)!.name === slugToName(slug)) {
      pools.get(slug)!.name = name;
    }
  });

  let closureScheduleUrl = "";
  let swimScheduleUrl = "";
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const text = $(el).text().trim().toLowerCase();
    const url = resolveUrl(href);
    if (!closureScheduleUrl && (text.includes("closure schedule") || /poolclosureschedule/i.test(href))) {
      closureScheduleUrl = url;
    }
    if (!swimScheduleUrl && (text.includes("swim schedule") || /poolsswimschedule/i.test(href))) {
      swimScheduleUrl = url;
    }
  });

  // The city's site sometimes ships these two buttons wrapped in an HTML
  // comment (seen in practice; unclear whether intentional). The link and
  // the PDF it points to keep working even when commented out, so fall
  // back to a raw-markup scan rather than failing the whole scrape.
  if (!closureScheduleUrl) closureScheduleUrl = findHrefInRawHtml(html, /poolclosureschedule\.pdf/i);
  if (!swimScheduleUrl) swimScheduleUrl = findHrefInRawHtml(html, /poolsswimschedule\.pdf/i);

  if (!closureScheduleUrl) throw new Error("Could not find pool maintenance closure schedule link on " + POOLS_URL);
  if (!swimScheduleUrl) throw new Error("Could not find swim schedule link on " + POOLS_URL);
  if (pools.size === 0) throw new Error("Could not find any pool links on " + POOLS_URL);

  return { pools: [...pools.values()], closureScheduleUrl, swimScheduleUrl };
}

function findHrefInRawHtml(html: string, filenamePattern: RegExp): string {
  const hrefRe = /href="([^"]+)"/g;
  for (const match of html.matchAll(hrefRe)) {
    if (filenamePattern.test(match[1])) return resolveUrl(match[1]);
  }
  return "";
}

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
