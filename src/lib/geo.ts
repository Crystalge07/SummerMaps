export type Coords = { lat: number; lng: number };

/**
 * STACKT market (28 Bathurst St, Toronto) — explicit check-in escape hatch only.
 * Never use as a silent GPS fallback.
 */
export const STACKT_MARKET: Coords = { lat: 43.6407844, lng: -79.402045 };
export const STACKT_MARKET_NAME = "STACKT market";

/** Map init / demo seed — same pin as STACKT; never silent check-in fallback. */
export const CITY_CENTER: Coords = STACKT_MARKET;
export const FALLBACK_COORDS: Coords = STACKT_MARKET;

export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

/** Best-effort permission pre-check (Safari may return unknown). */
export async function queryGeolocationPermission(): Promise<GeoPermission> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const result = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    if (
      result.state === "granted" ||
      result.state === "denied" ||
      result.state === "prompt"
    ) {
      return result.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export type GeoErrorCode = "unsupported" | "denied" | "timeout" | "unavailable";

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.name = "GeoError";
    this.code = code;
  }
}

export function getCurrentPosition(options?: {
  timeoutMs?: number;
}): Promise<Coords> {
  const timeoutMs = options?.timeoutMs ?? 8000;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new GeoError(
          "unsupported",
          "Geolocation is not supported in this browser.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new GeoError(
              "denied",
              "Location access is needed to drop your pin.",
            ),
          );
          return;
        }
        if (err.code === err.TIMEOUT) {
          reject(
            new GeoError(
              "timeout",
              "Having trouble finding your location… Move to an area with better signal and try again.",
            ),
          );
          return;
        }
        reject(
          new GeoError(
            "unavailable",
            "Could not determine your location. Try again.",
          ),
        );
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 10000,
      },
    );
  });
}

/** Coarse place label for pin details (avoids exact street-level coords). */
export function formatApproxLocation(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
}
