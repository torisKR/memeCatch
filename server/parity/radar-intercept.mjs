// Preloaded into the Next server for trend-pulse.mjs:
//
//   node --import "file://$PWD/server/parity/radar-intercept.mjs?origin=http://127.0.0.1:3630" server.js
//
// The radar connectors (lib/trend/radar-platform-connectors.server.ts) fix
// their hosts, so their fetch is caught in the process: a request to one of
// the three origins goes to the recording stub at `origin` under
// `/<host><path>`, with the same method, headers and signal. Axum's
// AXUM_TEST_RADAR_ORIGIN sends its requests to the same place. Without
// `origin` every request to those hosts is refused.
const ORIGINS = ["https://api.x.com", "https://graph.threads.com", "https://graph.facebook.com"];
const target = new URL(import.meta.url).searchParams.get("origin")?.replace(/\/+$/, "");
const original = globalThis.fetch;

globalThis.fetch = function interceptedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const origin = ORIGINS.find((candidate) => url.startsWith(`${candidate}/`));
  if (!origin) return original(input, init);
  if (!target) return Promise.reject(new TypeError("the radar hosts are not reachable from a parity run"));
  const redirected = `${target}/${new URL(origin).host}${url.slice(origin.length)}`;
  if (typeof input === "string" || input instanceof URL) return original(redirected, init);
  return original(new Request(redirected, input), init);
};
