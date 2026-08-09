/** Shared daily prompts — everyone sees the same one for a given calendar day. */

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
];

/** Pin a specific calendar day to a prompt (YYYY-MM-DD → prompt). */
const PROMPT_OVERRIDES: Record<string, string> = {
  "2026-08-08": "hidden beauty",
};

/** Stable day index from local calendar date (YYYY-MM-DD). */
export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashDay(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getTodaysPrompt(date = new Date()): string {
  const key = dayKey(date);
  if (PROMPT_OVERRIDES[key]) return PROMPT_OVERRIDES[key];
  return PROMPTS[hashDay(key) % PROMPTS.length];
}

export function getPromptMeta(date = new Date()) {
  return {
    prompt: getTodaysPrompt(date),
    dayKey: dayKey(date),
  };
}
