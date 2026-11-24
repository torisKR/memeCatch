// Preloaded into the Next server for mcp.mjs, like openrouter-intercept.mjs:
//
//   node --import "file://$PWD/server/parity/mcp-intercept.mjs?origin=http://127.0.0.1:3530" server.js
//
// The connector routes read https://catchmeme.com/llms-full.txt (the corpus)
// and https://chatgpt.com/oauth/client.json (the OAuth client metadata). A
// fetch to either origin goes to the stub at `origin` instead, same path,
// method, headers and signal. Without `origin` both are refused, so a
// parity run never reaches the site or ChatGPT.
const ORIGINS = ["https://catchmeme.com", "https://chatgpt.com"];
const target = new URL(import.meta.url).searchParams.get("origin")?.replace(/\/+$/, "");
const original = globalThis.fetch;

globalThis.fetch = function interceptedFetch(input, init) {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const origin = ORIGINS.find((known) => url.startsWith(`${known}/`));
  if (!origin) return original(input, init);
  if (!target) return Promise.reject(new TypeError(`${origin} is not reachable from a parity run`));
  const redirected = `${target}${url.slice(origin.length)}`;
  if (typeof input === "string" || input instanceof URL) return original(redirected, init);
  return original(new Request(redirected, input), init);
};
