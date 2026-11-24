#!/usr/bin/env node
// Page parity gate: is the page Axum renders the page Next renders?
//
//   node server/parity/pages/pages.mjs <next> <axum> [targets] [--expect-proxied]
//     [--concurrency=4] [--examples=3] [--cookie=<Cookie header>]
//
// For every target and every user agent in USER_AGENTS it asks both servers
// and compares, in this order: status; Location and Refresh; the response
// headers; <html lang dir>; <title>; every <meta name|property>; canonical,
// hreflang, feed, manifest and icon links; JSON-LD parsed and compared as
// data; the visible text of <body>; its links; its images; and the markup of
// <main>. It also sends each request as HEAD and compares its status,
// headers and empty body. Exit code 0 means no difference outside ACCEPTED.
//
// Both documents are first settled (dom.mjs): Next streams part of a page
// into hidden segments and, for browsers and Googlebot, sends the metadata
// inside <body>. A crawler that runs scripts ends up with the settled
// document, so that is what is compared. Where Next put the metadata is
// printed for information.
//
// A target line is `<path> <expectation>...`. Expectations are checked on
// both servers, so a seed that no longer produces the case fails the gate:
//   200 | 308 | 404   the status
//   index | noindex   whether a robots meta says noindex
//   native | proxied  whether Axum rendered the page or passed Next's on
//   streamed-redirect Next streams the page and its redirect() becomes a 200
//                     with a meta refresh; Axum answers 307 to the same URL
//                     (PLAN.md B6-9). Only the two targets are compared.
// `--expect-proxied` replaces native with proxied on every line: use it with
// an Axum started with the page routes in AXUM_DISABLED_ROUTES.
//
// At scale, `targets` can instead be a sitemap (`curl <site>/sitemap.xml`) or
// a file of URLs, one per line: their paths are compared with no
// expectations. `--concurrency` bounds the requests in flight (each target
// is asked of both servers, once per user agent), `--examples` how many
// requests the details of each kind of difference are printed for; the
// summary at the end counts every request by the kind of difference.
// `--cookie` sends that Cookie header with every request: a signed-in
// session for the pages of batch B6 that show one (b6-signed-in.txt).
//
// Requests carry no Sec-Fetch-Mode header, like a crawler's: proxy.ts looks a
// meme up only for a navigation or a request without that header, and Node's
// fetch() always sends `cors`. Both servers get the Host of the Next URL.
//
// Needs the packages of the repository root (jsdom).
import { readFileSync } from "node:fs";
import http from "node:http";
import { settle } from "./dom.mjs";

const USER_AGENTS = {
  browser:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  googlebot:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  // On Next's list of crawlers that get the metadata in <head> without streaming.
  yeti: "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)",
};

// ---------------------------------------------------------------------------
// What is not compared, and why.

const IGNORED_HEADERS = new Map([
  ["date", "stamped by whichever server writes the response"],
  ["connection", "hop-by-hop"],
  ["keep-alive", "hop-by-hop"],
  ["transfer-encoding", "hop-by-hop: each server frames its own body"],
  ["content-length", "framing; Next sets it only on its prerendered 404"],
  ["etag", "validator of Next's prerendered 404 file"],
  ["x-nextjs-cache", "Next's cache state for this request"],
  ["x-nextjs-prerender", "Next internals"],
  ["x-nextjs-stale-time", "Next internals"],
  ["x-middleware-rewrite", "names the internal rewrite target of proxy.ts"],
  ["x-powered-by", "Next internals"],
  ["link", "a preload hint that names Next's own stylesheet files; Next sends it only to the crawlers it does not stream to"],
]);

// Parts of a page Next renders and the Axum pilot does not yet. They are cut
// out of Next's document before text, links, images and markup are compared,
// and counted in the output. UI-PLAN.md lists them as missing.
const NOT_PORTED = [
  {
    paths: /^\/memes\//,
    selectors: [
    ],
  },
];

