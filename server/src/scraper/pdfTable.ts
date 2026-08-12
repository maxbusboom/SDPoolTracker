import type { PdfTextItem } from "./pdfText.js";

export interface ColumnMarker {
  key: string;
  /** Header label variants to search for, e.g. ["Monday"] or ["Aug", "Aug."]. */
  candidates: string[];
}

export interface Column {
  key: string;
  xMin: number;
  xMax: number;
}

/**
 * Finds the x-position of each header column by locating, within a y-range,
 * the leftmost text item whose trimmed text is a prefix (or is prefixed by)
 * one of the marker's candidate labels. PDF text runs are frequently split
 * mid-word (e.g. "Oct." rendered as "Oc" + "t."), so a two-way prefix check
 * is used rather than an exact match.
 */
export function findColumnAnchors(
  items: PdfTextItem[],
  yMin: number,
  yMax: number,
  markers: ColumnMarker[]
): { key: string; x: number }[] {
  const anchors: { key: string; x: number }[] = [];
  for (const marker of markers) {
    let bestX: number | undefined;
    for (const item of items) {
      if (item.y < yMin || item.y > yMax) continue;
      const t = item.text.trim();
      if (t.length < 2) continue;
      const matches = marker.candidates.some(
        (c) => c.toLowerCase().startsWith(t.toLowerCase()) || t.toLowerCase().startsWith(c.toLowerCase())
      );
      if (matches && (bestX === undefined || item.x < bestX)) bestX = item.x;
    }
    if (bestX !== undefined) anchors.push({ key: marker.key, x: bestX });
  }
  return anchors;
}

/** Builds column x-ranges from sorted anchors, plus the label-region cutoff (everything left of the first column). */
export function toColumns(anchors: { key: string; x: number }[]): { columns: Column[]; labelMaxX: number } {
  const sorted = [...anchors].sort((a, b) => a.x - b.x);
  const columns: Column[] = sorted.map((a, i) => ({
    key: a.key,
    xMin: i === 0 ? a.x / 2 : (sorted[i - 1].x + a.x) / 2,
    xMax: i === sorted.length - 1 ? Infinity : (a.x + sorted[i + 1].x) / 2,
  }));
  // Row labels sit left of the first data column but can run fairly close to
  // it (observed within ~0.5 units of the column anchor in these documents),
  // so the cutoff is set generously rather than at the exact midpoint.
  const labelMaxX = sorted.length ? sorted[0].x * 0.75 : 0;
  return { columns, labelMaxX };
}

export interface RowBand {
  label: string;
  matchKey: string;
  yStart: number;
  yEnd: number;
}

/**
 * Segments the label column into per-row bands. Row-height varies with
 * name-wrapping in these documents, so bands are found by greedily
 * accumulating label fragments (top to bottom) until they fully cover a
 * known row key's tokens, rather than by any fixed line count or y-gap
 * threshold (both proved ambiguous against the real documents).
 */
export function segmentRowsByLabel<T>(
  items: PdfTextItem[],
  labelMaxX: number,
  yMin: number,
  yMax: number,
  rowKeys: T[],
  matchBuffer: (buffer: string, remaining: T[]) => T | undefined,
  keyToString: (key: T) => string
): RowBand[] {
  const labelItems = items
    .filter((i) => i.x < labelMaxX && i.y > yMin && i.y <= yMax && i.text.trim().length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const remaining = [...rowKeys];
  const starts: { y: number; key: T }[] = [];
  let buffer = "";
  let bufferStartY: number | undefined;

  for (const item of labelItems) {
    if (bufferStartY === undefined) bufferStartY = item.y;
    buffer = `${buffer} ${item.text}`.trim();
    const match = matchBuffer(buffer, remaining);
    if (match) {
      starts.push({ y: bufferStartY, key: match });
      remaining.splice(remaining.indexOf(match), 1);
      buffer = "";
      bufferStartY = undefined;
    }
  }

  return starts.map((s, i) => ({
    label: keyToString(s.key),
    matchKey: keyToString(s.key),
    yStart: i === 0 ? yMin : (starts[i - 1].y + s.y) / 2,
    yEnd: i === starts.length - 1 ? yMax : (s.y + starts[i + 1].y) / 2,
  }));
}

export interface Line {
  y: number;
  items: PdfTextItem[];
}

export function groupIntoLines(items: PdfTextItem[], yMin: number, yMax: number, xMin: number): Line[] {
  const filtered = items
    .filter((i) => i.x >= xMin && i.y > yMin && i.y <= yMax)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  const tolerance = 0.35;
  for (const item of filtered) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last.y) < tolerance) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines;
}

/** Concatenates the items of a line that fall within a column's x-range, in reading order, with no inserted separator (adjacent split glyphs/words are meant to be joined directly). */
export function bucketLine(line: Line, column: Column): string {
  return line.items
    .filter((i) => i.x >= column.xMin && i.x < column.xMax)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
