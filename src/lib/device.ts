"use client";

import { v4 as uuidv4 } from "uuid";

const DEVICE_KEY = "pathline_device_id";

/**
 * Stable identity for check-ins / friendships.
 * When Supabase auth is active, AuthProvider writes auth.uid() here so
 * existing device_id columns stay attached across anonymous → permanent upgrade.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Align local identity with the authenticated user id (same UUID forever). */
export function syncDeviceIdToUser(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(DEVICE_KEY, userId);
}

export { friendCodeFromDeviceId } from "./friendCode";