// Parts of Next's document that show a defect of Next the native page does
// not copy (PLAN.md section B6: plainly broken behaviour whose intent is
// clear). Cut from Next's document, like NOT_PORTED, when Axum rendered.
const NEXT_DEFECTS = [
  {
    // B6-11: the submissions read is refused by the database (42602) on
    // every signed-in /my, so Next shows its load-error notice.
    paths: /^\/my(\?|#|$)/,
    selectors: ["main > p[role=alert].bg-safety-red-bg"],
  },
  {
    // B6-12: "필터 지우기" keeps the filters on Next; it goes to /my#saved.
    paths: /^\/my(\?|#|$)/,
    selectors: [],
    patch: (document) => {
      for (const link of document.querySelectorAll("#saved a")) {
        if (link.textContent.trim() === "필터 지우기") link.setAttribute("href", "/my#saved");
      }
    },
  },
];

// Differences that are decided, with the reason. Anything else fails.
const ACCEPTED = [
  {
    when: (target) => target.status === 404,
    fields: ["header cache-control", "html", "meta", "feeds", "JSON-LD", "text", "links", "images", "main markup", "HEAD"],
    reason:
      "Next answers a missing meme with a prerendered file: a year-long s-maxage, the site default share card, and an <html> without lang and a <body> without content until its scripts run. Axum sends no-store and the same message as HTML. Status, <title> and noindex are compared.",
  },
  {
    when: () => true,
    fields: ["icon links"],
    reason: "Next appends a hash of each icon file as a query string; the paths are compared.",
  },
];

// ---------------------------------------------------------------------------

function request(base, path, host, userAgent, method = "GET") {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        path,
        method,
        headers: { host, "user-agent": userAgent, accept: "text/html,*/*;q=0.8", "accept-encoding": "identity", ...(cookie ? { cookie } : {}) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, rawHeaders: res.rawHeaders, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function comparableHeaders(rawHeaders) {
  const headers = new Map();
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index].toLowerCase();
    if (IGNORED_HEADERS.has(name)) continue;
    headers.set(name, [...(headers.get(name) ?? []), rawHeaders[index + 1]]);
  }
  // Which hop compresses is not the page's business: Accept-Encoding aside,
  // Vary must list the same request headers.
  if (headers.has("vary")) {
    const fields = headers
      .get("vary")
      .flatMap((value) => value.split(","))
      .map((field) => field.trim().toLowerCase())
      .filter((field) => field && field !== "accept-encoding");
    headers.set("vary", [[...new Set(fields)].sort().join(", ")]);
  }
  return headers;
}

const squash = (text) => text.replace(/\s+/g, " ").trim();
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const sortKeys = (value) =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
      : value;

// The fixed ids Axum writes where Next writes one React generated.
const AXUM_FIXED_IDS = new Set(["edition-status", "contribute-help", "contribute-kind", "related-videos-extra", "search-suggest-listbox", "forgot-email", "reset-password", "reset-password-hint", "reset-confirm", "signin-email", "signin-password", "signup-nickname", "signup-email", "signup-password", "signup-agree", "onboarding-nickname"]);
// Attributes that only tell the scripts of server/ui what to act on.
const SCRIPT_INPUT_ATTRIBUTES = new Set([
  "data-search-page",
  "data-search-box",
  "data-search-reference",
  "data-studio",
  "data-studio-workspace",
  "data-studio-tone",
  "data-studio-format",
  "data-studio-generate",
  "data-studio-reference",
  "data-studio-results",
  "data-studio-mode",
  "data-studio-artifact",
  "data-copy",
  "data-share",
  "data-share-title",
  "data-save-meme",
  "data-meme-id",
  "data-ads",
  "data-track",
  "data-track-from",
  "data-track-short-id",
  "data-track-platform",
  // The meme page's collection navigation (ui/page.js).
  "data-context-nav",
  "data-context",
  // A house original's card and storyboard tabs (ui/house.js).
  "data-house-visual",
  "data-house-tab",
  "data-house-panel",
  "data-tab-on",
  "data-tab-off",
  // The players of the meme page (ui/embed.js).
  "data-youtube",
  "data-youtube-title",
  "data-social",
  "data-social-url",
  "data-social-name",
  "data-social-frame",
  "data-social-title",
  "data-social-sandbox",
  "data-related-extra",
  "data-related-index",
  "data-related-embed",
  "data-save-copy",
  "data-saved-class",
  "data-unsaved-class",
  "data-edition-image",
  "data-edition-caption",
  "data-edition-slug",
  "data-share-url",
  "data-copy-link",
  "data-save-card",
  "data-edition-status",
  // The meme card (ui/card.js): the card, its player button and dialog.
  "data-card",
  "data-card-preview",
  "data-card-dialog",
  // The timeline (ui/timeline.js): its rows, tabs, cards and sentinel.
  "data-timeline",
  "data-initial",
  "data-total",
  "data-decade-tab",
  "data-decade",
  "data-timeline-card",
  "data-year",
  "data-timeline-sentinel",
  // The slang dictionary (ui/slang.js).
  "data-slang",
  "data-tab-current",
  "data-tab-idle",
  "data-era-tab",
  "data-era",
  // The meme page's card export (ui/export.js).
  "data-export",
  "data-export-locale",
  "data-export-copy",
  // The contribution form of the meme page (ui/contribute.js).
  "data-contribute",
  "data-contribute-short-id",
  "data-contribute-field",
  "data-contribute-input",
  "data-kind-selected",
  "data-kind-idle",
  // The explore page (ui/explore.js): its toolbar, grid, items and actions.
  "data-explore-filters",
  "data-explore-grid",
  "data-explore-select",
  "data-explore-panel-toggle",
  "data-explore-action",
  "data-explore-banner",
  "data-explore-searching",
  "data-explore-searching-title",
  "data-explore-list",
  "data-explore-item",
  "data-explore-sentinel",
  "data-key",
  "data-pref",
  // The meme cards (ui/meme-cards.js).
  "data-meme-cards",
  "data-meme-cards-grid",
  "data-meme-cards-shuffle",
  "data-meme-cards-reveal",
  "data-meme-cards-cancel",
  "data-meme-cards-claim",
  // The quiz (ui/quiz.js).
  "data-quiz",
  "data-site-url",
  "data-quiz-screen",
  "data-quiz-mode",
  "data-quiz-action",
  // The forms of the sign-in pages (ui/auth-forms.js).
  "data-auth-form",
  // Copy that follows the language switch (core.js applyPageCopy).
  "data-i18n",
  "data-i18n-lead",
  "data-i18n-placeholder",
  "data-i18n-label",
  // The onboarding form (ui/onboarding.js): its chips and their classes.
  "data-onboarding",
  "data-chip-on",
  "data-chip-off",
  "data-onboarding-purpose",
  "data-onboarding-interest",
  "data-onboarding-platform",
  "data-onboarding-age",
  "data-onboarding-optional",
  // /my (ui/my.js and the scripts of its sections).
  "data-my-sign-out",
  "data-my-nickname",
  "data-my-cards",
  "data-my-cards-page",
  "data-my-recent",
  "data-daily-quiz",
  // The sign-in page (ui/login.js): its tabs, headings and social buttons.
  "data-login",
  "data-login-next",
  "data-login-title",
  "data-login-description",
  "data-login-notice",
  "data-login-tab",
  "data-login-pill",
  "data-login-slot",
  "data-login-provider",
]);
// A form whose action is a server action: React adds hidden inputs that
// carry the action's id and bound arguments, and `action=""`,
// `enctype="multipart/form-data"` and `method="POST"` so the form posts to
// the action without scripts. The native page's script sends the same input
// to an endpoint instead (PLAN.md B6). Dropped from Next's markup only.
const SERVER_ACTION_FORM_ATTRIBUTES = new Map([
  ["action", ""],
  ["enctype", "multipart/form-data"],
  ["method", "POST"],
]);
const isServerActionInput = (element) =>
  element.localName === "input" && element.getAttribute("type") === "hidden" && /^\$ACTION_/.test(element.getAttribute("name") ?? "");
// The motion library's start state in Next's markup, and the CSS animation
// classes that replace it (ui/site.css).
// `MotionList` starts its items 10px down.
const MOTION_START_STYLES = new Set(["transform:translateY(12px)", "transform:translateY(10px)", "opacity:0"]);
const MOTION_CLASSES = new Set(["answer-card-in", "answer-card-glow"]);

function normalizedAttribute(name, value) {
  if (SCRIPT_INPUT_ATTRIBUTES.has(name)) return null;
  if (/(^|-)_R_|^:r/.test(value)) return null; // React's generated ids, alone or as a suffix
  if (AXUM_FIXED_IDS.has(value)) return null; // Axum's fixed ids in their place
  if (name === "class") {
    const tokens = value
      .split(/\s+/)
      .filter(Boolean)
      // A CSS-module class: Next writes module_local__hash, Axum module-local.
      .map((token) => token.replace(/^([a-z-]+)_([A-Za-z0-9]+)__[\w-]+$/, (_, module, local) => `${module}-${kebab(local)}`))
      .filter((token) => !MOTION_CLASSES.has(token));
    return tokens.length ? [...new Set(tokens)].sort().join(" ") : null;
  }
  if (name === "style") {
    const declarations = value
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part && !MOTION_START_STYLES.has(part.replace(/\s+/g, "")));
    return declarations.length ? declarations.join(";") : null;
  }
  return value;
}

/** One line per element or text run, indented by depth. */
function outline(node, depth, out) {
  let text = "";
  const flush = () => {
    if (squash(text)) out.push(`${"  ".repeat(depth)}${JSON.stringify(squash(text))}`);
    text = "";
  };
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      text += child.data;
    } else if (child.nodeType === 1) {
      flush();
      if (isServerActionInput(child)) continue;
      const actionForm = child.localName === "form" && [...child.children].some(isServerActionInput);
      const attributes = [...child.attributes]
        .filter(({ name, value }) => !(actionForm && SERVER_ACTION_FORM_ATTRIBUTES.get(name) === value))
        .map(({ name, value }) => [name, normalizedAttribute(name, value)])
        .filter(([, value]) => value !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => `${name}=${JSON.stringify(value)}`);
      out.push(`${"  ".repeat(depth)}<${[child.localName, ...attributes].join(" ")}>`);
      outline(child, depth + 1, out);
    }
  }
  flush();
}

