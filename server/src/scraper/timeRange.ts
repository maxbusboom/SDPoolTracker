import type { TimeRange } from "../types.js";

const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
const RANGE_RE = /\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s*-\s*\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/gi;

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
    const [startStr, endStr] = m.split("-");
    const start = parseClockTime(startStr);
    const end = parseClockTime(endStr);
    if (start !== undefined && end !== undefined) {
      ranges.push({ start, end, label: m.replace(/\s+/g, " ").trim() });
    }
  }
  return ranges;
}
