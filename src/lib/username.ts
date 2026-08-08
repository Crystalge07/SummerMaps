/** Client-side username rules — server enforces the same via claim_username. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < USERNAME_MIN) {
    return `At least ${USERNAME_MIN} characters.`;
  }
  if (username.length > USERNAME_MAX) {
    return `At most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Use lowercase letters, numbers, and underscores only.";
  }
  return null;
}

export function isUsernameTakenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message =
    "message" in err && typeof err.message === "string" ? err.message : "";
  const code = "code" in err ? String(err.code) : "";
  return (
    code === "23505" ||
    message.includes("username_taken") ||
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    (code === "P0001" && message.includes("username_taken"))
  );
}
