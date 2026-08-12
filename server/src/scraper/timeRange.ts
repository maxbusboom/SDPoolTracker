import type { TimeRange } from "../types.js";

const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
// Source PDFs mix plain hyphens with en/em dashes (likely pasted from Word)
// as the range separator, so all three are accepted.
export const DASH = "[-–—]";
const RANGE_RE = new RegExp(`\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?m\\.?\\s*${DASH}\\s*\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?m\\.?`, "gi");
const SPLIT_RE = new RegExp(DASH);
const NORMALIZE_DASH_RE = new RegExp(`\\s*${DASH}\\s*`);

function parseClockTime(text: string): number | undefined {
  const m = text.match(TIME_RE);
  if (!m) return undefined;
  let hour = Number(m[1]) % 12;
  const minute = m[2] ? Number(m[2]) : 0;
  if (m[3].toLowerCase() === "p") hour += 12;
  return hour * 60 + minute;
}

/** Extracts every "H:MMam-H:MMpm"-style range found in text. */
export function extractTimeRanges(text: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  const matches = text.match(RANGE_RE);
  if (!matches) return ranges;
  for (const m of matches) {
    const [startStr, endStr] = m.split(SPLIT_RE);
    const start = parseClockTime(startStr);
    const end = parseClockTime(endStr);
    if (start !== undefined && end !== undefined) {
      const label = m.replace(/\s+/g, " ").trim().replace(NORMALIZE_DASH_RE, "-");
      ranges.push({ start, end, label });
    }
  }
  return ranges;
}

/** Toggles am<->pm for a minutes-since-midnight value (e.g. 11:30am <-> 11:30pm). */
export function flipMeridiem(minutes: number): number {
  return (minutes + 12 * 60) % (24 * 60);
}

export function formatClockLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

/**
 * A pool schedule range with end <= start (e.g. source text saying
 * "11:00pm-3:00pm") is essentially always a same-day am/pm slip rather than
 * an intentional overnight block, so a meridiem flip on whichever end fixes
 * it is tried before giving up and dropping the range entirely.
 */
export function fixInvalidRange(range: TimeRange): TimeRange | undefined {
  if (range.end > range.start) return range;

  const flippedEnd = flipMeridiem(range.end);
  if (flippedEnd > range.start) {
    return { start: range.start, end: flippedEnd, label: `${formatClockLabel(range.start)}-${formatClockLabel(flippedEnd)}` };
  }
  const flippedStart = flipMeridiem(range.start);
  if (range.end > flippedStart) {
    return { start: flippedStart, end: range.end, label: `${formatClockLabel(flippedStart)}-${formatClockLabel(range.end)}` };
  }
  return undefined;
}
