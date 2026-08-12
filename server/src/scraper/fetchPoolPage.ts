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
  // Scanned from the raw HTML rather than through cheerio: these specific
  // buttons are frequently wrapped in an HTML comment on this site (seen on
  // several pools — e.g. a pool's current "Summer Program Guide" link sits
  // inside a `<!-- -->` block right next to its live "Fall Program Guide"
  // link, so cheerio's DOM silently drops the current one and this would
  // otherwise serve two-year-stale hours). The comment doesn't stop the
  // link or the PDF it points to from working, so reading the markup
  // directly rather than through the DOM is what makes it reliable.
  let programGuideUrl: string | undefined;
  let programGuideDate = "";
  const linkRe = /<a[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)</gi;
  for (const match of html.matchAll(linkRe)) {
    const [, href, text] = match;
    if (!text.toLowerCase().includes("program guide")) continue;
    const dateMatch = href.match(/(\d{4}-\d{2})/);
    const date = dateMatch?.[1] ?? "";
    if (!programGuideUrl || date > programGuideDate) {
      programGuideUrl = new URL(href, listing.url).toString();
      programGuideDate = date;
    }
  }

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
