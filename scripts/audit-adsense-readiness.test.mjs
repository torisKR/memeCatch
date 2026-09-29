import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectAdsTxtResponse } from "./audit-adsense-readiness.mjs";

const valid = { status: 200, contentType: "text/plain; charset=utf-8", body: "google.com, pub-3004906966180197, DIRECT, f08c47fec0942fa0\n" };
test("recognizes the exact verified publisher record", () => {
  assert.deepEqual(inspectAdsTxtResponse(valid).errors, []);
});
test("rejects login pages, not-found responses and other publishers", () => {
  assert.ok(inspectAdsTxtResponse({ ...valid, status: 404 }).errors.length);
  assert.ok(inspectAdsTxtResponse({ ...valid, contentType: "text/html", body: "<!doctype html><title>Sign in</title>" }).errors.length);
  assert.ok(inspectAdsTxtResponse({ ...valid, body: "google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0" }).errors.length);
});
test("allows CRLF, surrounding whitespace and additional valid sellers", () => {
  assert.deepEqual(inspectAdsTxtResponse({ ...valid, body: "# sellers\r\n  " + valid.body.trim() + "\r\nexample.net, 123, RESELLER\r\n" }).errors, []);
});
test("does not interpret HTTP delivery as approval or a Google recrawl", () => {
  const report = inspectAdsTxtResponse(valid);
  assert.equal(report.googleAccountStatus, "not_checked");
  assert.equal(report.googleRecrawlRequested, false);
});
