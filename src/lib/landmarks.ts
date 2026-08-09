export type Landmark = {
  name: string;
  lat: number;
  lng: number;
};

/** Major Toronto landmarks for “near …” copy — not street-level. */
export const TORONTO_LANDMARKS: Landmark[] = [
  { name: "the CN Tower", lat: 43.6426, lng: -79.3871 },
  { name: "Rogers Centre", lat: 43.6414, lng: -79.3894 },
  { name: "Union Station", lat: 43.6453, lng: -79.3806 },
  { name: "Eaton Centre", lat: 43.6544, lng: -79.3807 },
  { name: "Yonge-Dundas Square", lat: 43.6561, lng: -79.3802 },
  { name: "U of T St. George", lat: 43.6629, lng: -79.3957 },
  { name: "Queen's Park", lat: 43.6629, lng: -79.3923 },
  { name: "Yorkville", lat: 43.6701, lng: -79.3936 },
  { name: "Kensington Market", lat: 43.6548, lng: -79.4005 },
  { name: "Queen West", lat: 43.6488, lng: -79.3975 },
  { name: "Trinity Bellwoods", lat: 43.6472, lng: -79.4138 },
  { name: "St. Lawrence Market", lat: 43.6487, lng: -79.3715 },
  { name: "the Distillery District", lat: 43.6503, lng: -79.3595 },
  { name: "Harbourfront", lat: 43.6387, lng: -79.3816 },
  { name: "the Waterfront", lat: 43.6408, lng: -79.3774 },
  { name: "Cabbagetown", lat: 43.6662, lng: -79.3634 },
  { name: "the Annex", lat: 43.6701, lng: -79.4045 },
  { name: "Chinatown", lat: 43.6527, lng: -79.3981 },
  { name: "Nathan Phillips Square", lat: 43.6525, lng: -79.3836 },
  { name: "Osgoode Hall", lat: 43.6518, lng: -79.3861 },
  { name: "Art Gallery of Ontario", lat: 43.6536, lng: -79.3925 },
  { name: "High Park", lat: 43.6465, lng: -79.4637 },
  { name: "the Beaches", lat: 43.6677, lng: -79.2967 },
  { name: "Liberty Village", lat: 43.6383, lng: -79.4205 },
  { name: "the Financial District", lat: 43.6486, lng: -79.3817 },
  { name: "STACKT Market", lat: 43.6415, lng: -79.4022 },
  { name: "King West", lat: 43.645, lng: -79.402 },
  { name: "Roncesvalles", lat: 43.6492, lng: -79.4504 },
  { name: "Little Italy", lat: 43.6554, lng: -79.4198 },
  { name: "Leslieville", lat: 43.6625, lng: -79.337 },
  { name: "Riverdale", lat: 43.668, lng: -79.351 },
  { name: "Danforth", lat: 43.6784, lng: -79.345 },
  { name: "North York Centre", lat: 43.768, lng: -79.413 },
  { name: "Downsview", lat: 43.75, lng: -79.479 },
  { name: "York University", lat: 43.7735, lng: -79.5019 },
  { name: "Vaughan", lat: 43.856, lng: -79.508 },
  { name: "Canada's Wonderland", lat: 43.843, lng: -79.542 },
  { name: "Scarborough Town Centre", lat: 43.7764, lng: -79.258 },
  { name: "Mississauga City Centre", lat: 43.593, lng: -79.644 },
];

const EARTH_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Nearest landmark within maxKm, or null if nothing close enough. */
export function nearestLandmark(
  lat: number,
  lng: number,
  maxKm = 2.8,
): Landmark | null {
  let best: Landmark | null = null;
  let bestKm = Infinity;
  for (const landmark of TORONTO_LANDMARKS) {
    const km = haversineKm(lat, lng, landmark.lat, landmark.lng);
    if (km < bestKm) {
      bestKm = km;
      best = landmark;
    }
  }
  if (!best || bestKm > maxKm) return null;
  return best;
}

/**
 * Short place people would recognize — for lists like densest areas.
 * Prefers landmark, then a stored place name, else a soft nearby fallback.
 */
export function areaLabel(
  lat: number,
  lng: number,
  fallbackPlace?: string | null,
  maxKm = 8,
): string {
  const landmark = nearestLandmark(lat, lng, maxKm);
  if (landmark) return landmark.name;
  const place = fallbackPlace?.trim();
  if (place) return place;
  return "the city";
}

/** Insights feed line for a capture. */
export function captureMomentNearLabel(
  lat: number,
  lng: number,
  fallbackPlace?: string | null,
): string {
  const landmark = nearestLandmark(lat, lng);
  if (landmark) {
    return `Someone captured a moment near ${landmark.name}`;
  }
  const place = fallbackPlace?.trim();
  if (place) {
    return `Someone captured a moment near ${place}`;
  }
  return "Someone captured a moment nearby";
}
