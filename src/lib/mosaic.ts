import { dayKey, getTodaysPrompt } from "./prompts";
import type { CheckIn } from "./types";

/** Local hour when today's mosaic locks (no more photos added). */
export const MOSAIC_CUTOFF_HOUR = 21;

export type MosaicDay = {
  dayKey: string;
  prompt: string;
  checkins: CheckIn[];
  /** True once the day has passed the cutoff (or is a past day). */
  locked: boolean;
};

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Midnight → cutoff for a local calendar day. Photos at/after cutoff are excluded. */
export function mosaicWindowForDay(key: string): { start: Date; end: Date } {
  const start = parseDayKey(key);
  start.setHours(0, 0, 0, 0);
  const end = parseDayKey(key);
  end.setHours(MOSAIC_CUTOFF_HOUR, 0, 0, 0);
  return { start, end };
}

export function isAfterMosaicCutoff(now = new Date()): boolean {
  return now.getHours() >= MOSAIC_CUTOFF_HOUR;
}

/** Locked = past days, or today at/after the cutoff. */
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
 * Today is included while live (before cutoff) and after lock.
 * Only photos before the day's cutoff hour are eligible.
 */
export function buildMosaicDays(
  checkins: CheckIn[],
  now = new Date(),
): MosaicDay[] {
  const byDay = new Map<string, CheckIn[]>();
  const today = dayKey(now);

  for (const c of checkins) {
    const key = dayKey(new Date(c.created_at));
    if (key > today) continue;
    const list = byDay.get(key) ?? [];
    list.push(c);
    byDay.set(key, list);
  }

  const days: MosaicDay[] = [];
  for (const [key, rows] of byDay) {
    const eligible = rows
      .filter((c) => isEligibleForDayMosaic(c, key))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (eligible.length === 0) continue;
    days.push({
      dayKey: key,
      prompt: getTodaysPrompt(parseDayKey(key)),
      checkins: eligible,
      locked: isMosaicLocked(key, now),
    });
  }

  return days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
}

/** Once-per-day flag for the "check out today's mosaic" prompt after lock. */
export function mosaicLockNotifKey(key: string) {
  return `pathline_mosaic_lock_notif_${key}`;
}
