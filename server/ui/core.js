// What the scripts of the native pages share. scripts/build-ui.mjs puts the
// files of this directory into one function scope, this one first, so the
// names below are visible to the others. A page is complete without any of
// it: the scripts add what a server cannot do, and read their inputs from
// `data-*` attributes of the markup the server rendered (src/pages/chrome).
const root = document.documentElement;
const main = document.querySelector("main");

/** Storage can be missing or throw (private browsing): never fatal. */
const storage = {
  get(area, key) {
    try {
      return window[area].getItem(key);
    } catch {
      return null;
    }
  },
  set(area, key, value) {
    try {
      window[area].setItem(key, value);
    } catch {
      /* the feature works without it */
    }
  },
  remove(area, key) {
    try {
      window[area].removeItem(key);
    } catch {
      /* the feature works without it */
    }
  },
};

// @next/third-parties GoogleAnalytics: the tag is an async script in the
// document; this is its init call. Without an id there is no `gtag`.
if (root.dataset.ga) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", root.dataset.ga);
}

// lib/analytics.ts: GA4, and the events the server keeps for itself.
const DURABLE_EVENTS = new Set([
  "meme_view", "follow_click", "copy", "paywall_view", "share_click", "quiz_start",
  "quiz_complete", "traffic_source", "plus_weekly_brief_opened", "plus_weekly_brief_clicked",
]);

function sendDurable(event, params) {
  if (!DURABLE_EVENTS.has(event)) return;
  try {
    const payload = JSON.stringify({ eventName: event, path: location.pathname, params });
    if (navigator.sendBeacon?.("/api/analytics/events", new Blob([payload], { type: "application/json" }))) return;
    fetch("/api/analytics/events", {
      method: "POST",
      body: payload,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
  } catch {
    /* analytics must not break the page */
  }
}

/** `track()`: `destination` is "both", "ga" or "durable". */
function track(event, params, destination = "both") {
  const eventParams = { ...(params ?? {}) };
  delete eventParams.query;
  try {
    if (destination !== "durable") window.gtag?.("event", event, eventParams);
  } catch {
    /* analytics must not break the page */
  }
  if (destination !== "ga") sendDurable(event, eventParams);
}

/** `whenGtagReady()`: runs `callback` once `gtag` exists, for about 6 s. */
function whenGtagReady(callback) {
  if (window.gtag) {
    callback();
    return;
  }
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.gtag) {
      clearInterval(timer);
      callback();
    } else if (attempts >= 40) {
      clearInterval(timer);
    }
  }, 150);
}

// lib/db/client.ts: the session is better-auth's, served by whichever server
// owns /api/auth today; one request serves every feature of the page.
let sessionRequest = null;
function currentUser() {
  sessionRequest ??= fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => body?.user ?? null)
    .catch(() => null);
  return sessionRequest;
}

/** lib/db/plan.ts: a query plan as the planner client posts it. */
function queryPlan(op, name, { fields = [{ kind: "star" }], filters = [], single = false, maybeSingle = false, args } = {}) {
  return {
    op,
    ...(op === "rpc" ? { fn: name } : { table: name }),
    fields,
    filters,
    orGroups: [],
    orders: [],
    limit: null,
    offset: null,
    single,
    maybeSingle,
    count: null,
    head: false,
    onConflict: null,
    ignoreDuplicates: false,
    returning: op === "select" || op === "rpc",
    ...(op === "rpc" ? { args } : {}),
  };
}

// app/api/db/query/route.ts answers `503 "database busy"` with Retry-After
// when six queries are already running in the process, before it runs this
// one. Sent again once after that wait: read as an error, a saved meme shows
// as not saved and a signed-in user has no nickname.
const BUSY_RETRY_MAX_SECONDS = 5;

/** POST /api/db/query: `{ data, error }`, or a network error in that shape. */
async function runPlan(plan, retried = false) {
  try {
    const response = await fetch("/api/db/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ plan }),
    });
    const body = await response.json();
    if (response.status === 503 && body?.error?.message === "database busy" && !retried) {
      const wait = Math.min(Number(response.headers.get("retry-after")) || 1, BUSY_RETRY_MAX_SECONDS);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      return runPlan(plan, true);
    }
    return body;
  } catch {
    return { data: null, error: { message: "network" } };
  }
}

/** `db.from(table).select(columns).eq(column, value)`, `.single()` or `.maybeSingle()`. */
const selectOne = (table, columns, column, value, single) =>
  runPlan(queryPlan("select", table, {
    fields: columns.map((name) => ({ kind: "column", name })),
    filters: [{ column, op: "eq", value }],
    single,
    maybeSingle: !single,
  }));

/** `db.rpc(fn, args)`. */
const rpc = (fn, args) => runPlan(queryPlan("rpc", fn, { args }));

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal from a `<template>` of the frame, as login-gate.tsx and
 * pwa-install.tsx run theirs: focus moves into the panel, Tab stays inside,
 * Escape and every `[data-close]` close it, and focus returns to where it
 * was. Returns the dialog element and its `close`.
 */
function openModal(template, { lockScroll = false, onClose } = {}) {
  const dialog = template.content.firstElementChild.cloneNode(true);
  const panel = dialog.querySelector("[data-panel]");
  const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const bodyStyle = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
  const onKey = (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = panel.querySelectorAll(FOCUSABLE);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  function close() {
    if (!dialog.isConnected) return;
    document.removeEventListener("keydown", onKey);
    dialog.remove();
    if (lockScroll) Object.assign(document.body.style, bodyStyle);
    returnTo?.focus({ preventScroll: true });
    onClose?.();
  }
  dialog.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  if (lockScroll) {
    const scrollbar = innerWidth - root.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    document.body.style.overflow = "hidden";
  }
  document.body.append(dialog);
  panel.focus();
  return { dialog, close };
}

/**
 * One open disclosure at a time (the header menu, the account menu): its
 * panel is the `template[data-panel]` next to its button, in the document
 * only while open, as in the React components. A press outside its container
 * or Escape closes it, and Escape returns focus to its button.
 */
let openDisclosure = null;
const disclosurePanels = new WeakMap();
function disclosurePanel(button) {
  if (!disclosurePanels.has(button)) {
    const template = button.parentElement.querySelector(":scope > template[data-panel]");
    disclosurePanels.set(button, template.content.firstElementChild.cloneNode(true));
  }
  return disclosurePanels.get(button);
}
function setDisclosure(button, panel, open) {
  button.setAttribute("aria-expanded", String(open));
  if (open) button.after(panel);
  else panel.remove();
  if (open) {
    if (openDisclosure && openDisclosure.button !== button) {
      setDisclosure(openDisclosure.button, openDisclosure.panel, false);
    }
    openDisclosure = { button, panel };
  } else if (openDisclosure?.button === button) {
    openDisclosure = null;
  }
  button.dispatchEvent(new CustomEvent("disclosure", { detail: open }));
}
document.addEventListener("pointerdown", (event) => {
  if (openDisclosure && !openDisclosure.button.parentElement.contains(event.target)) {
    setDisclosure(openDisclosure.button, openDisclosure.panel, false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !openDisclosure) return;
  const { button, panel } = openDisclosure;
  setDisclosure(button, panel, false);
  button.focus();
});

/**
 * Work that reads the frame: run now, and again after the language switch
 * replaces the frame's parts (locale.js).
 */
const frameTasks = [];
function onFrame(task) {
  frameTasks.push(task);
  task();
}
function frameChanged() {
  openDisclosure = null;
  for (const task of frameTasks) task();
}
// What page bundles (assets/pages/*.js) use of the frame.
window.memecatch = Object.freeze({ track });
