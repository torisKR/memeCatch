// Preloaded into the Next server for og.mjs (the share section):
//
//   node --import "file://$PWD/server/parity/og-intercept.mjs?origin=http://127.0.0.1:3461" server.js
//
// The share card fetches YouTube stills from https://i.ytimg.com: those go to
// the recording stub at `origin` under `/<host><path>`, with the same method,
// headers and signal. Axum's AXUM_TEST_OG_ORIGIN sends its requests to the
// same place. Google Fonts, jsDelivr (twemoji, the export card's font) and
// the production site are refused, as if unreachable: Satori's dynamic font
// download then fails as it does when they are down.
const STUBBED = ["https://i.ytimg.com"];
const REFUSED = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://catchmeme.com", "https://www.catchmeme.com"];
const target = new URL(import.meta.url).searchParams.get("origin")?.replace(/\/+$/, "");
const original = globalThis.fetch;

globalThis.fetch = function interceptedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  if (REFUSED.some((origin) => url.startsWith(`${origin}/`))) {
    return Promise.reject(new TypeError("fetch failed"));
  }
  const origin = STUBBED.find((candidate) => url.startsWith(`${candidate}/`));
  if (!origin) return original(input, init);
  if (!target) return Promise.reject(new TypeError("the stubbed hosts are not reachable from a parity run"));
  const redirected = `${target}/${new URL(origin).host}${url.slice(origin.length)}`;
  if (typeof input === "string" || input instanceof URL) return original(redirected, init);
  return original(new Request(redirected, input), init);
};
