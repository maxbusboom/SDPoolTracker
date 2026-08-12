import { extractPdf } from "./pdfText.js";
import { DASH, extractTimeRanges, fixInvalidRange } from "./timeRange.js";
import { DAY_KEYS, type DayKey, type ProgramType, type TimeRange } from "../types.js";

const DAY_NAME_TO_KEY: Record<string, DayKey> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

// Only these two programs appear in a consistent "day-range + times" prose
// format across pools' program guides. Water Fitness guides are class-style
// free text (names, prices, prerequisites) that varies too much per pool to
// parse generically, so it's left to the citywide combined schedule.
const PROGRAM_HEADINGS: { program: ProgramType; pattern: RegExp }[] = [
  { program: "lapSwim", pattern: /^lap\s+swim\b/i },
  { program: "recSwim", pattern: /^recreation(al)?\s+swim\b/i },
];

const TIME_START_RE = /\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/i;
const DAY_RANGE_RE = new RegExp(`^([A-Za-z]+)\\s*${DASH}\\s*([A-Za-z]+)$`);

function parseDayRange(text: string): DayKey[] {
  const days = new Set<DayKey>();
  const parts = text
    .split(/[,/&]/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(DAY_RANGE_RE);
    if (rangeMatch) {
      const startKey = DAY_NAME_TO_KEY[rangeMatch[1].toLowerCase()];
      const endKey = DAY_NAME_TO_KEY[rangeMatch[2].toLowerCase()];
      if (startKey && endKey) {
        let i = DAY_KEYS.indexOf(startKey);
        const endIdx = DAY_KEYS.indexOf(endKey);
        for (let guard = 0; guard < 7; guard++) {
          days.add(DAY_KEYS[i]);
          if (i === endIdx) break;
          i = (i + 1) % 7;
        }
        continue;
      }
    }
    const singleKey = DAY_NAME_TO_KEY[part.toLowerCase()];
    if (singleKey) days.add(singleKey);
  }
  return [...days];
}

export type PartialSchedule = Partial<Record<ProgramType, Partial<Record<DayKey, TimeRange[]>>>>;

export interface ProgramGuideResult {
  schedule: PartialSchedule;
  warnings: string[];
}

/**
 * Parses the "LAP SWIM" / "RECREATION SWIM" rows out of a per-pool Program
 * Guide PDF, e.g.:
 *   LAP SWIM   Monday-Wednesday   8:00am-12:00pm* & 1:00pm-4:00pm* & 5:30pm-7:30pm*
 *              Thursday-Friday    8:00am-1:50pm / 2:10pm-4:00pm** & 5:00pm-8:00pm*
 * Each row is "<day range><times>", where the times segment can list
 * multiple blocks separated by "&" or "/" — extractTimeRanges finds every
 * clock-time pattern regardless of what separates them, so no special
 * handling of those separators is needed.
 */
export async function parseProgramGuide(buffer: Buffer, poolName: string): Promise<ProgramGuideResult> {
  const extraction = await extractPdf(buffer);
  const warnings = [...extraction.warnings];
  const schedule: PartialSchedule = {};

  if (extraction.pages.length === 0 && !extraction.fullText.trim()) {
    warnings.push(`Program guide for ${poolName}: no extractable text.`);
    return { schedule, warnings };
  }

  const lines = extraction.fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const { program, pattern } of PROGRAM_HEADINGS) {
    const startIdx = lines.findIndex((l) => pattern.test(l));
    if (startIdx === -1) continue;

    const programDays: Partial<Record<DayKey, TimeRange[]>> = {};
    for (let i = startIdx; i < lines.length; i++) {
      const line = i === startIdx ? lines[i].replace(pattern, "").trim() : lines[i];
      // Stop at the next section — either another program heading (there's
      // no blank-line separator preserved in the reconstructed text to rely
      // on) or a line with no clock time at all, e.g. a footnote.
      const startsAnotherSection = i !== startIdx && PROGRAM_HEADINGS.some((h) => h.pattern.test(line));
      if (i !== startIdx && (startsAnotherSection || extractTimeRanges(line).length === 0)) break;

      const timeIdx = line.search(TIME_START_RE);
      const dayText = timeIdx === -1 ? line : line.slice(0, timeIdx);
      const timesText = timeIdx === -1 ? "" : line.slice(timeIdx);
      const days = parseDayRange(dayText);
      const rawRanges = extractTimeRanges(timesText);
      const ranges: TimeRange[] = [];
      for (const r of rawRanges) {
        const fixed = fixInvalidRange(r);
        if (fixed) ranges.push(fixed);
        else warnings.push(`Program guide for ${poolName}: dropped an unparseable "${r.label}" range for ${program} (${dayText.trim()}).`);
      }

      if (days.length === 0 || ranges.length === 0) continue;
      for (const day of days) programDays[day] = ranges;
    }

    if (Object.keys(programDays).length > 0) {
      schedule[program] = programDays;
    } else {
      warnings.push(`Program guide for ${poolName}: found a "${program}" heading but no parsable day/time rows.`);
    }
  }

  return { schedule, warnings };
}
