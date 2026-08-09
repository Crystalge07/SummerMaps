"use client";

import { useEffect } from "react";
import { installClickSounds } from "@/lib/clickSound";

/** Soft click on buttons / pressables across the app. */
export function ClickSounds() {
  useEffect(() => installClickSounds(), []);
  return null;
}
