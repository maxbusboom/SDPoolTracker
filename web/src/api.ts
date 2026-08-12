import type { PoolDetail, PoolListItem, PoolListResponse, RawScrapeData } from "./types";
import { computePoolStatus } from "./status";

let dataPromise: Promise<RawScrapeData> | undefined;

function loadData(): Promise<RawScrapeData> {
  if (!dataPromise) {
    dataPromise = fetch(`${import.meta.env.BASE_URL}data.json`, { cache: "no-cache" }).then((res) => {
      if (!res.ok) {
        throw new Error(
          "No pool data found. Run `npm run scrape` to generate web/public/data.json before building/serving the site."
        );
      }
      return res.json();
    });
  }
  return dataPromise;
}

export async function fetchPools(): Promise<PoolListResponse> {
  const data = await loadData();
  const pools: PoolListItem[] = data.pools.map((pool) => ({
    slug: pool.slug,
    name: pool.name,
    address: pool.address,
    phone: pool.phone,
    status: computePoolStatus(pool),
  }));
  return { scrapedAt: data.scrapedAt, pools };
}

export async function fetchPool(slug: string): Promise<PoolDetail> {
  const data = await loadData();
  const pool = data.pools.find((p) => p.slug === slug);
  if (!pool) throw new Error("Pool not found");
  return {
    ...pool,
    status: computePoolStatus(pool),
    swimScheduleEffectiveDate: data.swimScheduleEffectiveDate,
    swimScheduleSourceUrl: data.swimScheduleSourceUrl,
    closureScheduleSourceUrl: data.closureScheduleSourceUrl,
    scrapedAt: data.scrapedAt,
  };
}
