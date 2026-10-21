"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isLiveAdOrigin } from "@/lib/adsense-policy";
import { createClient } from "@/lib/supabase/client";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const browserSnapshot = () => isLiveAdOrigin(window.location.href);

const DISABLED_BROWSER_KEY = "memecatch_ads_disabled";

function browserHasOptedOut(): boolean {
  // Automated UI verification must never request real ads, even on production.
  if (navigator.webdriver) return true;
  try {
    return localStorage.getItem(DISABLED_BROWSER_KEY) === "1";
  } catch {
    return true;
  }
}

/** No ad request precedes the origin/session check; operator browsers stay opted out. */
export function AdsenseHostGate({ children }: { children: ReactNode }) {
  const liveOrigin = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  const [audienceAllowed, setAudienceAllowed] = useState(false);

  useEffect(() => {
    if (!liveOrigin || browserHasOptedOut()) return;
    let alive = true;
    let revision = 0;
    const supabase = createClient();

    async function resolveAudience(session: Session | null, current: number) {
      if (!alive || current !== revision || browserHasOptedOut()) return;
      if (!session) {
        setAudienceAllowed(true);
        return;
      }
      try {
        // profiles.role is deliberately not exposed to browser clients.
        const { data, error } = await supabase.rpc("is_operator");
        if (!alive || current !== revision) return;
        if (!error && data === true) {
          try { localStorage.setItem(DISABLED_BROWSER_KEY, "1"); } catch { /* This mount remains blocked. */ }
        }
        setAudienceAllowed(!error && data === false && !browserHasOptedOut());
      } catch {
        if (alive && current === revision) setAudienceAllowed(false);
      }
    }

    const initialRevision = revision;
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive && revision === initialRevision && !error) {
        void resolveAudience(data.session, ++revision);
      }
    }).catch(() => { /* An unresolved/failed auth read never starts ads. */ });

    const { data: authChange } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++revision;
      setAudienceAllowed(false);
      // Defer Supabase reads until after its auth callback releases its lock.
      queueMicrotask(() => { void resolveAudience(session, current); });
    });

    return () => {
      alive = false;
      revision += 1;
      authChange.subscription.unsubscribe();
    };
  }, [liveOrigin]);

  return liveOrigin && audienceAllowed ? children : null;
}