const rendererOf = (body) => (body.includes('href="/_axum/site.') ? "axum" : body.includes("/_next/static/") ? "next" : "none");

/** `cutNotPorted`: this is Next's document and Axum rendered its own. */
function facts(response, path, cutNotPorted) {
  const { document, unresolved } = settle(response.body);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const metadataInHead = Boolean(document.head.querySelector("title"));
  const result = {
    unresolved,
    renderer: rendererOf(response.body),
    metadataInHead,
    html: `lang=${document.documentElement.getAttribute("lang")} dir=${document.documentElement.getAttribute("dir")}`,
    title: all("title").map((element) => element.textContent),
    meta: all("meta[name], meta[property]")
      .map((element) => {
        const key = element.getAttribute("name") ?? element.getAttribute("property");
        const media = element.getAttribute("media");
        return `${key}${media ? ` [${media}]` : ""} = ${element.getAttribute("content")}`;
      })
      .sort(),
    canonical: all('link[rel="canonical"]').map((element) => element.getAttribute("href")),
    hreflang: all('link[rel="alternate"][hreflang]').map((element) => `${element.getAttribute("hreflang")} = ${element.getAttribute("href")}`),
    feeds: all('link[rel="alternate"][type]').map((element) => `${element.getAttribute("type")} ${element.getAttribute("title")} = ${element.getAttribute("href")}`),
    manifest: all('link[rel="manifest"]').map((element) => element.getAttribute("href")),
    icons: all('link[rel="icon"], link[rel="apple-touch-icon"]').map(
      (element) => `${element.getAttribute("rel")} ${element.getAttribute("type")} ${element.getAttribute("sizes")} = ${element.getAttribute("href").split("?")[0]}`,
    ),
    jsonLd: all('script[type="application/ld+json"]')
      .map((element) => {
        try {
          return JSON.stringify(sortKeys(JSON.parse(element.textContent)));
        } catch {
          return `unparseable: ${element.textContent.slice(0, 80)}`;
        }
      })
      .sort(),
  };
  result.noindex = result.meta.some((entry) => /^robots = .*noindex/.test(entry));

  let removed = 0;
  if (cutNotPorted) {
    for (const gap of [...NOT_PORTED, ...NEXT_DEFECTS].filter((gap) => gap.paths.test(path))) {
      for (const selector of gap.selectors) {
        for (const element of all(selector)) {
          element.remove();
          removed += 1;
        }
      }
      gap.patch?.(document);
    }
  }
  result.removed = removed;
  // Not content: scripts, styles, the empty hidden containers React leaves
  // behind after streaming, and metadata Next streamed into <body> (compared
  // above; a <title> there would count as text).
  for (const element of all("script, style, template, noscript, body > div[hidden], body title, body meta, body link")) {
    element.remove();
  }
  result.text = squash(document.body?.textContent ?? "");
  result.links = all("a[href]", document.body).map((element) =>
    [element.getAttribute("href"), squash(element.textContent), element.getAttribute("rel") ?? "", element.getAttribute("target") ?? ""].join(" | "),
  );
  result.images = all("img, source", document.body).map((element) =>
    ["src", "srcset", "alt", "width", "height", "media"].map((name) => `${name}=${element.getAttribute(name) ?? ""}`).join(" "),
  );
  const main = document.querySelector("main");
  result.main = [];
  if (main) outline(main, 0, result.main);
  return result;
}

