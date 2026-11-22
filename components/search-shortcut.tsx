"use client";

import { useEffect } from "react";

/**
 * Press "/" anywhere to jump to the header search, the way a dictionary is
 * used: you arrive with a word. Ignored while typing in a field, with a
 * modifier key, or when the header search is hidden (mobile shows an icon).
 */
export function SearchShortcut() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const input = document.getElementById("header-search") as HTMLInputElement | null;
      if (!input || input.offsetParent === null) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
