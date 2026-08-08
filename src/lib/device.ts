"use client";

import { v4 as uuidv4 } from "uuid";

const DEVICE_KEY = "pathline_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export { friendCodeFromDeviceId } from "./friendCode";