function firstDifference(a, b) {
  const length = Math.min(a.length, b.length);
  let index = 0;
  while (index < length && a[index] === b[index]) index += 1;
  return index;
}

function describe(field, next, axum) {
  if (Array.isArray(next) && Array.isArray(axum)) {
    const index = firstDifference(next, axum);
    return `${field}: ${next.length} vs ${axum.length} entries, first difference at #${index}\n      next: ${next[index] ?? "(none)"}\n      axum: ${axum[index] ?? "(none)"}`;
  }
  if (typeof next === "string" && typeof axum === "string" && next.length > 120) {
    const index = firstDifference(next, axum);
    const from = Math.max(0, index - 40);
    return `${field}: ${next.length} vs ${axum.length} characters, first difference at ${index}\n      next: …${next.slice(from, index + 60)}\n      axum: …${axum.slice(from, index + 60)}`;
  }
  return `${field}:\n      next: ${JSON.stringify(next)}\n      axum: ${JSON.stringify(axum)}`;
}

function compare(target, next, axum) {
  const differences = [];
  const differ = (field, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) differences.push({ field, detail: describe(field, a, b) });
  };
  if (target.streamedRedirect) {
    const refresh = next.body.match(/<meta id="__next-page-redirect" http-equiv="refresh" content="\d+;url=([^"]*)"/);
    const location = comparableHeaders(axum.rawHeaders).get("location")?.[0];
    const nextTarget = refresh ? `${next.status} → ${refresh[1].replaceAll("&amp;", "&")}` : `${next.status} without a redirect`;
    differ("streamed redirect", nextTarget, `${axum.status === 307 ? 200 : axum.status} → ${location}`);
    return { differences, info: `→ ${location}` };
  }

  differ("status", next.status, axum.status);
  const nextHeaders = comparableHeaders(next.rawHeaders);
  const axumHeaders = comparableHeaders(axum.rawHeaders);
  for (const name of [...new Set([...nextHeaders.keys(), ...axumHeaders.keys()])].sort()) {
    differ(`header ${name}`, nextHeaders.get(name) ?? null, axumHeaders.get(name) ?? null);
  }
  if (next.status >= 300 && next.status < 400) {
    differ("redirect body", next.body, axum.body);
    return { differences, info: `→ ${nextHeaders.get("location")}` };
  }

  const a = facts(next, target.path, rendererOf(axum.body) === "axum");
  const b = facts(axum, target.path, false);
  for (const field of ["html", "title", "meta", "canonical", "hreflang", "feeds", "manifest", "jsonLd", "text", "links", "images"]) {
    differ(field === "jsonLd" ? "JSON-LD" : field, a[field], b[field]);
  }
  differ("icon links", a.icons, b.icons);
  differ("main markup", a.main, b.main);

  const expectations = [];
  for (const [name, facts] of [["next", a], ["axum", b]]) {
    if (target.index !== undefined && facts.noindex === target.index) {
      expectations.push(`${name} is ${facts.noindex ? "noindex" : "indexable"}, the target list says ${target.index ? "index" : "noindex"}`);
    }
  }
  if (target.renderer && b.renderer !== target.renderer) {
    expectations.push(`axum sent a page rendered by ${b.renderer}, the target list says ${target.renderer === "axum" ? "native" : "proxied"}`);
  }
  if (a.unresolved || b.unresolved) expectations.push(`streamed segments not placed: next ${a.unresolved}, axum ${b.unresolved}`);
  const info = [
    `rendered by ${b.renderer}`,
    a.noindex ? "noindex" : "indexable",
    `${a.jsonLd.length} JSON-LD`,
    `next metadata in ${a.metadataInHead ? "<head>" : "<body> (streamed)"}`,
    a.removed ? `${a.removed} not-ported nodes cut from next` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { differences, expectations, info };
}

