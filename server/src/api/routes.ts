import { Router } from "express";
import { getCache, refreshCache } from "../cacheStore.js";
import { computePoolStatus, getPacificNow } from "../status/isOpen.js";

export const router = Router();

router.get("/pools", (_req, res) => {
  const cache = getCache();
  if (!cache) {
    return res.status(503).json({ error: "No scrape data available yet. Try POST /api/refresh." });
  }
  const now = getPacificNow();
  const pools = cache.pools.map((pool) => ({
    slug: pool.slug,
    name: pool.name,
    address: pool.address,
    phone: pool.phone,
    status: computePoolStatus(pool, now),
  }));
  res.json({
    scrapedAt: cache.scrapedAt,
    pools,
  });
});

router.get("/pools/:slug", (req, res) => {
  const cache = getCache();
  if (!cache) {
    return res.status(503).json({ error: "No scrape data available yet. Try POST /api/refresh." });
  }
  const pool = cache.pools.find((p) => p.slug === req.params.slug);
  if (!pool) return res.status(404).json({ error: "Pool not found" });
  const status = computePoolStatus(pool);
  res.json({
    ...pool,
    status,
    swimScheduleEffectiveDate: cache.swimScheduleEffectiveDate,
    swimScheduleSourceUrl: cache.swimScheduleSourceUrl,
    closureScheduleSourceUrl: cache.closureScheduleSourceUrl,
    scrapedAt: cache.scrapedAt,
  });
});

router.get("/meta", (_req, res) => {
  const cache = getCache();
  if (!cache) return res.status(503).json({ error: "No scrape data available yet." });
  res.json({
    scrapedAt: cache.scrapedAt,
    swimScheduleEffectiveDate: cache.swimScheduleEffectiveDate,
    swimScheduleSourceUrl: cache.swimScheduleSourceUrl,
    closureScheduleSourceUrl: cache.closureScheduleSourceUrl,
    closureScheduleUpdated: cache.closureScheduleUpdated,
    closureScheduleRange: cache.closureScheduleRange,
    warnings: cache.warnings,
  });
});

router.post("/refresh", async (_req, res) => {
  try {
    const result = await refreshCache();
    res.json({ scrapedAt: result.scrapedAt, poolCount: result.pools.length, warnings: result.warnings });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
