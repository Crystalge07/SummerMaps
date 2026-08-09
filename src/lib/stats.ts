import { areaLabel } from "./landmarks";
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
  /** Human place name (landmark / neighbourhood), never raw coords. */
  label: string;
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
    else {
      cells.set(key, {
        key,
        lat,
        lng,
        count: 1,
        label: areaLabel(lat, lng, c.location_name),
      });
    }
  }

  // Merge cells that resolve to the same known area so the list reads like
  // "Queen West" instead of several near-identical coordinate buckets.
  const byLabel = new Map<string, DensityCell>();
  for (const cell of cells.values()) {
    const labelKey = cell.label.toLowerCase();
    const existing = byLabel.get(labelKey);
    if (!existing) {
      byLabel.set(labelKey, { ...cell });
      continue;
    }
    existing.count += cell.count;
    if (cell.count > existing.count - cell.count) {
      existing.lat = cell.lat;
      existing.lng = cell.lng;
      existing.key = cell.key;
    }
  }

  return Array.from(byLabel.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function uniqueContributors(checkins: CheckIn[]): number {
  return new Set(checkins.map((c) => c.device_id)).size;
}

/** Check-ins created within the last `ms` milliseconds. */
export function activeSince(checkins: CheckIn[], ms: number, now = Date.now()) {
  const cutoff = now - ms;
  return checkins.filter((c) => new Date(c.created_at).getTime() >= cutoff);
}

export type DayCount = {
  day: string; // yyyy-MM-dd
  label: string; // e.g. Mar 8
  count: number;
};

/** Finds per calendar day for the last `days` days (oldest → newest). */
export function dailyCounts(
  checkins: CheckIn[],
  days = 14,
  now = new Date(),
): DayCount[] {
  const buckets: DayCount[] = [];
  const keyOf = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({
      day: keyOf(d),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.day, i]));
  for (const c of checkins) {
    const d = new Date(c.created_at);
    const key = keyOf(d);
    const idx = index.get(key);
    if (idx !== undefined) buckets[idx].count += 1;
  }
  return buckets;
}

export type ThemeCount = { label: string; count: number };

export function promptThemeCounts(
  checkins: CheckIn[],
  limit = 8,
): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const c of checkins) {
    const p = c.prompt?.trim();
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "is",
  "was",
  "it",
  "this",
  "that",
  "my",
  "me",
  "i",
  "we",
  "you",
  "they",
  "from",
  "as",
  "by",
  "be",
  "are",
  "were",
  "been",
  "so",
  "just",
  "very",
  "really",
  "here",
  "there",
  "out",
  "up",
  "down",
]);

export function captionKeywords(
  checkins: CheckIn[],
  limit = 10,
): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const c of checkins) {
    const text = c.caption?.trim().toLowerCase();
    if (!text) continue;
    for (const raw of text.split(/[^a-z0-9']+/)) {
      const w = raw.replace(/^'+|'+$/g, "");
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type MoodShares = {
  warm: number;
  curious: number;
  neutral: number;
  labeled: number;
};

const WARM = new Set([
  "love",
  "loved",
  "lovely",
  "beautiful",
  "pretty",
  "cute",
  "sweet",
  "happy",
  "joy",
  "joyful",
  "warm",
  "cozy",
  "soft",
  "glow",
  "sunny",
  "delight",
  "delightful",
  "wonderful",
  "favorite",
  "favourite",
  "smile",
  "smiling",
  "heart",
  "gentle",
  "calm",
  "peaceful",
]);

const CURIOUS = new Set([
  "wow",
  "curious",
  "wonder",
  "weird",
  "strange",
  "odd",
  "huh",
  "interesting",
  "unexpected",
  "surprise",
  "surprised",
  "mystery",
  "notice",
  "noticed",
  "look",
  "looking",
  "found",
  "spotted",
  "spot",
  "hidden",
  "tiny",
  "little",
]);

/** Lightweight keyword mood over captions — not ML. */
export function captionMoodShares(checkins: CheckIn[]): MoodShares {
  let warm = 0;
  let curious = 0;
  let neutral = 0;
  let labeled = 0;

  for (const c of checkins) {
    const text = c.caption?.trim().toLowerCase();
    if (!text) continue;
    labeled += 1;
    const words = text.split(/[^a-z0-9']+/).map((w) => w.replace(/^'+|'+$/g, ""));
    const hasWarm = words.some((w) => WARM.has(w));
    const hasCurious = words.some((w) => CURIOUS.has(w));
    if (hasWarm && !hasCurious) warm += 1;
    else if (hasCurious && !hasWarm) curious += 1;
    else if (hasWarm && hasCurious) warm += 1;
    else neutral += 1;
  }

  return { warm, curious, neutral, labeled };
}
