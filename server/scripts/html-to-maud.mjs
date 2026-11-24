#!/usr/bin/env node
// Prints the Maud source for part of a page the Next app renders, so a page
// port starts from the markup Next really sends and not from a reading of the
// TSX. The output is static: replace the parts that depend on data by hand.
//
//   [MAUD_COOKIE=<cookie header>] node server/scripts/html-to-maud.mjs <url> '<css selector>' [--inner]
//
// The page is fetched once and settled the way the parity gate settles it
// (parity/pages/dom.mjs), so streamed segments are in place. `--inner` prints
// the children of the matched element instead of the element.
//
// Needs the packages of the repository root (jsdom).
import { settle } from "../parity/pages/dom.mjs";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style"]);
// A plain Rust identifier with dashes is a valid Maud name. Anything else
// (a colon, a leading digit) is written as a string literal.
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*$/;

const quote = (text) => `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
const name = (value) => (PLAIN_NAME.test(value) ? value : quote(value));

function attributes(element) {
  return [...element.attributes]
    .map(({ name: key, value }) => (value === "" ? name(key) : `${name(key)}=${quote(value)}`))
    .join(" ");
}

function render(node, depth, out) {
  const pad = "    ".repeat(depth);
  if (node.nodeType === 3) {
    if (node.data !== "") out.push(`${pad}${quote(node.data)}`);
    return;
  }
  if (node.nodeType !== 1) return; // comments: React's text separators and Suspense markers
  const tag = node.localName;
  const head = [tag, attributes(node)].filter(Boolean).join(" ");
  if (VOID.has(tag)) {
    out.push(`${pad}${head};`);
    return;
  }
  if (RAW_TEXT.has(tag)) {
    out.push(`${pad}${head} { (PreEscaped(${quote(node.textContent)})) }`);
    return;
  }
  // React splits one text into several nodes around an expression; merge them back.
  const children = [];
  for (const child of node.childNodes) {
    const last = children.at(-1);
    if (child.nodeType === 3 && last?.nodeType === 3) last.data += child.data;
    else if (child.nodeType === 3) children.push({ nodeType: 3, data: child.data });
    else if (child.nodeType === 1) children.push(child);
  }
  if (children.length === 0) {
    out.push(`${pad}${head} {}`);
    return;
  }
  if (children.length === 1 && children[0].nodeType === 3) {
    out.push(`${pad}${head} { ${quote(children[0].data)} }`);
    return;
  }
  out.push(`${pad}${head} {`);
  for (const child of children) render(child, depth + 1, out);
  out.push(`${pad}}`);
}

const [url, selector, flag] = process.argv.slice(2);
if (!url || !selector) {
  console.error("usage: html-to-maud.mjs <url> '<css selector>' [--inner]");
  process.exit(2);
}
// A page that shows a signed-in state: MAUD_COOKIE is sent as the Cookie header.
const cookie = process.env.MAUD_COOKIE;
const response = await fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
const { document, unresolved } = settle(await response.text());
if (unresolved > 0) console.error(`warning: ${unresolved} streamed segment(s) could not be placed`);
const matches = [...document.querySelectorAll(selector)];
if (matches.length === 0) {
  console.error(`no element matches ${selector} (status ${response.status})`);
  process.exit(1);
}
const out = [];
for (const element of matches) {
  if (flag === "--inner") for (const child of element.childNodes) render(child, 0, out);
  else render(element, 0, out);
}
console.log(out.join("\n"));
