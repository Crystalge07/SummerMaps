export type Coords = { lat: number; lng: number };

/** Default demo city: Toronto downtown. */
export const CITY_CENTER: Coords = { lat: 43.6532, lng: -79.3832 };

export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  });
}
