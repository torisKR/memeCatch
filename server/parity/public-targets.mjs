#!/usr/bin/env node
// Targets for parity.mjs that cover Next's public/ files (C1): every file
// with GET and HEAD, gzip and identity; and for a text, an image and an
// .avif file the validators (ETag and date, matching and not), ranges
// (one, open, suffix, several, unsatisfiable, If-Range), preconditions, other
// methods, case and dot-segment variants and a trailing slash.
//
//   node server/parity/public-targets.mjs <public-dir> > /tmp/public-targets.txt
//   node server/parity/parity.mjs $NEXT $AXUM /tmp/public-targets.txt
//
// Both servers must serve the same folder (Next's .next/standalone/public and
// AXUM_PUBLIC_DIR pointing at it): the validators come from the files' times.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: public-targets.mjs <public-dir>");
  process.exit(2);
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

const encode = (path) => path.split("/").map(encodeURIComponent).join("/");
const lines = [];
const all = [...files(root)].sort();
for (const file of all) {
  const path = `/${encode(relative(root, file))}`;
  if (path === "/sw.js") continue; // Next's worker build; Axum serves it only without an upstream
  lines.push(`GET ${path} ; accept-encoding: identity`, `HEAD ${path} ; accept-encoding: identity`, `GET ${path}`);
}

for (const name of ["ads.txt", "icons/icon-192.png", "brand/hero-signal-desk.avif"]) {
  const file = join(root, name);
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat) continue;
  const path = `/${name}`;
  const etag = `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`;
  const date = stat.mtime.toUTCString();
  const before = new Date(stat.mtime.getTime() - 60_000).toUTCString();
  const id = "accept-encoding: identity";
  lines.push(
    `GET ${path} ; ${id} ; If-None-Match: ${etag}`,
    `GET ${path} ; ${id} ; If-None-Match: ${etag.slice(2)}`,
    `GET ${path} ; ${id} ; If-None-Match: "other", ${etag}`,
    `GET ${path} ; ${id} ; If-None-Match: "other"`,
    `GET ${path} ; ${id} ; If-None-Match: *`,
    `GET ${path} ; ${id} ; If-Modified-Since: ${date}`,
    `GET ${path} ; ${id} ; If-Modified-Since: ${before}`,
    `GET ${path} ; ${id} ; If-None-Match: ${etag} ; Cache-Control: no-cache`,
    `HEAD ${path} ; ${id} ; If-None-Match: ${etag}`,
    `GET ${path} ; ${id} ; Range: bytes=0-9`,
    `GET ${path} ; ${id} ; Range: bytes=5-`,
    `GET ${path} ; ${id} ; Range: bytes=-5`,
    `GET ${path} ; ${id} ; Range: bytes=0-1,3-4`,
    `GET ${path} ; ${id} ; Range: bytes=999999-`,
    `GET ${path} ; ${id} ; Range: items=0-1`,
    `GET ${path} ; ${id} ; Range: bytes=0-1 ; If-Range: ${etag}`,
    `GET ${path} ; ${id} ; Range: bytes=0-1 ; If-Range: "other"`,
    `GET ${path} ; ${id} ; Range: bytes=0-1 ; If-Range: ${date}`,
    `GET ${path} ; ${id} ; If-Match: "other"`,
    `GET ${path} ; ${id} ; If-Match: ${etag}`,
    `GET ${path} ; ${id} ; If-Unmodified-Since: ${before}`,
    `POST ${path} ; ${id}`,
    `PUT ${path} ; ${id}`,
    `DELETE ${path} ; ${id}`,
    `OPTIONS ${path} ; ${id}`,
    `GET ${path}?v=1 ; ${id}`,
    `GET ${path.toUpperCase()} ; ${id}`,
    `GET ${path}/ ; ${id}`,
    `GET /icons/..${path} ; ${id}`,
  );
}
console.log(lines.join("\n"));
