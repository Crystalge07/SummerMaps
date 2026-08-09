import type { CheckIn, PathSeries } from "./types";

export type LngLat = [number, number];

/**
 * Stable map display positions for every check-in.
 * Co-located finds fan out in chronological order so path lines can visit each stop.
 */
export function displayCoordsByCheckInId(
  paths: PathSeries[],
): Map<string, { lat: number; lng: number }> {
  const result = new Map<string, { lat: number; lng: number }>();

  for (const path of paths) {
    const checkins = [...path.checkins].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );

    const cellCounts = new Map<string, number>();
    for (const c of checkins) {
      const key = cellKey(c);
      cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
    }

    const cellIndex = new Map<string, number>();
    for (const c of checkins) {
      const key = cellKey(c);
      const n = cellCounts.get(key) ?? 1;
      const i = cellIndex.get(key) ?? 0;
      cellIndex.set(key, i + 1);

      if (n === 1) {
        result.set(c.id, { lat: c.lat, lng: c.lng });
        continue;
      }

      // ~15–40m fan so stacked demo/GPS pins stay distinct on the line.
      const radiusDeg = 0.00014 + Math.min(n, 8) * 0.000035;
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const cosLat = Math.cos((c.lat * Math.PI) / 180) || 1;
      result.set(c.id, {
        lat: c.lat + Math.sin(angle) * radiusDeg,
        lng: c.lng + (Math.cos(angle) * radiusDeg) / cosLat,
      });
    }
  }

  return result;
}

function cellKey(c: Pick<CheckIn, "lat" | "lng">) {
  return `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;
}

/** Samples per edge for curvedLineThrough — used to map stop index → curve index. */
export const CURVE_SEGMENTS_PER_EDGE = 14;

/** Curve vertex index for path stop `stopIndex` (0-based). */
export function curveStopIndex(
  stopIndex: number,
  segmentsPerEdge = CURVE_SEGMENTS_PER_EDGE,
): number {
  return Math.max(0, stopIndex) * segmentsPerEdge;
}

/** Prefix of a precomputed curve through the first `stopIndex` stops (inclusive). */
export function curveSliceToStop(
  fullCurve: LngLat[],
  stopIndex: number,
  segmentsPerEdge = CURVE_SEGMENTS_PER_EDGE,
): LngLat[] {
  if (fullCurve.length === 0 || stopIndex < 0) return [];
  const end = Math.min(
    fullCurve.length - 1,
    curveStopIndex(stopIndex, segmentsPerEdge),
  );
  return fullCurve.slice(0, end + 1);
}

/** Slice of a precomputed curve between two stop indices (inclusive). */
export function curveSliceBetweenStops(
  fullCurve: LngLat[],
  fromStop: number,
  toStop: number,
  segmentsPerEdge = CURVE_SEGMENTS_PER_EDGE,
): LngLat[] {
  if (fullCurve.length === 0 || toStop <= fromStop) return [];
  const a = curveStopIndex(fromStop, segmentsPerEdge);
  const b = Math.min(
    fullCurve.length - 1,
    curveStopIndex(toStop, segmentsPerEdge),
  );
  if (b <= a) return [];
  return fullCurve.slice(a, b + 1);
}

/** Catmull-Rom spline through stops (lng/lat), for a soft curved path. */
export function curvedLineThrough(
  coords: LngLat[],
  segmentsPerEdge = CURVE_SEGMENTS_PER_EDGE,
): LngLat[] {
  if (coords.length === 0) return [];
  if (coords.length === 1) return [coords[0]];
  if (coords.length === 2) {
    return bulgeCurve(coords[0], coords[1], segmentsPerEdge);
  }

  const out: LngLat[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const pts = curveSegment(p0, p1, p2, p3, segmentsPerEdge);
    // Avoid duplicating joints.
    out.push(...(i === 0 ? pts : pts.slice(1)));
  }
  return out;
}

function bulgeCurve(a: LngLat, b: LngLat, segments: number): LngLat[] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const bulge = 0.14;
  const cx = mx - (dy / len) * len * bulge;
  const cy = my + (dx / len) * len * bulge;
  const pts: LngLat[] = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const u = 1 - t;
    pts.push([
      u * u * a[0] + 2 * u * t * cx + t * t * b[0],
      u * u * a[1] + 2 * u * t * cy + t * t * b[1],
    ]);
  }
  return pts;
}

function curveSegment(
  p0: LngLat,
  p1: LngLat,
  p2: LngLat,
  p3: LngLat,
  segments: number,
): LngLat[] {
  const pts: LngLat[] = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    pts.push(catmullRom(p0, p1, p2, p3, t));
  }
  return pts;
}

function catmullRom(
  p0: LngLat,
  p1: LngLat,
  p2: LngLat,
  p3: LngLat,
  t: number,
): LngLat {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}
