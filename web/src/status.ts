import type { DayKey, PoolStatusInfo, ProgramType, RawPoolRecord, TimeRange } from "./types";

// Mirrors server/src/status/isOpen.ts. Duplicated (not shared as a package)
// since the frontend has no build-time dependency on the server workspace;
// it only ever sees the plain data.json this logic is computed from.

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PACIFIC_TZ = "America/Los_Angeles";
const PROGRAM_LABELS: Record<ProgramType, string> = {
  lapSwim: "Lap Swim",
  recSwim: "Recreational Swim",
  waterFitness: "Water Fitness",
};

export interface PacificNow {
  dateKey: string;
  dayKey: DayKey;
  minutesSinceMidnight: number;
}

export function getPacificNow(date: Date = new Date()): PacificNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));
  const weekday = get("weekday").toLowerCase();

  const weekdayMap: Record<string, DayKey> = {
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
    sun: "sun",
  };

  return {
    dateKey: `${year}-${month}-${day}`,
    dayKey: weekdayMap[weekday.slice(0, 3)] ?? "mon",
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export function computePoolStatus(pool: RawPoolRecord, now: PacificNow = getPacificNow()): PoolStatusInfo {
  if (pool.closure.indefiniteClosure) {
    const { note, projectedReopen } = pool.closure.indefiniteClosure;
    return {
      status: "maintenance-closed",
      label: projectedReopen ? `Closed for maintenance — projected to reopen ${projectedReopen}` : `Closed for maintenance: ${note}`,
      activePrograms: [],
    };
  }

  const todaysClosure = pool.closure.datedClosures.find((c) => c.date === now.dateKey);
  if (todaysClosure) {
    return {
      status: "maintenance-closed",
      label: pool.closure.note ? `Closed today for maintenance (${pool.closure.note})` : "Closed today for maintenance",
      activePrograms: [],
    };
  }

  const programs = Object.keys(pool.schedule) as ProgramType[];
  const hasAnySchedule = programs.some((p) => DAY_KEYS.some((d) => pool.schedule[p][d].length > 0));
  if (!hasAnySchedule) {
    return { status: "unknown", label: "Schedule unavailable", activePrograms: [] };
  }

  const activePrograms: ProgramType[] = [];
  for (const program of programs) {
    const ranges = pool.schedule[program][now.dayKey];
    if (ranges.some((r) => now.minutesSinceMidnight >= r.start && now.minutesSinceMidnight < r.end)) {
      activePrograms.push(program);
    }
  }

  if (activePrograms.length > 0) {
    return {
      status: "open",
      label: `Open now — ${activePrograms.map((p) => PROGRAM_LABELS[p]).join(", ")}`,
      activePrograms,
    };
  }

  const next = findNextOpening(pool, now);
  return {
    status: "closed",
    label: next ? `Closed — opens ${next}` : "Closed",
    activePrograms: [],
    nextChange: next,
  };
}

/**
 * Merges every program's time ranges for the given day into the overall
 * span(s) the pool is accessible in some capacity, e.g. Lap Swim 7-11am
 * plus Rec Swim 10am-2pm becomes a single "7:00am-2:00pm" range, while a
 * genuine midday gap with nothing scheduled stays as two separate ranges.
 */
export function getDaysHours(pool: RawPoolRecord, dayKey: DayKey): string[] {
  const programs = Object.keys(pool.schedule) as ProgramType[];
  const ranges = programs
    .flatMap((p) => pool.schedule[p][dayKey])
    .slice()
    .sort((a, b) => a.start - b.start);

  const merged: TimeRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged.map((r) => `${formatMinutes(r.start)}–${formatMinutes(r.end)}`);
}

function findNextOpening(pool: RawPoolRecord, now: PacificNow): string | undefined {
  const startIdx = DAY_KEYS.indexOf(now.dayKey);
  const programs = Object.keys(pool.schedule) as ProgramType[];

  for (let offset = 0; offset < 7; offset++) {
    const dayKey = DAY_KEYS[(startIdx + offset) % 7];
    const candidates: TimeRange[] = programs.flatMap((p) => pool.schedule[p][dayKey]);
    const upcoming = candidates
      .filter((r) => (offset === 0 ? r.start > now.minutesSinceMidnight : true))
      .sort((a, b) => a.start - b.start)[0];
    if (upcoming) {
      const dayLabel = offset === 0 ? "today" : offset === 1 ? "tomorrow" : dayKey;
      return `${formatMinutes(upcoming.start)} ${dayLabel}`;
    }
  }
  return undefined;
}
