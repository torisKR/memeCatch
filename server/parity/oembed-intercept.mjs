// Preloaded into the Next server for oembed.mjs:
//
//   node --import "file://$PWD/server/parity/oembed-intercept.mjs?origin=http://127.0.0.1:3640" server.js
//
// lib/oembed.ts and lib/sources/youtube.server.ts fix their hosts, so their
// fetch is caught in the process, under Next's own fetch cache (Next wraps
// this fetch when it starts, and keys its cache by the URL asked for): a
// request to one of the provider origins goes to the recording stub at
// `origin` under `/<host><path>`, with the same method, headers and signal.
// Axum's AXUM_TEST_OEMBED_ORIGIN sends its requests to the same place.
// Without `origin` every request to those hosts is refused.
const ORIGINS = [
  "https://www.youtube.com",
  "https://www.tiktok.com",
  "https://graph.facebook.com",
  "https://graph.threads.net",
  "https://www.googleapis.com",
];
const target = new URL(import.meta.url).searchParams.get("origin")?.replace(/\/+$/, "");
const original = globalThis.fetch;

globalThis.fetch = function interceptedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const origin = ORIGINS.find((candidate) => url.startsWith(`${candidate}/`));
  if (!origin) return original(input, init);
  if (!target) return Promise.reject(new TypeError("the provider hosts are not reachable from a parity run"));
  const redirected = `${target}/${new URL(origin).host}${url.slice(origin.length)}`;
  if (typeof input === "string" || input instanceof URL) return original(redirected, init);
  return original(new Request(redirected, input), init);
};
