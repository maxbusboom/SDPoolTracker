import { fetchPoolsPageData } from "./fetchPoolList.js";
import { fetchPoolPage } from "./fetchPoolPage.js";
import { fetchBuffer } from "./fetchHtml.js";
import { parseClosureSchedule } from "./parseClosureSchedule.js";
import { parseSwimSchedule } from "./parseSwimSchedule.js";
import { parseProgramGuide, type PartialSchedule } from "./parseProgramGuide.js";
import type { DayKey, PoolRecord, ProgramGuideStatus, ProgramType, ScrapeResult } from "../types.js";

/**
 * `previous` is the last scrape's result, if available; it's only used to
 * carry forward when each pool's program guide was last read successfully.
 */
export async function runScrape(previous?: ScrapeResult): Promise<ScrapeResult> {
  const warnings: string[] = [];
  const scrapedAt = new Date().toISOString();
  const previousBySlug = new Map((previous?.pools ?? []).map((p) => [p.slug, p]));

  const { pools: poolListings, closureScheduleUrl, swimScheduleUrl } = await fetchPoolsPageData();

  const [poolInfos, closureBuffer, swimBuffer] = await Promise.all([
    Promise.all(
      poolListings.map(async (listing) => {
        try {
          return await fetchPoolPage(listing);
        } catch (err) {
          warnings.push(`Failed to fetch pool page ${listing.url}: ${(err as Error).message}`);
          return { slug: listing.slug, name: listing.name, url: listing.url };
        }
      })
    ),
    fetchBuffer(closureScheduleUrl),
    fetchBuffer(swimScheduleUrl),
  ]);

  const [closureResult, swimResult, programGuideResults] = await Promise.all([
    parseClosureSchedule(closureBuffer, poolListings),
    parseSwimSchedule(swimBuffer, poolListings),
    // Per-pool Program Guide PDFs take priority over the citywide combined
    // schedule for Lap Swim / Rec Swim wherever they specify a day (see
    // parseProgramGuide.ts). Fetched per-pool since each pool links its own.
    Promise.all(
      poolInfos.map(async (info) => {
        if (!info.programGuideUrl) return { slug: info.slug, schedule: {} as PartialSchedule, warnings: [] };
        try {
          const buf = await fetchBuffer(info.programGuideUrl);
          const result = await parseProgramGuide(buf, info.name);
          return { slug: info.slug, ...result };
        } catch (err) {
          return {
            slug: info.slug,
            schedule: {} as PartialSchedule,
            warnings: [`Failed to fetch/parse program guide for ${info.name}: ${(err as Error).message}`],
          };
        }
      })
    ),
  ]);
  warnings.push(...closureResult.warnings, ...swimResult.warnings);
  for (const r of programGuideResults) warnings.push(...r.warnings);
  const programGuideBySlug = new Map(programGuideResults.map((r) => [r.slug, r.schedule]));

  const pools: PoolRecord[] = poolInfos.map((info) => {
    const schedule = swimResult.schedules.get(info.slug) ?? emptySchedule();
    const closure = closureResult.closures.get(info.slug) ?? { datedClosures: [] };
    const scheduleNotes = swimResult.poolNotes.get(info.slug) ?? [];
    if (!swimResult.schedules.get(info.slug)) {
      warnings.push(`No swim schedule data matched for pool "${info.name}" (${info.slug})`);
    }

    const guideSchedule = programGuideBySlug.get(info.slug);
    if (guideSchedule) {
      for (const program of Object.keys(guideSchedule) as ProgramType[]) {
        const guideDays = guideSchedule[program];
        if (!guideDays) continue;
        for (const day of Object.keys(guideDays) as DayKey[]) {
          const ranges = guideDays[day];
          if (ranges) schedule[program][day] = ranges;
        }
      }
    }

    const programGuide = programGuideStatus(info.programGuideUrl, guideSchedule, scrapedAt, previousBySlug.get(info.slug));

    return { ...info, schedule, closure, scheduleNotes, programGuide };
  });

  return {
    scrapedAt,
    swimScheduleEffectiveDate: swimResult.effectiveDate,
    swimScheduleSourceUrl: swimScheduleUrl,
    closureScheduleSourceUrl: closureScheduleUrl,
    closureScheduleUpdated: closureResult.scheduleUpdated,
    closureScheduleRange: closureResult.scheduleRange,
    pools,
    warnings: [...warnings, ...swimResult.globalNotes.map((n) => `Global schedule note: ${n}`)],
  };
}

function programGuideStatus(
  guideUrl: string | undefined,
  guideSchedule: PartialSchedule | undefined,
  scrapedAt: string,
  previousPool: PoolRecord | undefined
): ProgramGuideStatus {
  if (guideSchedule && Object.keys(guideSchedule).length > 0) return { status: "ok", lastSuccessAt: scrapedAt };
  // Older data files predate programGuide, so it may be missing.
  const lastSuccessAt = previousPool?.programGuide?.lastSuccessAt;
  return { status: guideUrl ? "failed" : "none", lastSuccessAt };
}

function emptySchedule(): PoolRecord["schedule"] {
  const programs = ["lapSwim", "recSwim", "waterFitness"] as const;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const schedule = {} as PoolRecord["schedule"];
  for (const program of programs) {
    schedule[program] = {} as (typeof schedule)[typeof program];
    for (const day of days) schedule[program][day] = [];
  }
  return schedule;
}
