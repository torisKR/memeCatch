// components/attribution-tracker.tsx: once per session, where the visitor
// came from. The rules are lib/attribution.ts itself (lib.attribution).
{
  const FIRST_TOUCH_KEY = "mc:attr:first";
  const SESSION_TOUCH_KEY = "mc:attr:session";
  const readTouch = (area, key) => {
    try {
      const parsed = JSON.parse(storage.get(area, key) ?? "null");
      return parsed && typeof parsed.source === "string" ? parsed : null;
    } catch {
      return null;
    }
  };
  const { resolveAttribution, decideTouches, toGtagParams, DIRECT_SOURCE } = lib.attribution;
  const current = resolveAttribution({
    search: location.search,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    selfHost: location.hostname,
  });
  const { firstTouch, sessionTouch, sessionExpired, isNewUser } = decideTouches({
    current,
    storedFirst: readTouch("localStorage", FIRST_TOUCH_KEY),
    storedSession: readTouch("sessionStorage", SESSION_TOUCH_KEY),
    now: Date.now(),
  });
  if (isNewUser) storage.set("localStorage", FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
  storage.set("sessionStorage", SESSION_TOUCH_KEY, JSON.stringify(sessionTouch));
  const acquisition = {
    ...toGtagParams(sessionTouch),
    ...toGtagParams(firstTouch, "first_"),
    landing_page: measuredPath.slice(0, 100),
    is_returning: isNewUser ? "false" : "true",
  };
  if (sessionExpired) track("traffic_source", acquisition, "durable");
  whenGtagReady(() => {
    try {
      if (sessionTouch.source !== DIRECT_SOURCE) {
        window.gtag("set", {
          campaign_source: sessionTouch.source,
          campaign_medium: sessionTouch.medium,
          ...(sessionTouch.campaign ? { campaign_name: sessionTouch.campaign } : {}),
          ...(sessionTouch.content ? { campaign_content: sessionTouch.content } : {}),
          ...(sessionTouch.term ? { campaign_term: sessionTouch.term } : {}),
        });
      }
      window.gtag("set", "user_properties", toGtagParams(firstTouch, "first_"));
    } catch {
      /* analytics must not break the page */
    }
    if (sessionExpired) track("traffic_source", acquisition, "ga");
  });
}
