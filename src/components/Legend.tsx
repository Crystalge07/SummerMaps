import type { PathSeries } from "@/lib/types";

export function Legend({ paths }: { paths: PathSeries[] }) {
  if (paths.length === 0) return null;
  return (
    <ul className="legend">
      {paths.map((p) => (
        <li key={p.deviceId}>
          <span className="swatch" style={{ background: p.color }} />
          <span>
            {p.label}
            <em>
              {p.checkins.length > 0
                ? `${p.checkins.length} stop${p.checkins.length === 1 ? "" : "s"}`
                : "No captures today"}
            </em>
          </span>
        </li>
      ))}
    </ul>
  );
}
