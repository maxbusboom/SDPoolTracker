import type { DayKey, ProgramType, WeeklySchedule } from "../types";

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const PROGRAM_LABELS: Record<ProgramType, string> = {
  lapSwim: "Lap Swim",
  recSwim: "Recreational Swim",
  waterFitness: "Water Fitness",
};

export default function ScheduleTable({ schedule }: { schedule: WeeklySchedule }) {
  const programs = (Object.keys(PROGRAM_LABELS) as ProgramType[]).filter((p) =>
    DAYS.some((d) => schedule[p][d.key].length > 0)
  );

  if (programs.length === 0) {
    return <p className="muted">No schedule data available for this pool.</p>;
  }

  return (
    <div className="schedule-scroll">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Program</th>
            {DAYS.map((d) => (
              <th key={d.key}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr key={program}>
              <td className="program-name">{PROGRAM_LABELS[program]}</td>
              {DAYS.map((d) => (
                <td key={d.key}>
                  {schedule[program][d.key].length === 0
                    ? "—"
                    : schedule[program][d.key].map((r, i) => <div key={i}>{r.label}</div>)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