/** The path and query of a URL or of a path. */
const pathOf = (value) => {
  const url = new URL(value, "http://targets.invalid");
  return `${url.pathname}${url.search}`;
};

function parseTargets(file, expectProxied) {
  const text = readFileSync(file, "utf8");
  if (/<urlset[\s>]/.test(text)) {
    return [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => ({
      path: pathOf(match[1].replaceAll("&amp;", "&")),
    }));
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [first, ...tokens] = line.split(/\s+/);
      const target = { path: /^https?:\/\//.test(first) ? pathOf(first) : first };
      for (const token of tokens) {
        if (/^\d{3}$/.test(token)) target.status = Number(token);
        else if (token === "index" || token === "noindex") target.index = token === "index";
        else if (token === "native" || token === "proxied") target.renderer = expectProxied || token === "proxied" ? "next" : "axum";
        else if (token === "streamed-redirect") target.streamedRedirect = !expectProxied;
        else throw new Error(`unknown expectation ${token} in: ${line}`);
      }
      return target;
    });
}

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const given = args.find((arg) => arg.startsWith(`--${name}=`));
  return given ? Number(given.split("=")[1]) : fallback;
};
const expectProxied = args.includes("--expect-proxied");
const cookie = args.find((arg) => arg.startsWith("--cookie="))?.slice("--cookie=".length);
const concurrency = option("concurrency", 4);
const examples = option("examples", 3);
const [nextBase, axumBase, targetsFile = new URL("./targets.txt", import.meta.url).pathname] = args.filter((arg) => !arg.startsWith("--"));
if (!nextBase || !axumBase || !(concurrency >= 1) || !(examples >= 0)) {
  console.error("usage: pages.mjs <next base url> <axum base url> [targets file] [--expect-proxied] [--concurrency=N] [--examples=N]");
  process.exit(2);
}
const host = new URL(nextBase).host;

