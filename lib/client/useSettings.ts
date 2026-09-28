"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_SETTINGS, type Settings } from "../settings";

/** Current settings; falls back to defaults while loading. */
export function useSettings(): Settings & { loaded: boolean } {
  const s = useQuery(api.settings.get);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), loaded: s !== undefined };
}
