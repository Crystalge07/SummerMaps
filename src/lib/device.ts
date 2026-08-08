"use client";

import { v4 as uuidv4 } from "uuid";

const DEVICE_KEY = "pathline_device_id";
const ACTIVE_GROUP_KEY = "pathline_active_group_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function getActiveGroupId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_GROUP_KEY);
}

export function setActiveGroupId(groupId: string | null) {
  if (typeof window === "undefined") return;
  if (groupId) localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
  else localStorage.removeItem(ACTIVE_GROUP_KEY);
}