async function check(target, agent, userAgent) {
  let next;
  let axum;
  try {
    [next, axum] = await Promise.all([
      request(nextBase, target.path, host, userAgent),
      request(axumBase, target.path, host, userAgent),
    ]);
  } catch (error) {
    return { target, agent, status: "---", info: "", expectations: [`request failed: ${error.message}`], unexpected: [], accepted: [] };
  }
  const { differences, expectations = [], info } = compare(target, next, axum);
  if (target.streamedRedirect) return { target, agent, status: next.status, info, expectations, unexpected: differences, accepted: [] };
  // The same request as HEAD: the status and headers of the GET, no body.
  const [nextHead, axumHead] = await Promise.all([
    request(nextBase, target.path, host, userAgent, "HEAD"),
    request(axumBase, target.path, host, userAgent, "HEAD"),
  ]);
  const headFacts = (response) => JSON.stringify({
    status: response.status,
    headers: Object.fromEntries([...comparableHeaders(response.rawHeaders)].sort(([a], [b]) => a.localeCompare(b))),
    body: response.body.length,
  });
  if (headFacts(nextHead) !== headFacts(axumHead)) {
    differences.push({ field: "HEAD", detail: describe("HEAD", headFacts(nextHead), headFacts(axumHead)) });
  }
  if (target.status !== undefined && next.status !== target.status) {
    expectations.push(`next answered ${next.status}, the target list says ${target.status}`);
  }
  const unexpected = [];
  const accepted = [];
  for (const difference of differences) {
    const entry = ACCEPTED.find((candidate) => candidate.when({ ...target, status: next.status }) && candidate.fields.includes(difference.field));
    if (entry) accepted.push([entry, difference.field]);
    else unexpected.push(difference);
  }
  return { target, agent, status: next.status, info, expectations, unexpected, accepted };
}

