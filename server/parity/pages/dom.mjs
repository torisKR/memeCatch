// Turns the HTML a server sent into the document a reader ends up with.
//
// Next streams a page in pieces: a shell with loading fallbacks, then hidden
// `<div id="S:n">` segments and inline `$RC`/`$RS` calls that move each
// segment into place. `settle` replays those moves itself: no page script
// runs, so nothing is hydrated and no client component changes the markup.
// A server that sends finished HTML (the Axum pages) passes through unchanged.
//
// Needs the packages of the repository root (jsdom).
import { JSDOM } from "jsdom";

const REVEAL = /\$R([CS])\("([^"]+)","([^"]+)"/g;

function childrenOf(node) {
  return [...node.childNodes];
}

/** `$RS(segment, placeholder)`: the segment's children replace `<template id=placeholder>`. */
function fillPlaceholder(document, segmentId, placeholderId) {
  const segment = document.getElementById(segmentId);
  const placeholder = document.getElementById(placeholderId);
  if (!segment || !placeholder) return false;
  placeholder.replaceWith(...childrenOf(segment));
  segment.remove();
  return true;
}

/**
 * `$RC(boundary, segment)`: the fallback between `<!--$?-->` and its closing
 * `<!--/$-->` is replaced by the segment's children.
 */
function completeBoundary(document, boundaryId, segmentId) {
  const marker = document.getElementById(boundaryId);
  const segment = document.getElementById(segmentId);
  if (!marker || !segment) return false;
  const open = marker.previousSibling;
  const parent = marker.parentNode;
  let depth = 0;
  let node = marker;
  while (node) {
    const next = node.nextSibling;
    if (node.nodeType === 8) {
      const text = node.data;
      if (text === "/$") {
        if (depth === 0) break;
        depth -= 1;
      } else if (text === "$" || text === "$?" || text === "$!" || text === "$~") {
        depth += 1;
      }
    }
    node.remove();
    node = next;
  }
  const closing = node;
  for (const child of childrenOf(segment)) parent.insertBefore(child, closing);
  if (open && open.nodeType === 8) open.data = "$";
  segment.remove();
  return true;
}

/** Parses `html` and applies every streamed reveal, in the order the page sent them. */
export function settle(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const reveals = [...html.matchAll(REVEAL)].map((match) => ({ kind: match[1], a: match[2], b: match[3] }));
  // A reveal can target a segment that an earlier reveal has yet to move into
  // the tree, so retry until a pass changes nothing.
  let pending = reveals;
  while (pending.length > 0) {
    const left = pending.filter(({ kind, a, b }) =>
      kind === "S" ? !fillPlaceholder(document, a, b) : !completeBoundary(document, a, b),
    );
    if (left.length === pending.length) break;
    pending = left;
  }
  return { document, unresolved: pending.length, streamedSegments: reveals.length };
}
