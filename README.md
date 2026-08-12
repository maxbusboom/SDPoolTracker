# SD Pool Tracker

A web app that tracks whether City of San Diego public pools are open right
now, and shows each pool's weekly Lap Swim / Recreational Swim / Water
Fitness schedule and upcoming maintenance closures.

It works by scraping [sandiego.gov/pools](https://www.sandiego.gov/pools),
its 15 individual pool pages, and the two PDFs the city publishes there:

- **Citywide Lap and Recreational Swim Schedule** — a combined PDF with a
  day-of-week x pool grid for Lap Swim, Recreational Swim, and Water
  Fitness.
- **Pool Maintenance Closure Schedule** — a month x pool grid of scheduled
  maintenance closures, including indefinite renovation closures.

Deployed as a static site on GitHub Pages, re-scraped on a schedule by
GitHub Actions — see [Deploying to GitHub Pages](#deploying-to-github-pages).

## How the scraping works

Both PDFs the city currently publishes are text-based, not scanned images,
so the scraper reads them with their embedded text layer — extracting each
line of text along with its exact position on the page ([pdf2json](https://github.com/modesty/pdf2json)) —
and reconstructs the grid by locating each table's header row (day names or
month names), then walking down the page to find each pool's row.

Row-height in these documents isn't fixed — a pool's name might wrap onto
one line or two — so rows are found by accumulating name fragments until
they match a known pool name from the live pool list, rather than assuming
a fixed number of lines per row. See `server/src/scraper/pdfTable.ts` and
`matchPool.ts` for the details.

**OCR fallback:** if a PDF ever has no extractable text layer (e.g. the
city switches to a scanned document), the scraper falls back to rendering
each page to an image (`pdfjs-dist` + `@napi-rs/canvas`) and running OCR
over it (`tesseract.js`). This path only yields plain text, not the
positional data the grid parser needs, so closures/schedules from an
OCR'd document are captured as unstructured warnings rather than
structured data — call the pool to confirm hours in that case.

## Project layout

```
server/               Scraper (TypeScript, ESM) + an optional Express API
web/                  React + Vite frontend
.github/workflows/    Scheduled scrape -> build -> deploy to GitHub Pages
```

## How "up to date" it is

GitHub Pages only serves static files — it can't run the scraper live on
every visit. Instead, a GitHub Actions workflow
(`.github/workflows/deploy.yml`) runs the scraper and redeploys the site
every 12 hours, on every push to `main`, and on demand (Actions tab -> "Scrape
and deploy to GitHub Pages" -> Run workflow).

Within that, whether a pool shows as **open right now** is always computed
live in your browser (against the last-scraped weekly schedule and closure
dates) — that part is accurate to the minute. Only the underlying schedule
and closure data itself is as fresh as the last scheduled scrape.

## Deploying to GitHub Pages

One-time setup on GitHub: **Settings -> Pages -> Build and deployment ->
Source: "GitHub Actions"**. After that, every push to `main` (and the
12-hour schedule) builds and deploys automatically via the included
workflow — nothing else to configure. The site ends up at
`https://<user>.github.io/<repo>/`.

## Running it locally

Requires Node 20+.

```bash
npm install

# Scrape sandiego.gov and write web/public/data.json (also cached to
# server/data/cache.json)
npm run scrape

# Start the frontend, reading that data.json as a static file
npm run dev:web      # http://localhost:5173
```

To build the same static site the GitHub Actions workflow deploys:

```bash
npm run scrape
npm run build --workspace web   # -> web/dist
```

### Alternative: self-hosted with a live API

`server/` also runs standalone as an Express API with its own cache and a
12-hour cron refresh, if you'd rather self-host than use GitHub Pages
(useful for `POST /api/refresh` to force an on-demand re-scrape, which a
static site can't offer):

```bash
npm run dev:server   # http://localhost:3001 — GET /api/pools, /api/pools/:slug, /api/meta, POST /api/refresh
```

The frontend in this repo does not call this API (it reads `data.json`
directly); it's kept as a separate deployment option, not wired together
with the static build.

## Notes / limitations

- Status is computed in Pacific time from the scraped weekly schedule and
  closure dates. The city's own documents say hours are "subject to change
  without notice" — treat this as a planning tool, not a guarantee.
- Pool-page scraping (address, phone, dimensions) uses each pool's
  dedicated page. Its per-pool "Program Guide" PDF is also fetched and its
  Lap Swim / Rec Swim hours take priority over the citywide combined
  schedule for any day it specifies (falling back to the combined schedule
  otherwise); Water Fitness always comes from the combined schedule since
  guide formatting for it varies too much per pool to parse generically.
- URLs and links are all discovered dynamically (by link text/filename
  patterns, not hardcoded addresses), so the scraper adapts automatically
  when the city swaps in a new PDF each season. The three program
  categories (Lap Swim / Recreational Swim / Water Fitness) *are* a fixed,
  hardcoded set, though — that's a deliberate bet that these particular
  categories are stable citywide-aquatics concepts, not a per-season detail.
  If the city ever renames or adds one, `npm run scrape` logs a warning
  ("doesn't match any known program" / "no Lap Swim or Recreation(al) Swim
  heading found") naming the page/pool instead of silently dropping the
  data — check the Actions run log if the deployed site's data looks stale
  or a pool is missing an expected program.
