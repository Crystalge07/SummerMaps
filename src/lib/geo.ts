export type Coords = { lat: number; lng: number };

/**
 * STACKT market (28 Bathurst St, Toronto) — silent check-in fallback after GPS
 * fails (and one retry). Also used as the map default pin.
 */
export const STACKT_MARKET: Coords = { lat: 43.6407844, lng: -79.402045 };
export const STACKT_MARKET_NAME = "STACKT market";

/** Map init / demo seed — same pin as STACKT. */
export const CITY_CENTER: Coords = STACKT_MARKET;
export const FALLBACK_COORDS: Coords = STACKT_MARKET;

export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

/**
 * Best-effort permission pre-check.
 * Safari often lacks Permissions API support or throws — returns "unknown".
 */
export async function queryGeolocationPermission(): Promise<GeoPermission> {
  try {
    if (navigator.permissions?.query) {
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
    }
    return "unknown";
  } catch {
    // Safari may throw here
    return "unknown";
  }
}

/** Safari (incl. iOS) — used for location “How to enable” copy. */
export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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
  // 15s + high accuracy + no cache — required for reliable iOS Safari GPS
  const timeoutMs = options?.timeoutMs ?? 15000;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeoError("unsupported", "geolocation_unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => {
        // Messages stay internal — check-in never surfaces these; it falls back to STACKT.
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GeoError("denied", "geolocation_denied"));
          return;
        }
        if (err.code === err.TIMEOUT) {
          reject(new GeoError("timeout", "geolocation_timeout"));
          return;
        }
        reject(new GeoError("unavailable", "geolocation_unavailable"));
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

/** Coarse place label for pin details (avoids exact street-level coords). */
export function formatApproxLocation(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
}
