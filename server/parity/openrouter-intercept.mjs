// Preloaded into the Next server for chat.mjs and mpe-candidates.mjs:
//
//   node --import "file://$PWD/server/parity/openrouter-intercept.mjs?origin=http://127.0.0.1:3530" server.js
//
// The TypeScript fixes the OpenRouter host to https://openrouter.ai, so the
// only way to compare what it sends is to catch its fetch in the process: a
// request to that origin goes to the recording stub at `origin` instead, with
// the same method, headers, body, redirect mode and signal. Without `origin`
// every request to openrouter.ai is refused, so nothing reaches the service.
const ORIGIN = "https://openrouter.ai";
const target = new URL(import.meta.url).searchParams.get("origin")?.replace(/\/+$/, "");
const original = globalThis.fetch;

globalThis.fetch = function interceptedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  if (!url.startsWith(`${ORIGIN}/`)) return original(input, init);
  if (!target) return Promise.reject(new TypeError("openrouter.ai is not reachable from a parity run"));
  const redirected = `${target}${url.slice(ORIGIN.length)}`;
  if (typeof input === "string" || input instanceof URL) return original(redirected, init);
  return original(new Request(redirected, input), init);
};
