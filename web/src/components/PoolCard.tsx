import { Link } from "react-router-dom";
import type { PoolListItem, ProgramGuideStatus } from "../types";
import StatusBadge from "./StatusBadge";

export default function PoolCard({ pool }: { pool: PoolListItem }) {
  return (
    <Link to={`/pools/${pool.slug}`} className="pool-card">
      <div className="pool-card-top">
        <h2>{pool.name}</h2>
        <StatusBadge status={pool.status} />
      </div>
      {pool.status.status !== "maintenance-closed" && pool.todaysHours.length > 0 && (
        <div className="today-hours">
          <span className="today-hours-label">Today:</span>
          {pool.todaysHours[0]}
          {pool.todaysHours.slice(1).map((interval, i) => (
            <div key={i}>{interval}</div>
          ))}
        </div>
      )}
      {pool.address && <p className="muted">{pool.address}</p>}
      {pool.phone && <p className="muted">{pool.phone}</p>}
      {pool.programGuide && <ProgramGuideNote guide={pool.programGuide} />}
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ProgramGuideNote({ guide }: { guide: ProgramGuideStatus }) {
  if (guide.status === "ok") {
    return <p className="guide-note guide-ok">✓ Pool's program schedule read successfully</p>;
  }
  const fallback = "hours shown are from the citywide schedule";
  if (guide.status === "none") {
    return <p className="guide-note guide-none">No program schedule posted for this pool; {fallback}</p>;
  }
  return (
    <p className="guide-note guide-failed">
      ⚠ Couldn't read this pool's program schedule
      {guide.lastSuccessAt ? ` (last read ${formatDate(guide.lastSuccessAt)})` : " (no successful read on record)"}; {fallback}
    </p>
  );
}
