"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/client/useSettings";

/** Applies the theme setting to <html data-theme>. */
export function ThemeSync() {
  const { theme, loaded } = useSettings();
  useEffect(() => {
    if (!loaded) return;
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("beam-theme", theme);
    } catch {}
  }, [theme, loaded]);
  return null;
}
