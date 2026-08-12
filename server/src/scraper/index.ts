import { fetchPoolsPageData } from "./fetchPoolList.js";
import { fetchPoolPage } from "./fetchPoolPage.js";
import { fetchBuffer } from "./fetchHtml.js";
import { parseClosureSchedule } from "./parseClosureSchedule.js";
import { parseSwimSchedule } from "./parseSwimSchedule.js";
import type { PoolRecord, ScrapeResult } from "../types.js";

export async function runScrape(): Promise<ScrapeResult> {
  const warnings: string[] = [];

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

  const [closureResult, swimResult] = await Promise.all([
    parseClosureSchedule(closureBuffer, poolListings),
    parseSwimSchedule(swimBuffer, poolListings),
  ]);
  warnings.push(...closureResult.warnings, ...swimResult.warnings);

  const pools: PoolRecord[] = poolInfos.map((info) => {
    const schedule = swimResult.schedules.get(info.slug);
    const closure = closureResult.closures.get(info.slug) ?? { datedClosures: [] };
    const scheduleNotes = swimResult.poolNotes.get(info.slug) ?? [];
    if (!schedule) {
      warnings.push(`No swim schedule data matched for pool "${info.name}" (${info.slug})`);
    }
    return {
      ...info,
      schedule: schedule ?? emptySchedule(),
      closure,
      scheduleNotes,
    };
  });

  return {
    scrapedAt: new Date().toISOString(),
    swimScheduleEffectiveDate: swimResult.effectiveDate,
    swimScheduleSourceUrl: swimScheduleUrl,
    closureScheduleSourceUrl: closureScheduleUrl,
    closureScheduleUpdated: closureResult.scheduleUpdated,
    closureScheduleRange: closureResult.scheduleRange,
    pools,
    warnings: [...warnings, ...swimResult.globalNotes.map((n) => `Global schedule note: ${n}`)],
  };
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
