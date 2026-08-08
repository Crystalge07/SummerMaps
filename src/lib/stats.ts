import type { CheckIn } from "./types";

/** Hourly distribution for today — always returns 24 buckets (0–23). */
export function hourlyDistribution(checkins: CheckIn[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour}:00`,
    count: 0,
  }));
  for (const c of checkins) {
    buckets[new Date(c.created_at).getHours()].count += 1;
  }
  return buckets;
}

export type DensityCell = {
  key: string;
  lat: number;
  lng: number;
  count: number;
};

/** Cluster check-ins on rounded lat/lng cells (≈1km at mid latitudes). */
export function densestCells(checkins: CheckIn[], limit = 5): DensityCell[] {
  const cells = new Map<string, DensityCell>();
  for (const c of checkins) {
    const lat = Number(c.lat.toFixed(2));
    const lng = Number(c.lng.toFixed(2));
    const key = `${lat},${lng}`;
    const existing = cells.get(key);
    if (existing) existing.count += 1;
    else cells.set(key, { key, lat, lng, count: 1 });
  }
  return Array.from(cells.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
