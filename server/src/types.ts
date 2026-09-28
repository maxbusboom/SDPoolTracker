export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface TimeRange {
  /** minutes since midnight */
  start: number;
  /** minutes since midnight */
  end: number;
  label: string;
}

export type ProgramType = "lapSwim" | "recSwim" | "waterFitness";

export type WeeklySchedule = Record<ProgramType, Record<DayKey, TimeRange[]>>;

export interface DatedClosure {
  date: string; // YYYY-MM-DD
  note?: string;
}

export interface IndefiniteClosure {
  note: string;
  projectedReopen?: string;
}

export interface PoolClosureInfo {
  datedClosures: DatedClosure[];
  note?: string;
  indefiniteClosure?: IndefiniteClosure;
}

export interface PoolInfo {
  slug: string;
  name: string;
  url: string;
  address?: string;
  phone?: string;
  dimensions?: string;
  depth?: string;
  lanes?: string;
  programGuideUrl?: string;
}

/**
 * Whether this pool's own Program Guide PDF was read successfully.
 * "ok": parsed at least one program's hours from it this scrape.
 * "failed": the pool links a guide, but it couldn't be fetched or parsed —
 *   the pool's hours fall back to the citywide combined schedule.
 * "none": the pool's page doesn't link a program guide at all.
 */
export interface ProgramGuideStatus {
  status: "ok" | "failed" | "none";
  /** ISO timestamp of the most recent scrape (this one or an earlier one) that read the guide successfully */
  lastSuccessAt?: string;
  /** The guide PDF that was actually used (status "ok") or last attempted */
  sourceUrl?: string;
  /** ISO timestamp from the guide file's HTTP Last-Modified header, i.e. when the city last updated the PDF itself */
  updatedAt?: string;
}

export interface PoolRecord extends PoolInfo {
  schedule: WeeklySchedule;
  closure: PoolClosureInfo;
  scheduleNotes: string[];
  programGuide: ProgramGuideStatus;
}

export interface ScrapeResult {
  scrapedAt: string;
  swimScheduleEffectiveDate?: string;
  swimScheduleSourceUrl: string;
  closureScheduleSourceUrl: string;
  closureScheduleUpdated?: string;
  closureScheduleRange?: string;
  pools: PoolRecord[];
  warnings: string[];
}

export type PoolStatus = "open" | "closed" | "maintenance-closed" | "unknown";

export interface PoolStatusInfo {
  status: PoolStatus;
  label: string;
  activePrograms: ProgramType[];
  nextChange?: string;
}
