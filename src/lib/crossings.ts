import type { CheckIn, PathSeries } from "./types";

export type PathCrossing = {
  aDeviceId: string;
  bDeviceId: string;
  lat: number;
  lng: number;
  timeA: string;
  timeB: string;
};

const EARTH_KM = 6371;

function haversineKm(a: CheckIn, b: CheckIn) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Flag pairs of check-ins within ~150m and 45 minutes of each other. */
export function detectCrossings(
  paths: PathSeries[],
  maxKm = 0.15,
  maxMinutes = 45,
): PathCrossing[] {
  const crossings: PathCrossing[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const aPath = paths[i];
      const bPath = paths[j];
      for (const a of aPath.checkins) {
        for (const b of bPath.checkins) {
          const minutes =
            Math.abs(
              new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            ) /
            60000;
          if (minutes > maxMinutes) continue;
          if (haversineKm(a, b) <= maxKm) {
            crossings.push({
              aDeviceId: aPath.deviceId,
              bDeviceId: bPath.deviceId,
              lat: (a.lat + b.lat) / 2,
              lng: (a.lng + b.lng) / 2,
              timeA: a.created_at,
              timeB: b.created_at,
            });
          }
        }
      }
    }
  }
  return crossings;
}
