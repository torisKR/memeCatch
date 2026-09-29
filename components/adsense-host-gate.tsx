"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isLiveAdOrigin } from "@/lib/adsense-policy";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const browserSnapshot = () => isLiveAdOrigin(window.location.href);

/** The initial server/client snapshots agree; production-only scripts mount after hydration. */
export function AdsenseHostGate({ children }: { children: ReactNode }) {
  const liveOrigin = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  return liveOrigin ? children : null;
}
