import { fetchPoolsPageData } from "./fetchPoolList.js";
import { fetchPoolPage, type PoolPageInfo } from "./fetchPoolPage.js";
import { fetchBuffer, fetchHead } from "./fetchHtml.js";
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
          return { slug: listing.slug, name: listing.name, url: listing.url, programGuideCandidates: [] };
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
    Promise.all(poolInfos.map((info) => scrapeProgramGuide(info))),
  ]);
  warnings.push(...closureResult.warnings, ...swimResult.warnings);
  for (const r of programGuideResults) warnings.push(...r.warnings);
  const programGuideBySlug = new Map(programGuideResults.map((r) => [r.slug, r]));

  const pools: PoolRecord[] = poolInfos.map((info) => {
    const schedule = swimResult.schedules.get(info.slug) ?? emptySchedule();
    const closure = closureResult.closures.get(info.slug) ?? { datedClosures: [] };
    const scheduleNotes = swimResult.poolNotes.get(info.slug) ?? [];
    if (!swimResult.schedules.get(info.slug)) {
      warnings.push(`No swim schedule data matched for pool "${info.name}" (${info.slug})`);
    }

    const guideResult = programGuideBySlug.get(info.slug);
    const guideSchedule = guideResult?.schedule;
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

    const programGuide = programGuideStatus(guideResult, scrapedAt, previousBySlug.get(info.slug));

    // Candidates are a scrape-internal detail; the record carries only the
    // guide that was actually used (or the best-ranked one, if none parsed).
    const { programGuideCandidates, ...poolInfo } = info;
    return { ...poolInfo, programGuideUrl: programGuide.sourceUrl, schedule, closure, scheduleNotes, programGuide };
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

interface ProgramGuideScrape {
  slug: string;
  schedule: PartialSchedule;
  warnings: string[];
  /** The candidate that parsed (or, if none did, the freshest candidate) */
  sourceUrl?: string;
  /** That candidate's HTTP Last-Modified */
  updatedAt?: string;
  hadCandidates: boolean;
}

/**
 * Fetches and parses a pool's program guide, choosing among every guide PDF
 * its page links. Candidates are ranked by the file's HTTP Last-Modified
 * (newest first) because the city updates these PDFs in place — the "YYYY-MM"
 * in the URL path is just the original upload month, and a "2024-04" file is
 * often the freshest. Candidates are then tried in order until one yields a
 * schedule, so a broken upload (e.g. a text-free scan) doesn't take the pool
 * down with it as long as another linked guide parses.
 */
async function scrapeProgramGuide(info: PoolPageInfo): Promise<ProgramGuideScrape> {
  const base: ProgramGuideScrape = {
    slug: info.slug,
    schedule: {},
    warnings: [],
    hadCandidates: info.programGuideCandidates.length > 0,
  };
  if (!base.hadCandidates) return base;

  const heads = await Promise.all(info.programGuideCandidates.map((url) => fetchHead(url)));
  const ranked = info.programGuideCandidates
    .map((url, i) => ({ url, lastModified: heads[i].lastModified }))
    .sort((a, b) => {
      if (a.lastModified && b.lastModified) return b.lastModified.getTime() - a.lastModified.getTime();
      if (a.lastModified || b.lastModified) return a.lastModified ? -1 : 1;
      // Neither has a Last-Modified header: fall back to the path's upload month.
      const pathDate = (u: string) => u.match(/(\d{4}-\d{2})/)?.[1] ?? "";
      return pathDate(b.url).localeCompare(pathDate(a.url));
    });

  for (const candidate of ranked) {
    try {
      const buf = await fetchBuffer(candidate.url);
      const result = await parseProgramGuide(buf, info.name);
      if (Object.keys(result.schedule).length > 0) {
        return {
          ...base,
          schedule: result.schedule,
          // Warnings from failed candidates are dropped once one parses — a
          // stale season's broken PDF isn't actionable when a good one exists.
          warnings: result.warnings,
          sourceUrl: candidate.url,
          updatedAt: candidate.lastModified?.toISOString(),
        };
      }
      base.warnings.push(...result.warnings);
    } catch (err) {
      base.warnings.push(`Failed to fetch/parse program guide for ${info.name} (${candidate.url}): ${(err as Error).message}`);
    }
  }

  // Nothing parsed; point at the freshest candidate so the UI can still link it.
  return { ...base, sourceUrl: ranked[0].url, updatedAt: ranked[0].lastModified?.toISOString() };
}

function programGuideStatus(
  guideResult: ProgramGuideScrape | undefined,
  scrapedAt: string,
  previousPool: PoolRecord | undefined
): ProgramGuideStatus {
  const sourceUrl = guideResult?.sourceUrl;
  const updatedAt = guideResult?.updatedAt;
  if (guideResult && Object.keys(guideResult.schedule).length > 0) {
    return { status: "ok", lastSuccessAt: scrapedAt, sourceUrl, updatedAt };
  }
  // Older data files predate programGuide, so it may be missing.
  const lastSuccessAt = previousPool?.programGuide?.lastSuccessAt;
  return { status: guideResult?.hadCandidates ? "failed" : "none", lastSuccessAt, sourceUrl, updatedAt };
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
