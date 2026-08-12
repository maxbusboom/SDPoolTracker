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

export interface PoolRecord extends PoolInfo {
  schedule: WeeklySchedule;
  closure: PoolClosureInfo;
  scheduleNotes: string[];
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
