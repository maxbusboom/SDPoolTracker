import type { PoolListing } from "./fetchPoolList.js";
import { extractPdf, type PdfPage } from "./pdfText.js";
import { findColumnAnchors, toColumns, segmentRowsByLabel, groupIntoLines, bucketLine } from "./pdfTable.js";
import { matchRowBuffer } from "./matchPool.js";
import { extractTimeRanges } from "./timeRange.js";
import { DAY_KEYS, type DayKey, type ProgramType, type WeeklySchedule } from "../types.js";

const DAY_MARKERS: { key: DayKey; candidates: string[] }[] = [
  { key: "mon", candidates: ["Monday"] },
  { key: "tue", candidates: ["Tuesday"] },
  { key: "wed", candidates: ["Wednesday"] },
  { key: "thu", candidates: ["Thursday"] },
  { key: "fri", candidates: ["Friday"] },
  { key: "sat", candidates: ["Saturday"] },
  { key: "sun", candidates: ["Sunday"] },
];

const PROGRAM_SECTIONS: { program: ProgramType; pattern: RegExp }[] = [
  { program: "lapSwim", pattern: /lap\s*swim/i },
  { program: "recSwim", pattern: /recreational\s*swim/i },
  { program: "waterFitness", pattern: /water\s*fitness/i },
];

function emptyWeeklySchedule(): WeeklySchedule {
  const programs: ProgramType[] = ["lapSwim", "recSwim", "waterFitness"];
  const schedule = {} as WeeklySchedule;
  for (const program of programs) {
    schedule[program] = {} as Record<DayKey, ReturnType<typeof extractTimeRanges>>;
    for (const day of DAY_KEYS) schedule[program][day] = [];
  }
  return schedule;
}

export interface SwimScheduleResult {
  schedules: Map<string, WeeklySchedule>;
  poolNotes: Map<string, string[]>;
  effectiveDate?: string;
  globalNotes: string[];
  warnings: string[];
}

export async function parseSwimSchedule(buffer: Buffer, pools: PoolListing[]): Promise<SwimScheduleResult> {
  const extraction = await extractPdf(buffer);
  const warnings = [...extraction.warnings];
  const schedules = new Map<string, WeeklySchedule>();
  const poolNotes = new Map<string, string[]>();
  const globalNotes: string[] = [];

  const effectiveMatch = extraction.fullText.match(/Effective\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  const effectiveDate = effectiveMatch?.[1];

  for (const pool of pools) {
    schedules.set(pool.slug, emptyWeeklySchedule());
  }

  if (extraction.pages.length === 0) {
    warnings.push("Swim schedule: no positional text layer (OCR fallback text only); cannot parse the day/time grid structurally.");
    return { schedules, poolNotes, effectiveDate, globalNotes, warnings };
  }

  for (const page of extraction.pages) {
    parsePage(page, pools, schedules, poolNotes, globalNotes, warnings);
  }

  return { schedules, poolNotes, effectiveDate, globalNotes: [...new Set(globalNotes)], warnings };
}

function parsePage(
  page: PdfPage,
  pools: PoolListing[],
  schedules: Map<string, WeeklySchedule>,
  poolNotes: Map<string, string[]>,
  globalNotes: string[],
  warnings: string[]
) {
  const items = page.items;
  const section = PROGRAM_SECTIONS.find((s) => items.some((i) => s.pattern.test(i.text)));
  if (!section) return;

  const headerAnchor = items.find((i) => /^monday$/i.test(i.text.trim()));
  if (!headerAnchor) {
    warnings.push(`Swim schedule: could not locate day-of-week header on a page for ${section.program}.`);
    return;
  }
  const headerYMin = headerAnchor.y - 0.3;
  const headerYMax = headerAnchor.y + 0.3;

  const anchors = findColumnAnchors(items, headerYMin, headerYMax, DAY_MARKERS);
  if (anchors.length < DAY_MARKERS.length) {
    warnings.push(
      `Swim schedule (${section.program}): only found ${anchors.length}/${DAY_MARKERS.length} day columns; results may be incomplete.`
    );
  }
  const { columns, labelMaxX } = toColumns(anchors);

  const footerAnchor = items.find(
    (i) => i.y > headerYMax && (/^\*/.test(i.text.trim()) || /all pools closed/i.test(i.text) || /this document is updated/i.test(i.text))
  );
  const globalNoteAnchor = items.find((i) => i.y > headerYMax && /all pools closed/i.test(i.text));
  if (globalNoteAnchor) globalNotes.push(globalNoteAnchor.text.trim());

  const bodyYMin = headerYMax;
  const bodyYMax = footerAnchor ? footerAnchor.y - 0.3 : Math.max(...items.map((i) => i.y)) + 1;

  const bands = segmentRowsByLabel(items, labelMaxX, bodyYMin, bodyYMax, pools, matchRowBuffer, (p) => p.slug);

  for (const band of bands) {
    const pool = pools.find((p) => p.slug === band.matchKey)!;
    const lines = groupIntoLines(items, band.yStart, band.yEnd, labelMaxX);
    const schedule = schedules.get(pool.slug)!;

    for (const line of lines) {
      for (const column of columns) {
        const cell = bucketLine(line, column);
        if (!cell) continue;
        const ranges = extractTimeRanges(cell);
        if (ranges.length > 0) {
          schedule[section.program][column.key as DayKey].push(...ranges);
        } else if (/[a-zA-Z]{4,}/.test(cell)) {
          const notes = poolNotes.get(pool.slug) ?? [];
          const note = cell.replace(/\s+/g, " ").trim();
          if (!notes.includes(note)) notes.push(note);
          poolNotes.set(pool.slug, notes);
        }
      }
    }
  }
}
