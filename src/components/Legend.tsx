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
            <em>{p.checkins.length} stops</em>
          </span>
        </li>
      ))}
    </ul>
  );
}
