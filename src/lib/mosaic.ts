import {
  dayKey,
  getPromptForDayKey,
  isAfterMosaicCutoff,
  MOSAIC_CUTOFF_HOUR,
  mosaicWindowForDayKey,
} from "./prompts";
import type { CheckIn } from "./types";

export { MOSAIC_CUTOFF_HOUR, isAfterMosaicCutoff };

export type MosaicDay = {
  dayKey: string;
  prompt: string;
  checkins: CheckIn[];
  /** True once the day has passed the cutoff (or is a past day). */
  locked: boolean;
};

/** Local calendar date at noon for display labels (avoids TZ shift). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Previous 10pm ET → this day's 10pm ET. Photos at/after end belong to the next day. */
export function mosaicWindowForDay(key: string): { start: Date; end: Date } {
  return mosaicWindowForDayKey(key);
}

/** Locked = past mosaic days, or today's key at/after the 10pm ET cutoff. */
export function isMosaicLocked(key: string, now = new Date()): boolean {
  const today = dayKey(now);
  if (key < today) return true;
  if (key > today) return false;
  return isAfterMosaicCutoff(now);
}

export function isEligibleForDayMosaic(
  checkIn: CheckIn,
  key: string,
): boolean {
  const { start, end } = mosaicWindowForDay(key);
  const t = new Date(checkIn.created_at).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Near-square grid that can fill a viewport. */
export function mosaicGridDims(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 0, rows: 0 };
  if (count === 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/** Column spans for the last row so the grid has no empty cells. */
export function lastRowSpans(itemCount: number, cols: number): number[] {
  if (itemCount <= 0) return [];
  if (itemCount >= cols) return Array.from({ length: cols }, () => 1);
  const base = Math.floor(cols / itemCount);
  let extra = cols % itemCount;
  return Array.from({ length: itemCount }, () => {
    const span = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return span;
  });
}

/**
 * Group all city finds into shared mosaic days (everyone, not per-user).
 * Day membership uses the 10pm ET boundary via dayKey().
 */
export function buildMosaicDays(
  checkins: CheckIn[],
  now = new Date(),
): MosaicDay[] {
  const byDay = new Map<string, CheckIn[]>();
  const today = dayKey(now);

  for (const c of checkins) {
    if (!c.photo_url?.trim()) continue;
    const key = dayKey(new Date(c.created_at));
    if (key > today) continue;
    const list = byDay.get(key) ?? [];
    list.push(c);
    byDay.set(key, list);
  }

  const days: MosaicDay[] = [];
  for (const [key, rows] of byDay) {
    const photos = [...rows].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    if (photos.length === 0) continue;
    days.push({
      dayKey: key,
      prompt: getPromptForDayKey(key),
      checkins: photos,
      locked: isMosaicLocked(key, now),
    });
  }

  return days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** Once-per-day flag for the "check out today's mosaic" prompt after lock. */
export function mosaicLockNotifKey(key: string) {
  return `pathline_mosaic_lock_notif_${key}`;
}
