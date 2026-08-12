import * as cheerio from "cheerio";
import { fetchText } from "./fetchHtml.js";
import type { PoolInfo } from "../types.js";
import type { PoolListing } from "./fetchPoolList.js";

export async function fetchPoolPage(listing: PoolListing): Promise<PoolInfo> {
  const html = await fetchText(listing.url);
  const $ = cheerio.load(html);

  const name = $("h1").first().text().trim() || listing.name;

  const streetAddress = $('[itemprop="streetAddress"]').first().text().trim();
  const locality = $('[itemprop="addressLocality"]').first().text().trim();
  const region = $('[itemprop="addressRegion"]').first().text().trim();
  const postalCode = $('[itemprop="postalCode"]').first().text().trim();
  const address = [streetAddress, [locality, region].filter(Boolean).join(", "), postalCode]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const phone = $('[itemprop="telephone"]').first().text().trim();

  const aboutTable: Record<string, string> = {};
  $('table.table, table[summary="About the pool"]')
    .first()
    .find("tr")
    .each((_, tr) => {
      const cells = cheerio.load(tr)("td");
      const key = cells.eq(0).text().trim().toLowerCase();
      const value = cells.eq(1).text().trim();
      if (key && value) aboutTable[key] = value;
    });

  // Pages often link both a current and a stale program guide PDF; the URL
  // path embeds a "YYYY-MM" upload date, so the most recent one is kept.
  let programGuideUrl: string | undefined;
  let programGuideDate = "";
  $('a[href$=".pdf"]').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr("href");
    if (!href || !text.includes("program guide")) return;
    const dateMatch = href.match(/(\d{4}-\d{2})/);
    const date = dateMatch?.[1] ?? "";
    if (!programGuideUrl || date > programGuideDate) {
      programGuideUrl = new URL(href, listing.url).toString();
      programGuideDate = date;
    }
  });

  return {
    slug: listing.slug,
    name,
    url: listing.url,
    address: address || undefined,
    phone: phone || undefined,
    dimensions: aboutTable["dimensions"],
    depth: aboutTable["depth"],
    lanes: aboutTable["lanes"],
    programGuideUrl,
  };
}
