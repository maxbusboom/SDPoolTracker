import { Link } from "react-router-dom";
import type { PoolListItem } from "../types";
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
    </Link>
  );
}
