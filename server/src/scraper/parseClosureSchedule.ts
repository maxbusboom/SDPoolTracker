import type { PoolListing } from "./fetchPoolList.js";
import { extractPdf } from "./pdfText.js";
import { findColumnAnchors, toColumns, segmentRowsByLabel, groupIntoLines, bucketLine } from "./pdfTable.js";
import { matchRowBuffer } from "./matchPool.js";
import type { PoolClosureInfo } from "../types.js";

const MONTH_MARKERS: { key: string; month: number; candidates: string[] }[] = [
  { key: "Aug", month: 8, candidates: ["Aug", "Aug."] },
  { key: "Sept", month: 9, candidates: ["Sept", "Sept.", "Sep"] },
  { key: "Oct", month: 10, candidates: ["Oct", "Oct."] },
  { key: "Nov", month: 11, candidates: ["Nov", "Nov."] },
  { key: "Dec", month: 12, candidates: ["Dec", "Dec."] },
  { key: "Jan", month: 1, candidates: ["Jan", "Jan."] },
  { key: "Feb", month: 2, candidates: ["Feb", "Feb."] },
  { key: "Mar", month: 3, candidates: ["Mar", "Mar."] },
  { key: "Apr", month: 4, candidates: ["Apr", "Apr."] },
  { key: "May", month: 5, candidates: ["May", "May."] },
  { key: "Jun", month: 6, candidates: ["Jun", "Jun.", "June"] },
];

export interface ClosureScheduleResult {
  closures: Map<string, PoolClosureInfo>;
  scheduleUpdated?: string;
  scheduleRange?: string;
  warnings: string[];
}

export async function parseClosureSchedule(
  buffer: Buffer,
  pools: PoolListing[]
): Promise<ClosureScheduleResult> {
  const extraction = await extractPdf(buffer);
  const warnings = [...extraction.warnings];
  const closures = new Map<string, PoolClosureInfo>();

  const updatedMatch = extraction.fullText.match(/Updated\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const rangeMatch = extraction.fullText.match(/\(([A-Za-z]+\.?\s+\d{4})\s+to\s+([A-Za-z]+\.?\s+\d{4})\)/i);
  const scheduleUpdated = updatedMatch?.[1];
  const scheduleRange = rangeMatch ? `${rangeMatch[1]} to ${rangeMatch[2]}` : undefined;
  const startYear = rangeMatch ? Number(rangeMatch[1].match(/\d{4}/)?.[0]) : undefined;

  if (extraction.pages.length === 0) {
    warnings.push("Closure schedule: no positional text layer (OCR fallback text only); cannot parse the maintenance grid structurally.");
    return { closures, scheduleUpdated, scheduleRange, warnings };
  }

  const page = extraction.pages[0];
  const items = page.items;

  const headerAnchor = items.find((i) => /^aug\.?$/i.test(i.text.trim()));
  if (!headerAnchor) {
    warnings.push("Closure schedule: could not locate month header row.");
    return { closures, scheduleUpdated, scheduleRange, warnings };
  }
  const headerYMin = headerAnchor.y - 0.3;
  const headerYMax = headerAnchor.y + 0.6;

  const anchors = findColumnAnchors(items, headerYMin, headerYMax, MONTH_MARKERS);
  if (anchors.length < MONTH_MARKERS.length) {
    warnings.push(
      `Closure schedule: only found ${anchors.length}/${MONTH_MARKERS.length} month columns; results may be incomplete.`
    );
  }
  const { columns, labelMaxX } = toColumns(anchors);
  const monthByKey = new Map(MONTH_MARKERS.map((m) => [m.key, m.month]));
  // Columns run chronologically left to right and cross a year boundary
  // partway through (e.g. Aug 2025 .. Jun 2026), so the year is fixed per
  // column position rather than inferred per row.
  const yearByKey = new Map(
    MONTH_MARKERS.map((m, idx) => [m.key, startYear === undefined ? undefined : startYear + (idx < 5 ? 0 : 1)])
  );

  const footerAnchor = items.find((i) => /subject to change/i.test(i.text));
  const bodyYMin = headerYMax;
  const bodyYMax = footerAnchor ? footerAnchor.y - 0.3 : Math.max(...items.map((i) => i.y)) + 1;

  const bands = segmentRowsByLabel(items, labelMaxX, bodyYMin, bodyYMax, pools, matchRowBuffer, (p) => p.slug);

  for (const band of bands) {
    const pool = pools.find((p) => p.slug === band.matchKey)!;
    const lines = groupIntoLines(items, band.yStart, band.yEnd, labelMaxX);

    const datedClosures: { date: string; note?: string }[] = [];
    const noteParts: string[] = [];

    for (const line of lines) {
      for (const column of columns) {
        const cell = bucketLine(line, column);
        if (!cell) continue;
        // A single cell can hold more than one closure day in the same
        // month (e.g. "4 31"), so every bare day number is extracted
        // rather than requiring the whole cell to be one number.
        const dayMatches = cell.match(/\b\d{1,2}\b/g);
        if (dayMatches && !/[a-zA-Z]/.test(cell)) {
          const month = monthByKey.get(column.key)!;
          const year = yearByKey.get(column.key);
          if (year !== undefined) {
            for (const dayStr of dayMatches) {
              const day = Number(dayStr);
              const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              datedClosures.push({ date });
            }
          }
        } else if (/[a-zA-Z]/.test(cell)) {
          noteParts.push(cell);
        }
      }
    }

    const note = noteParts.length ? noteParts.join(" ").replace(/\s+/g, " ").trim() : undefined;
    const info: PoolClosureInfo = { datedClosures };
    if (note) {
      const reopenMatch = note.match(/reopen\s+([A-Za-z]+\s+\d{4})/i);
      if (datedClosures.length === 0 && /reopen|renovation/i.test(note)) {
        info.indefiniteClosure = { note, projectedReopen: reopenMatch?.[1] };
      } else {
        info.note = note;
      }
    }
    closures.set(pool.slug, info);
  }

  return { closures, scheduleUpdated, scheduleRange, warnings };
}
