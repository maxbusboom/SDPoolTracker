import * as cheerio from "cheerio";
import { fetchText } from "./fetchHtml.js";
import type { PoolInfo } from "../types.js";
import type { PoolListing } from "./fetchPoolList.js";

export interface PoolPageInfo extends PoolInfo {
  /** Every program-guide PDF the page links, in page order; the scraper picks the freshest one that parses. */
  programGuideCandidates: string[];
}

export async function fetchPoolPage(listing: PoolListing): Promise<PoolPageInfo> {
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

  // Pages often link several program guide PDFs (current and stale seasons);
  // all of them are collected here and the scraper decides later which one to
  // trust, by each file's HTTP Last-Modified — the "YYYY-MM" in the URL path
  // is only the original upload month, and the city updates these files in
  // place, so the path date is a misleading freshness signal.
  // Scanned from the raw HTML rather than through cheerio: these specific
  // buttons are frequently wrapped in an HTML comment on this site (seen on
  // several pools — e.g. a pool's current "Summer Program Guide" link sits
  // inside a `<!-- -->` block right next to its live "Fall Program Guide"
  // link, so cheerio's DOM silently drops the current one and this would
  // otherwise serve two-year-stale hours). The comment doesn't stop the
  // link or the PDF it points to from working, so reading the markup
  // directly rather than through the DOM is what makes it reliable.
  const programGuideCandidates: string[] = [];
  const linkRe = /<a[^>]*href="([^"]*\.pdf)"[^>]*>([^<]*)</gi;
  for (const match of html.matchAll(linkRe)) {
    const [, href, text] = match;
    // Link text on some pools separates "Program Guide" with a non-breaking
    // space (either a literal U+00A0 or an "&nbsp;" entity), so normalize
    // whitespace before matching.
    const normalized = text.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").toLowerCase();
    if (!normalized.includes("program guide")) continue;
    const url = new URL(href, listing.url).toString();
    if (!programGuideCandidates.includes(url)) programGuideCandidates.push(url);
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
    programGuideCandidates,
  };
}