const jobs = parseTargets(targetsFile, expectProxied).flatMap((target) =>
  Object.entries(USER_AGENTS).map(([agent, userAgent]) => () => check(target, agent, userAgent)),
);
// Bounded concurrency; results keep the order of the targets.
const results = new Array(jobs.length);
let nextJob = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (nextJob < jobs.length) {
      const index = nextJob++;
      results[index] = await jobs[index]();
    }
  }),
);

let failures = 0;
const acceptedSeen = new Map();
const byKind = new Map();
for (const result of results) {
  for (const [entry, field] of result.accepted) {
    acceptedSeen.set(entry, (acceptedSeen.get(entry) ?? new Set()).add(field));
  }
  const failed = result.unexpected.length > 0 || result.expectations.length > 0;
  failures += failed ? 1 : 0;
  console.log(`${failed ? "DIFF" : "ok  "} ${result.status} ${result.agent.padEnd(9)} ${result.target.path}  (${result.info})`);
  const kinds = [
    ...result.expectations.map((message) => ["expectation", `expectation: ${message}`]),
    ...result.unexpected.map(({ field, detail }) => [field, detail]),
  ];
  for (const [kind, detail] of kinds) {
    const seen = byKind.get(kind) ?? { requests: 0, paths: new Set() };
    seen.requests += 1;
    seen.paths.add(result.target.path);
    byKind.set(kind, seen);
    if (seen.requests <= examples) console.log(`    ${detail}`);
  }
}

console.log("");
for (const [entry, fields] of acceptedSeen) {
  console.log(`accepted difference in ${[...fields].join(", ")}: ${entry.reason}`);
}
if (byKind.size) {
  console.log("\ndifferences by kind (requests, distinct paths):");
  for (const [kind, seen] of [...byKind].sort((a, b) => b[1].requests - a[1].requests)) {
    console.log(`  ${kind.padEnd(24)} ${String(seen.requests).padStart(6)} ${String(seen.paths.size).padStart(6)}`);
  }
}
console.log(failures === 0 ? `pages match (${results.length} requests)` : `${failures} of ${results.length} request(s) differ`);
process.exit(failures === 0 ? 0 : 1);
