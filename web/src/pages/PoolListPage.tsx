import { useEffect, useMemo, useState } from "react";
import { fetchPools } from "../api";
import type { PoolListItem } from "../types";
import PoolCard from "../components/PoolCard";

export default function PoolListPage() {
  const [pools, setPools] = useState<PoolListItem[] | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  useEffect(() => {
    fetchPools()
      .then((res) => {
        setPools(res.pools);
        setScrapedAt(res.scrapedAt);
      })
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!pools) return [];
    return pools
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => !onlyOpen || p.status.status === "open");
  }, [pools, query, onlyOpen]);

  if (error) return <p className="error">Failed to load pools: {error}</p>;
  if (!pools) return <p className="muted">Loading pools…</p>;

  return (
    <div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search pools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="checkbox">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Open now only
        </label>
      </div>
      {scrapedAt && (
        <p className="muted small">Last updated {new Date(scrapedAt).toLocaleString()}</p>
      )}
      <div className="pool-grid">
        {filtered.map((pool) => (
          <PoolCard key={pool.slug} pool={pool} />
        ))}
      </div>
      {filtered.length === 0 && <p className="muted">No pools match.</p>}
    </div>
  );
}
