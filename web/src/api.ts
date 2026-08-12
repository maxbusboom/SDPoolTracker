import type { PoolDetail, PoolListResponse } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchPools(): Promise<PoolListResponse> {
  return fetch("/api/pools").then((r) => json<PoolListResponse>(r));
}

export function fetchPool(slug: string): Promise<PoolDetail> {
  return fetch(`/api/pools/${slug}`).then((r) => json<PoolDetail>(r));
}
