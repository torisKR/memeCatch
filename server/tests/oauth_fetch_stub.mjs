// Sends what better-auth fetches from Google and Kakao (the token exchange,
// Kakao's profile, Google's keys) to OAUTH_STUB_ORIGIN instead, path and
// query kept, so a test answers for the providers and nothing reaches them.
// Load it before the app's auth modules:
//
//   OAUTH_STUB_ORIGIN=http://127.0.0.1:<port> node --import ./server/tests/oauth_fetch_stub.mjs ...
//
// The Axum server does the same with AXUM_TEST_OAUTH_ORIGIN.
const origin = process.env.OAUTH_STUB_ORIGIN;
if (!origin || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
  throw new Error("OAUTH_STUB_ORIGIN must be http://127.0.0.1:<port>");
}
const isProvider = (host) =>
  host === "google.com" || host.endsWith(".google.com") || host.endsWith(".googleapis.com") ||
  host === "kakao.com" || host.endsWith(".kakao.com");
const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!isProvider(url.hostname)) return realFetch(input, init);
  const target = new URL(`${url.pathname}${url.search}`, origin);
  return input instanceof Request ? realFetch(new Request(target, input), init) : realFetch(target, init);
};
