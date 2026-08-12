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
server/   Express API + scraper (TypeScript, ESM)
web/      React + Vite frontend
```

## Running it

Requires Node 20+.

```bash
npm install

# Scrape sandiego.gov and cache the result to server/data/cache.json
npm run scrape

# Start the API (also auto-scrapes on first boot if no cache exists,
# and re-scrapes every 12 hours on a schedule)
npm run dev:server   # http://localhost:3001

# In another terminal, start the frontend (proxies /api to :3001)
npm run dev:web      # http://localhost:5173
```

For a production build:

```bash
npm run build
npm run dev:server   # serves the built web/dist as static files too
```

## API

- `GET /api/pools` — every pool with its current open/closed status
- `GET /api/pools/:slug` — full detail: schedule, closures, address, phone,
  source links
- `GET /api/meta` — scrape timestamp, source PDF URLs, warnings
- `POST /api/refresh` — force an immediate re-scrape

## Notes / limitations

- Status is computed in Pacific time from the scraped weekly schedule and
  closure dates. The city's own documents say hours are "subject to change
  without notice" — treat this as a planning tool, not a guarantee.
- Pool-page scraping (address, phone, dimensions, program guide link) uses
  each pool's dedicated page. Its seasonal "Program Guide" PDF (swim
  lesson registration, etc.) is linked from the detail page but not parsed
  — only the citywide lap/rec/fitness schedule is.
- If sandiego.gov reorganizes these pages or PDFs, `npm run scrape` will
  print warnings for anything it couldn't confidently parse rather than
  silently producing wrong data.
