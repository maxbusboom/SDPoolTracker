import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPool } from "../api";
import type { PoolDetail } from "../types";
import StatusBadge from "../components/StatusBadge";
import ScheduleTable from "../components/ScheduleTable";

export default function PoolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setPool(null);
    fetchPool(slug).catch((err) => setError(err.message)).then((p) => p && setPool(p));
  }, [slug]);

  if (error) return <p className="error">Failed to load pool: {error}</p>;
  if (!pool) return <p className="muted">Loading…</p>;

  const closure = pool.closure;

  return (
    <div className="pool-detail">
      <Link to="/" className="back-link">
        ← All pools
      </Link>
      <div className="pool-detail-header">
        <h1>{pool.name}</h1>
        <StatusBadge status={pool.status} />
      </div>

      <div className="info-grid">
        {pool.address && (
          <div>
            <strong>Address</strong>
            <p>{pool.address}</p>
          </div>
        )}
        {pool.phone && (
          <div>
            <strong>Phone</strong>
            <p>{pool.phone}</p>
          </div>
        )}
        {pool.dimensions && (
          <div>
            <strong>Dimensions</strong>
            <p>{pool.dimensions}</p>
          </div>
        )}
        {pool.depth && (
          <div>
            <strong>Depth</strong>
            <p>{pool.depth}</p>
          </div>
        )}
        {pool.lanes && (
          <div>
            <strong>Lanes</strong>
            <p>{pool.lanes}</p>
          </div>
        )}
      </div>

      {pool.address && (
        <div className="map-links">
          {/*
            Both URLs are each platform's official "universal link" format
            (the same links Yelp/OpenTable-style "get directions" buttons
            use) — iOS/Android intercept them and open the native Google
            Maps / Apple Maps app directly if it's installed, falling back
            to the web map only when it isn't. Including the pool's name
            alongside its address (rather than just the bare address) lets
            each app resolve to the actual named venue instead of a plain
            street-address pin.
          */}
          <a
            className="map-button"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pool.name}, ${pool.address}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
          <a
            className="map-button"
            href={`https://maps.apple.com/?q=${encodeURIComponent(pool.name)}&address=${encodeURIComponent(pool.address)}`}
            target="_blank"
            rel="noreferrer"
          >
            Apple Maps
          </a>
        </div>
      )}

      {(closure.indefiniteClosure || closure.datedClosures.length > 0 || closure.note) && (
        <section className="closures">
          <h2>Maintenance Closures</h2>
          {closure.indefiniteClosure && (
            <p className="warning">
              {closure.indefiniteClosure.note}
              {closure.indefiniteClosure.projectedReopen && (
                <> — projected reopen {closure.indefiniteClosure.projectedReopen}.</>
              )}
            </p>
          )}
          {closure.datedClosures.length > 0 && (
            <ul className="closure-list">
              {closure.datedClosures.map((c) => (
                <li key={c.date}>{c.date}</li>
              ))}
            </ul>
          )}
          {closure.note && <p className="muted">{closure.note}</p>}
        </section>
      )}

      <section>
        <h2>Weekly Schedule</h2>
        <ScheduleTable schedule={pool.schedule} />
        {pool.scheduleNotes.length > 0 && (
          <ul className="notes-list">
            {pool.scheduleNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        {pool.swimScheduleEffectiveDate && (
          <p className="muted small">Schedule effective {pool.swimScheduleEffectiveDate}</p>
        )}
      </section>

      <section className="sources">
        <h2>Sources</h2>
        <ul>
          <li>
            <a href={pool.url} target="_blank" rel="noreferrer">
              Official pool page
            </a>
          </li>
          {pool.programGuideUrl && (
            <li>
              <a href={pool.programGuideUrl} target="_blank" rel="noreferrer">
                Program guide (PDF)
              </a>
            </li>
          )}
          <li>
            <a href={pool.swimScheduleSourceUrl} target="_blank" rel="noreferrer">
              Citywide swim schedule (PDF)
            </a>
          </li>
          <li>
            <a href={pool.closureScheduleSourceUrl} target="_blank" rel="noreferrer">
              Maintenance closure schedule (PDF)
            </a>
          </li>
        </ul>
        <p className="muted small">Data last scraped {new Date(pool.scrapedAt).toLocaleString()}</p>
      </section>
    </div>
  );
}
