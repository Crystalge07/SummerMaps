/** Shared daily prompts — everyone sees the same one for a given mosaic day. */

/**
 * Mosaic days run on America/New_York time and roll at 10pm.
 * A capture at/after 10pm ET belongs to the next calendar day's mosaic.
 */
export const MOSAIC_TIMEZONE = "America/New_York";
export const MOSAIC_CUTOFF_HOUR = 22;

const PROMPTS = [
  "purple",
  "cool sneakers",
  "wings",
  "something yellow",
  "handwritten signs",
  "reflections",
  "circles in the wild",
  "plants growing where they shouldn't",
  "stripes",
  "tiny doors",
  "shadows that look like animals",
  "blue things that aren't the sky",
  "old stickers",
  "people waiting",
  "windows with stories",
  "unexpected green",
  "wheels",
  "things that glow",
  "pairs of two",
  "soft edges",
  "numbers in the street",
  "something that made you smile",
  "patterns repeating",
  "quiet corners",
  "things that fly",
  "orange accents",
  "worn paint",
  "found geometry",
  "water nearby",
  "a small kindness",
  "textures you'd want to touch",
  "transitions",
  "hidden beauty",
  "warmth",
  "hidden beauties",
];

/** Pin a specific mosaic day to a prompt (YYYY-MM-DD → prompt). */
const PROMPT_OVERRIDES: Record<string, string> = {
  "2026-08-08": "warmth",
  "2026-08-09": "hidden beauties",
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone = MOSAIC_TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta, 12));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

/** Convert a wall-clock time in MOSAIC_TIMEZONE to a UTC Date. */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): Date {
  let ms = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(new Date(ms));
    const asLocal = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = desired - asLocal;
    if (delta === 0) break;
    ms += delta;
  }
  return new Date(ms);
}

/**
 * Mosaic day key for an instant (YYYY-MM-DD).
 * At/after 10pm ET, the key advances to the next calendar day.
 */
export function dayKey(date = new Date()): string {
  const p = zonedParts(date);
  if (p.hour >= MOSAIC_CUTOFF_HOUR) {
    const next = addCalendarDays(p.year, p.month, p.day, 1);
    return formatDayKey(next.year, next.month, next.day);
  }
  return formatDayKey(p.year, p.month, p.day);
}

/**
 * Half-open window for a mosaic day key: previous 10pm ET → this day's 10pm ET.
 * Example: 2026-08-09 → [2026-08-08 22:00 ET, 2026-08-09 22:00 ET).
 */
export function mosaicWindowForDayKey(key: string): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number);
  const end = zonedWallTimeToUtc(y, m, d, MOSAIC_CUTOFF_HOUR);
  const prev = addCalendarDays(y, m, d, -1);
  const start = zonedWallTimeToUtc(
    prev.year,
    prev.month,
    prev.day,
    MOSAIC_CUTOFF_HOUR,
  );
  return { start, end };
}

/** ISO bounds for the mosaic day that contains `date` (default: now). */
export function mosaicDayBoundsISO(date = new Date()): {
  start: string;
  end: string;
} {
  const { start, end } = mosaicWindowForDayKey(dayKey(date));
  // end is exclusive in window logic; queries use inclusive end → 1ms before.
  return {
    start: start.toISOString(),
    end: new Date(end.getTime() - 1).toISOString(),
  };
}

export function isAfterMosaicCutoff(now = new Date()): boolean {
  return zonedParts(now).hour >= MOSAIC_CUTOFF_HOUR;
}

function hashDay(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getPromptForDayKey(key: string): string {
  if (PROMPT_OVERRIDES[key]) return PROMPT_OVERRIDES[key];
  return PROMPTS[hashDay(key) % PROMPTS.length];
}

export function getTodaysPrompt(date = new Date()): string {
  return getPromptForDayKey(dayKey(date));
}

/** Theme for a capture's mosaic day (ignores stale stored prompt snapshots). */
export function promptForCheckIn(createdAt: string | Date): string {
  return getPromptForDayKey(dayKey(new Date(createdAt)));
}

/**
 * Display timestamp for a capture.
 * Finds taken after 10pm ET (carryover into the next mosaic day) are shown as
 * that mosaic day between 1:00 AM and 10:00 AM ET, mapped in real order
 * (earlier late-night find → earlier morning display time).
 */
export function displayCreatedAt(createdAt: string | Date): Date {
  const date = new Date(createdAt);
  const mosaic = dayKey(date);
  const cal = zonedParts(date);
  const calendarKey = formatDayKey(cal.year, cal.month, cal.day);
  if (calendarKey === mosaic) return date;

  const [y, m, d] = mosaic.split("-").map(Number);
  const prev = addCalendarDays(y, m, d, -1);
  // Real carryover window: previous day 10pm ET → mosaic-day midnight ET.
  const carryStart = zonedWallTimeToUtc(
    prev.year,
    prev.month,
    prev.day,
    MOSAIC_CUTOFF_HOUR,
  );
  const carryEnd = zonedWallTimeToUtc(y, m, d, 0);
  // Display window: mosaic day 1:00 AM → 10:00 AM ET.
  const displayStart = zonedWallTimeToUtc(y, m, d, 1);
  const displayEnd = zonedWallTimeToUtc(y, m, d, 10);

  const span = carryEnd.getTime() - carryStart.getTime();
  if (span <= 0) return displayStart;
  const t = Math.min(
    1,
    Math.max(0, (date.getTime() - carryStart.getTime()) / span),
  );
  return new Date(
    displayStart.getTime() + t * (displayEnd.getTime() - displayStart.getTime()),
  );
}

export function getPromptMeta(date = new Date()) {
  return {
    prompt: getTodaysPrompt(date),
    dayKey: dayKey(date),
  };
}
