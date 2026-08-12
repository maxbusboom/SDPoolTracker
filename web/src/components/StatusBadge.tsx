import type { PoolStatusInfo } from "../types";

const COLORS: Record<PoolStatusInfo["status"], string> = {
  open: "status-open",
  closed: "status-closed",
  "maintenance-closed": "status-maintenance",
  unknown: "status-unknown",
};

export default function StatusBadge({ status }: { status: PoolStatusInfo }) {
  return <span className={`status-badge ${COLORS[status.status]}`}>{status.label}</span>;
}
