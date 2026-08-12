export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ProgramType = "lapSwim" | "recSwim" | "waterFitness";

export interface TimeRange {
  start: number;
  end: number;
  label: string;
}

export type WeeklySchedule = Record<ProgramType, Record<DayKey, TimeRange[]>>;

export type PoolStatusKind = "open" | "closed" | "maintenance-closed" | "unknown";

export interface PoolStatusInfo {
  status: PoolStatusKind;
  label: string;
  activePrograms: ProgramType[];
  nextChange?: string;
}

export interface PoolListItem {
  slug: string;
  name: string;
  address?: string;
  phone?: string;
  status: PoolStatusInfo;
  todaysHours: string[];
}

export interface DatedClosure {
  date: string;
  note?: string;
}

export interface PoolClosureInfo {
  datedClosures: DatedClosure[];
  note?: string;
  indefiniteClosure?: { note: string; projectedReopen?: string };
}

export interface PoolDetail {
  slug: string;
  name: string;
  url: string;
  address?: string;
  phone?: string;
  dimensions?: string;
  depth?: string;
  lanes?: string;
  programGuideUrl?: string;
  schedule: WeeklySchedule;
  closure: PoolClosureInfo;
  scheduleNotes: string[];
  status: PoolStatusInfo;
  swimScheduleEffectiveDate?: string;
  swimScheduleSourceUrl: string;
  closureScheduleSourceUrl: string;
  scrapedAt: string;
}

export interface PoolListResponse {
  scrapedAt: string;
  pools: PoolListItem[];
}

// Shape of the static data.json produced by `npm run scrape` (mirrors the
// server's ScrapeResult/PoolRecord types). The frontend fetches this file
// directly and computes everything else (status, filtering) itself.
export interface RawPoolRecord {
  slug: string;
  name: string;
  url: string;
  address?: string;
  phone?: string;
  dimensions?: string;
  depth?: string;
  lanes?: string;
  programGuideUrl?: string;
  schedule: WeeklySchedule;
  closure: PoolClosureInfo;
  scheduleNotes: string[];
}

export interface RawScrapeData {
  scrapedAt: string;
  swimScheduleEffectiveDate?: string;
  swimScheduleSourceUrl: string;
  closureScheduleSourceUrl: string;
  closureScheduleUpdated?: string;
  closureScheduleRange?: string;
  pools: RawPoolRecord[];
  warnings: string[];
}
