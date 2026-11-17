import assert from "node:assert/strict";

// This check expires the catalog cache. Run only against an isolated server.
const base = new URL(process.argv[2]);
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "isolated loopback server required");
assert(process.env.CRON_SECRET, "CRON_SECRET required");
const locales = [["en", "en"], ["ja", "ja"], ["zh", "zh-Hans"], ["zh-tw", "zh-Hant"]];

async function checkHomes(label) {
  for (const [locale, lang] of locales) {
    const response = await fetch(new URL(`/${locale}`, base));
    assert.equal(response.status, 200, `${label}: /${locale}`);
    assert.match(await response.text(), new RegExp(`<html lang="${lang}"`), `${label}: /${locale} document`);
  }
  for (const locale of ["ar", "xx"]) {
    const response = await fetch(new URL(`/${locale}`, base));
    assert.equal(response.status, 404, `${label}: unsupported /${locale}`);
  }
  const landing = await fetch(base, { headers: { cookie: "memecatch_locale=en" }, redirect: "manual" });
  assert.equal(landing.status, 302, `${label}: preference redirect`);
  assert.equal(new URL(landing.headers.get("location"), base).pathname, "/en");
}

await checkHomes("prerendered");
for (let pass = 1; pass <= 2; pass += 1) {
  const response = await fetch(new URL("/api/cron/source-refresh", base), {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  assert.equal(response.status, 200, "catalog expiration");
  assert.deepEqual(await response.json(), { ok: true });
  await checkHomes(`after expiration ${pass}`);
}
console.log("localized homes survive repeated catalog expiration; unknown locales remain 404");
