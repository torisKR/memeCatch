"use client";

import { useEffect } from "react";
import { attachScrollChrome } from "@/lib/scroll-chrome";

const MOBILE_CHROME = "(max-width: 767px)";

/** Header and bottom nav follow window scroll on a phone. Desktop stays put. */
export function ScrollChrome() {
  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_CHROME);
    return attachScrollChrome(
      window,
      document.documentElement,
      () => query?.matches ?? false,
    );
  }, []);

  return null;
}
