const USER_AGENT =
  "Mozilla/5.0 (compatible; SDPoolTrackerBot/1.0; +https://github.com/maxbusboom/SDPoolTracker)";

// Purely defensive: forces a cache miss so a CDN layer in front of
// sandiego.gov can't hand back a stale cached response instead of the
// current page. (The actual comment-wrapped-link issue handled elsewhere in
// the scraper — see fetchPoolList.ts / fetchPoolPage.ts — turned out to be
// unrelated to caching; this is kept anyway since fresh responses are what
// a scraper wants regardless.)
function bustCache(url: string): string {
  const u = new URL(url);
  u.searchParams.set("_cb", Date.now().toString());
  return u.toString();
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(bustCache(url), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(bustCache(url), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
