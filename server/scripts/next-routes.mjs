#!/usr/bin/env node
// Writes server/src/standalone/next_routes.json: every path the Next app
// routes (app/**/page.tsx, app/**/route.{ts,js} and the metadata files), with the
// methods a route handler exports and whether Next prerenders it. Without
// an upstream (AXUM_NO_UPSTREAM), Axum uses it to answer what Next would for
// a request no native route takes: 405 for a method the route lacks, 404 for
// a path no route matches, and "not ported" for the rest (PLAN.md, C1).
//
//   node server/scripts/next-routes.mjs            # rewrite the file
//   node server/scripts/next-routes.mjs --check    # exit 1 if it is stale (CI)
//   node server/scripts/next-routes.mjs --manifest .next/app-path-routes-manifest.json
//                                                  # compare the paths with a build
//
// Run from the repository root.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APP = "app";
const OUT = "server/src/standalone/next_routes.json";
const METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
// Metadata files that Next turns into a GET route at their folder's path.
const METADATA = new Map([
  ["favicon.ico", "favicon.ico"],
  ["icon.svg", "icon.svg"],
  ["apple-icon.png", "apple-icon.png"],
  ["manifest.ts", "manifest.webmanifest"],
  ["opengraph-image.tsx", "opengraph-image"],
  ["sitemap.ts", "sitemap.xml"],
]);

function exportedMethods(source) {
  const found = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) found.add(match[1]);
  for (const match of source.matchAll(/export\s+const\s+([A-Z]+)\s*=/g)) found.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) found.add(part.trim().split(/\s+as\s+/).pop());
  }
  return METHODS.filter((method) => found.has(method));
}

const isStaticRoute = (source) =>
  /dynamic\s*=\s*["']force-static["']/.test(source) ||
  /export\s+(?:async\s+)?function\s+generateStaticParams\b/.test(source);

function walk(dir, segments, out) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // `_x` folders are private, `@x` are slots; a group `(x)` adds no segment.
      if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
      const group = entry.name.startsWith("(") && entry.name.endsWith(")");
      walk(full, group ? segments : [...segments, entry.name], out);
      continue;
    }
    const path = `/${segments.join("/")}`;
    if (entry.name === "page.tsx") {
      out.push({ path, kind: "page", methods: ["GET"], static: false });
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      const source = readFileSync(full, "utf8");
      out.push({ path, kind: "route", methods: exportedMethods(source), static: isStaticRoute(source) });
    } else if (METADATA.has(entry.name)) {
      const routePath = `${path === "/" ? "" : path}/${METADATA.get(entry.name)}`;
      const source = /\.tsx?$/.test(entry.name) ? readFileSync(full, "utf8") : "";
      // sitemap.ts is force-dynamic; the other metadata routes are prerendered.
      const isStatic = !/dynamic\s*=\s*["']force-dynamic["']/.test(source);
      out.push({ path: routePath, kind: "route", methods: ["GET"], static: isStatic });
    }
  }
}

const routes = [];
walk(APP, [], routes);
routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
const text = `${JSON.stringify(routes, null, 1)}\n`;

const args = process.argv.slice(2);
const manifestAt = args.indexOf("--manifest");
if (manifestAt >= 0) {
  const manifest = JSON.parse(readFileSync(args[manifestAt + 1], "utf8"));
  const built = new Set(Object.values(manifest).filter((path) => !path.startsWith("/_")));
  const ours = new Set(routes.map((route) => route.path));
  const missing = [...built].filter((path) => !ours.has(path));
  const extra = [...ours].filter((path) => !built.has(path));
  if (missing.length || extra.length) {
    console.error(`not in the table: ${missing.join(" ") || "-"}\nnot in the build: ${extra.join(" ") || "-"}`);
    process.exit(1);
  }
  console.log(`${routes.length} routes, the same paths as the build`);
} else if (args.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== text) {
    console.error(`${OUT} is stale: run node server/scripts/next-routes.mjs`);
    process.exit(1);
  }
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${routes.length} routes to ${OUT}`);
}
