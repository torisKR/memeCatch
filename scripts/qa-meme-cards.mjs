#!/usr/bin/env node
/** Disposable-browser meme-card QA. Never attaches to a user's browser profile. */
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { mkdir, mkdtemp, open, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const LOCAL_QA_ORIGIN = "http://127.0.0.1:3012";
export const PRODUCTION_ORIGIN = "https://catchmeme.com";
const DEFAULT_ARTIFACT_ROOT = fileURLToPath(new URL("../.local/", import.meta.url));
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DETAIL_PATHS = [
  "/memes/89b37mrx-%EC%83%88%EC%82%AD%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)",
  "/memes/89b37mrx-%EC%83%88%EC%8B%B9%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)",
  "/memes/89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)",
];
const VIEWPORTS = [
  { name: "mobile-320x568", width: 320, height: 568, mobile: true, input: "touch", motion: "no-preference" },
  { name: "mobile-375x812", width: 375, height: 812, mobile: true, input: "touch", motion: "no-preference" },
  { name: "mobile-390x844-reduced", width: 390, height: 844, mobile: true, input: "touch", motion: "reduce" },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false, input: "mouse", motion: "no-preference" },
];

export function validateReleaseOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Release origin must be an absolute URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Release origin must be a credential-free HTTPS origin");
  }
  const host = url.hostname.toLowerCase();
  const isMemecatchDeployment = /^memecatch-[a-z0-9-]+\.vercel\.app$/.test(host);
  if (!isMemecatchDeployment) throw new Error("Release origin must be an exact memecatch-*.vercel.app deployment origin");
  return url.origin;
}

export function validateQaOrigin(value, release = false) {
  if (release) return validateReleaseOrigin(value);
  if (value !== LOCAL_QA_ORIGIN && value !== PRODUCTION_ORIGIN) {
    throw new Error(`QA origin must be ${LOCAL_QA_ORIGIN} or ${PRODUCTION_ORIGIN}`);
  }
  return value;
}

export function parseArgs(argv) {
  const args = { origin: LOCAL_QA_ORIGIN, out: DEFAULT_ARTIFACT_ROOT, release: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--origin") args.origin = argv[++index];
    else if (value === "--release-origin") { args.origin = argv[++index]; args.release = true; }
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--protection-bypass-file") {
      args.protectionBypassFile = argv[++index];
      if (!args.protectionBypassFile) throw new Error("Protection bypass file requires a value");
    }
    else if (value === "--card-id") {
      args.cardId = argv[++index];
      if (!/^mc-\d{4}$/.test(args.cardId ?? "") || args.cardId === "mc-0000") throw new Error("QA card ID must be mc-0001..mc-1000");
      if (Number(args.cardId.slice(3)) > 1000) throw new Error("QA card ID must be mc-0001..mc-1000");
    }
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.origin) throw new Error("Origin argument requires a value");
  if (!args.out) throw new Error("Output argument requires a value");
  args.origin = validateQaOrigin(args.origin, args.release);
  if (args.protectionBypassFile && !args.release) {
    throw new Error("Protection bypass file requires an explicit release origin");
  }
  args.out = isAbsolute(args.out) ? args.out : resolve(process.cwd(), args.out);
  if (args.protectionBypassFile) {
    args.protectionBypassFile = isAbsolute(args.protectionBypassFile)
      ? args.protectionBypassFile
      : resolve(process.cwd(), args.protectionBypassFile);
  }
  return args;
}

export async function readProtectionBypassToken(path) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error("Protection bypass file must be a regular non-symlink file");
    if (stats.size > 256) throw new Error("Protection bypass file must be at most 256 bytes");
    const token = await handle.readFile({ encoding: "utf8" });
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(token)) {
      throw new Error("Protection bypass token must be 16..256 ASCII letters, digits, underscore, or hyphen");
    }
    return token;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Protection bypass")) throw error;
    throw new Error("Protection bypass file must be a readable regular non-symlink file");
  } finally {
    await handle?.close();
  }
}

export function protectionBypassHeaders({
  release,
  releaseOrigin,
  bypassToken,
  method,
  requestUrl,
  requestHeaders = {},
  setBypassCookie = false,
}) {
  if (!release || shouldBlockRequest(method) || !/^[A-Za-z0-9_-]{16,256}$/.test(bypassToken ?? "")) {
    return undefined;
  }
  let validatedOrigin;
  let url;
  try {
    validatedOrigin = validateReleaseOrigin(releaseOrigin);
    url = new URL(requestUrl);
  } catch {
    return undefined;
  }
  if (url.origin !== validatedOrigin || url.username || url.password) return undefined;
  const headers = Object.entries(requestHeaders)
    .filter(([name]) => ![
      "x-vercel-protection-bypass",
      "x-vercel-set-bypass-cookie",
    ].includes(name.toLowerCase()))
    .map(([name, value]) => ({ name, value: String(value) }));
  headers.push({ name: "x-vercel-protection-bypass", value: bypassToken });
  if (setBypassCookie) {
    headers.push({ name: "x-vercel-set-bypass-cookie", value: "true" });
  }
  return headers;
}

export function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.toString();
  } catch { return "[invalid-url]"; }
}

export function sanitizeDiagnostic(value) {
  let text = String(value ?? "");
  text = text.replace(/https?:\/\/[^\s"'<>]+/gi, match => sanitizeUrl(match));
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]");
  text = text.replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]{10,})?\b/gi, "[redacted-token]");
  text = text.replace(/\/Users\/[^/\s]+/g, "/Users/[redacted-user]");
  return text.slice(0, 1200);
}

export function sanitizeProtectionBypassDiagnostic(value, bypassToken) {
  const text = bypassToken
    ? String(value ?? "").replaceAll(bypassToken, "[redacted-token]")
    : value;
  return sanitizeDiagnostic(text);
}

export function shouldBlockRequest(method) {
  return !SAFE_METHODS.has(String(method).toUpperCase());
}

export function cancelPendingCommands(pending) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error("QA browser shutting down"));
  }
  pending.clear();
}

export function isCanceledReadInterception(method, error) {
  if (method !== "Fetch.continueRequest") return false;
  try {
    const detail = JSON.parse(error.message);
    return detail.code === -32602 && detail.message === "Invalid InterceptionId.";
  } catch { return false; }
}

export function validateDetailResult(result, targetOrigin) {
  if (result.status !== 200) throw new Error(`Detail document must return HTTP 200 (received ${result.status ?? "unknown"})`);
  let final;
  try { final = new URL(result.final); } catch { throw new Error("Detail final URL is invalid"); }
  if (final.origin !== targetOrigin) throw new Error("Detail final origin escaped the QA target");
  if (!final.pathname.startsWith("/memes/89b37mrx-")) throw new Error("Detail final path lost the immutable meme short ID");
  if (result.chain.length !== 0) throw new Error("Detail alias unexpectedly used an HTTP redirect");
  const visibleIdentity = `${result.title} ${result.heading}`;
  if (!visibleIdentity.includes("새삥 챌린지") || !visibleIdentity.includes("지코")) throw new Error("Detail did not render the 새삥 챌린지 (지코) identity");
}

export function validateZicoCardResult(result) {
  if (result.cardId !== "mc-0012" || !result.text?.includes("새삥 챌린지") || !result.text.includes("스트릿 맨 파이터") || !result.text.includes("리더 계급 미션곡") || /Freak-y|후렴 팔 동작/.test(result.text)) throw new Error("Corrected 새삥 card copy did not render");
  if (!result.symbols?.includes("dance-follow") || !result.symbols.includes("repeat") || result.symbols.includes("footsteps")) throw new Error("Corrected 새삥 follow symbols did not render");
}

function chromeExecutable() {
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  return "google-chrome";
}

function waitForChromeEndpoint(chrome) {
  return new Promise((resolveEndpoint, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error("Chrome debugging endpoint unavailable")), 15_000);
    chrome.stderr.on("data", chunk => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolveEndpoint(match[1]); }
    });
    chrome.once("error", error => { clearTimeout(timer); reject(error); });
    chrome.once("exit", code => {
      if (!stderr.includes("DevTools listening on")) { clearTimeout(timer); reject(new Error(`Chrome exited before QA started (${code})`)); }
    });
  });
}

function toConsoleText(args = []) {
  return args.map(argument => argument.value ?? argument.description ?? argument.type).join(" ");
}

export async function runMemeCardQa(options) {
  const protectionBypassToken = options.protectionBypassFile
    ? await readProtectionBypassToken(options.protectionBypassFile)
    : null;
  await mkdir(options.out, { recursive: true });
  const directory = await mkdtemp(join(options.out, "meme-card-qa-"));
  const chrome = spawn(chromeExecutable(), [
    "--headless=new", `--user-data-dir=${join(directory, "profile")}`, "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--metrics-recording-only", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  let browserClose;
  let captureFailureEvidence;
  let activeViewport = null;
  let closing = false;
  let protectionBootstrapPending = false;
  const diagnostics = { console: [], runtime: [], log: [], expectedBlockedLogs: [], firstPartyNetwork: [], thirdPartyNetwork: [], blockedWrites: [], control: [], canceledReadInterceptions: [] };
  const viewports = [];
  const redirects = [];
  const documentResponses = [];
  let currentTargetOrigin = options.origin;
  let currentRoute = "about:blank";

  try {
    const endpoint = await waitForChromeEndpoint(chrome);
    socket = new WebSocket(endpoint);
    await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    const listeners = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
        return;
      }
      const handlers = listeners.get(message.method);
      if (handlers) for (const handler of handlers) handler(message.params, message.sessionId);
    };
    function send(method, params = {}, sessionId) {
      return new Promise((resolveResult, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, method === "Page.navigate" ? 45_000 : 20_000);
        pending.set(id, { resolve: resolveResult, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    browserClose = async () => {
      closing = true;
      listeners.clear();
      cancelPendingCommands(pending);
      await Promise.race([send("Browser.close").catch(() => {}), delay(1000)]);
      cancelPendingCommands(pending);
    };
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const cdp = (method, params = {}) => send(method, params, sessionId);
    const requestUrls = new Map();
    const intentionallyBlockedRequestIds = new Set();
    const on = (method, handler) => {
      const handlers = listeners.get(method) ?? new Set(); handlers.add(handler); listeners.set(method, handlers);
      return () => handlers.delete(handler);
    };
    const evaluate = async expression => {
      const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(sanitizeDiagnostic(result.exceptionDetails.text));
      return result.result.value;
    };

    // Install listeners before the first application navigation.
    on("Runtime.consoleAPICalled", params => {
      if (params.type === "error" || params.type === "warning") diagnostics.console.push({ route: currentRoute, level: params.type, text: sanitizeDiagnostic(toConsoleText(params.args)) });
    });
    on("Runtime.exceptionThrown", params => diagnostics.runtime.push({ route: currentRoute, text: sanitizeDiagnostic(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text) }));
    on("Log.entryAdded", params => {
      if (!["error", "warning"].includes(params.entry.level)) return;
      const row = { route: currentRoute, level: params.entry.level, source: sanitizeDiagnostic(params.entry.source), url: params.entry.url ? sanitizeUrl(params.entry.url) : null, requestId: params.entry.networkRequestId ?? null, text: sanitizeDiagnostic(params.entry.text) };
      const blockedWrite = [...diagnostics.blockedWrites].reverse().find(write =>
        (row.requestId && write.requestId === row.requestId) || (row.url && write.url === row.url) || (!row.url && row.source === "network" && write.route === row.route));
      const isExpectedBlock = row.text.includes("ERR_BLOCKED_BY_CLIENT") && Boolean(blockedWrite);
      if (isExpectedBlock) diagnostics.expectedBlockedLogs.push({ ...row, blockedWrite: { method: blockedWrite.method, url: blockedWrite.url } });
      else diagnostics.log.push(row);
    });
    const networkBucket = url => {
      try { return new URL(url).origin === currentTargetOrigin ? diagnostics.firstPartyNetwork : diagnostics.thirdPartyNetwork; }
      catch { return diagnostics.firstPartyNetwork; }
    };
    on("Network.requestWillBeSent", params => requestUrls.set(params.requestId, params.request.url));
    on("Network.loadingFinished", params => requestUrls.delete(params.requestId));
    on("Network.loadingFailed", params => {
      if (intentionallyBlockedRequestIds.delete(params.requestId)) { requestUrls.delete(params.requestId); return; }
      if (params.canceled || params.blockedReason === "inspector") return;
      const url = requestUrls.get(params.requestId) ?? "";
      requestUrls.delete(params.requestId);
      networkBucket(url).push({ route: currentRoute, kind: "request-failed", url: sanitizeUrl(url), reason: sanitizeDiagnostic(params.errorText) });
    });
    on("Network.responseReceived", params => {
      if (params.type === "Document") {
        const headers = Object.fromEntries(Object.entries(params.response.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
        documentResponses.push({ route: currentRoute, status: params.response.status, url: sanitizeUrl(params.response.url), releaseSha: headers["x-memecatch-release-sha"] ?? null });
      }
      if (params.response.status >= 400) networkBucket(params.response.url).push({ route: currentRoute, kind: "http-error", status: params.response.status, url: sanitizeUrl(params.response.url) });
    });
    on("Fetch.requestPaused", params => {
      const complete = (method, payload) => {
        void cdp(method, payload).catch(error => {
          if (closing) return;
          const row = { route: currentRoute, method, url: sanitizeUrl(params.request.url), text: sanitizeProtectionBypassDiagnostic(error.message, protectionBypassToken) };
          // Chrome may cancel an allowed GET while navigation replaces its frame.
          // Keep this separate; failure to block a write is never waived.
          if (isCanceledReadInterception(method, error)) diagnostics.canceledReadInterceptions.push(row);
          else diagnostics.control.push(row);
        });
      };
      if (shouldBlockRequest(params.request.method)) {
        diagnostics.blockedWrites.push({ route: currentRoute, method: params.request.method, url: sanitizeUrl(params.request.url), requestId: params.networkId ?? null });
        if (params.networkId) intentionallyBlockedRequestIds.add(params.networkId);
        complete("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
      } else {
        const setBypassCookie = protectionBootstrapPending && params.resourceType === "Document";
        const headers = protectionBypassHeaders({
          release: options.release,
          releaseOrigin: options.origin,
          bypassToken: protectionBypassToken,
          method: params.request.method,
          requestUrl: params.request.url,
          requestHeaders: params.request.headers,
          setBypassCookie,
        });
        if (setBypassCookie && headers) protectionBootstrapPending = false;
        complete("Fetch.continueRequest", {
          requestId: params.requestId,
          ...(headers ? { headers } : {}),
        });
      }
    });

    await Promise.all([cdp("Page.enable"), cdp("Runtime.enable"), cdp("Log.enable"), cdp("Network.enable"), cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] })]);
    await cdp("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp("Network.setBypassServiceWorker", { bypass: true });

    async function waitFor(expression, message, attempts = 120) {
      for (let index = 0; index < attempts; index++) {
        if (await evaluate(expression)) return;
        await delay(100);
      }
      throw new Error(message);
    }
    async function navigate(path) {
      if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Only relative application routes are allowed");
      currentRoute = path;
      await cdp("Page.navigate", { url: options.origin + path });
      await waitFor("document.readyState === 'complete'", `Page did not load: ${path}`);
    }
    async function bootstrapProtectionCookie() {
      if (!protectionBypassToken) return;
      currentRoute = "protection-bootstrap";
      protectionBootstrapPending = true;
      await cdp("Page.navigate", { url: `${options.origin}/` });
      await waitFor("document.readyState === 'complete'", "Protection bootstrap document did not load");
      await waitFor(`location.origin === ${JSON.stringify(options.origin)}`, "Protection bootstrap escaped the staged origin");
      if (protectionBootstrapPending) throw new Error("Protection bootstrap did not issue the staged Document request");
    }
    async function screenshot(name) {
      const capture = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const path = join(directory, `${name}.png`);
      await writeFile(path, Buffer.from(capture.data, "base64"));
      return path;
    }
    async function actualClick(selector, input = "mouse") {
      await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',inline:'center'})`);
      await delay(80);
      const point = await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});const r=element?.getBoundingClientRect();return r&&{x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()`);
      if (!point?.width || !point?.height) return false;
      if (input === "touch") {
        await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, force: .5, id: 1 }] });
        await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 });
        await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 });
      }
      return true;
    }
    captureFailureEvidence = async () => {
      const domState = await evaluate(`(()=>{const canvas=document.querySelector('[data-testid="scratch-canvas"]');const rect=canvas?.getBoundingClientRect();const area=document.querySelector('[data-scratch-progress]');const center=rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2):null;return {url:location.origin+location.pathname,readyState:document.readyState,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,scrollWidth:document.documentElement.scrollWidth},scratch:{present:!!canvas,canvasState:canvas?.dataset.canvasState??null,rawProgress:Number(area?.dataset.scratchProgress||0),revealed:area?.dataset.revealed==='true',state:area?.dataset.scratchState??null,rect:rect&&{x:rect.x,y:rect.y,width:rect.width,height:rect.height,topVisible:rect.top>=0,bottomVisible:rect.bottom<=innerHeight},centerElement:center&&{tag:center.tagName,role:center.getAttribute('role'),testId:center.getAttribute('data-testid'),className:String(center.className).slice(0,240)}}}})()`);
      domState.url = sanitizeUrl(domState.url);
      return { domState, screenshot: await screenshot(`failure-${activeViewport?.name ?? "browser"}`) };
    };
    async function dispatchScratch(input, reduced, motionBefore) {
      const checkpoints = [];
      const rows = 9;
      const points = [];
      for (let row = 0; row < rows; row++) {
        const y = .12 + (.82 - .12) * (row / (rows - 1));
        const forward = row % 2 === 0;
        for (let column = 0; column < 9; column++) {
          const fraction = column / 8;
          points.push({ x: forward ? .09 + (.91 - .09) * fraction : .91 - (.91 - .09) * fraction, y });
        }
      }
      const state = () => evaluate(`(()=>{const a=document.querySelector('[data-scratch-progress]');return {raw:Number(a?.dataset.scratchProgress||0),normalized:Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')||100),revealed:a?.dataset.revealed==='true',dust:document.querySelector('[data-scratch-dust]')?.children.length||0,animations:document.getAnimations().filter(a=>a.playState==='running').map(a=>({name:a.animationName||'',target:a.effect?.target?.getAttribute?.('data-scratch-dust')!==null?'scratch-dust':a.effect?.target?.className||''})).slice(0,20)}})()`);
      const coordinate = async point => {
        const current = await evaluate(`(()=>{const r=document.querySelector('[data-testid="scratch-canvas"]')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight}})()`);
        if (!current?.width || !current?.height) {
          const currentState = await state();
          if (currentState.revealed) return null;
          throw new Error("Scratch canvas moved out of the interactive layout");
        }
        if (activeViewport) {
          activeViewport.lastRect = current;
          activeViewport.canvasViewport = { left: current.x, top: current.y, right: current.x + current.width, bottom: current.y + current.height, viewportWidth: current.viewportWidth, viewportHeight: current.viewportHeight };
        }
        return { x: current.x + current.width * point.x, y: current.y + current.height * point.y };
      };
      const first = await coordinate(points[0]);
      if (input === "touch") {
        await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: first.x, y: first.y, radiusX: 8, radiusY: 8, force: .55, id: 1 }] });
        for (let index = 1; index < points.length; index++) {
          const point = await coordinate(points[index]);
          if (!point) break;
          await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y: point.y, radiusX: 8, radiusY: 8, force: .65, id: 1 }] });
          if (index % 8 === 0) { checkpoints.push(await state()); if (activeViewport) activeViewport.checkpoints = checkpoints; if (checkpoints.at(-1).revealed) break; }
        }
        await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: first.x, y: first.y, button: "left", buttons: 1, clickCount: 1 });
        let last = first;
        for (let index = 1; index < points.length; index++) {
          const point = await coordinate(points[index]);
          if (!point) break;
          last = point;
          await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1 });
          if (index % 8 === 0) { checkpoints.push(await state()); if (activeViewport) activeViewport.checkpoints = checkpoints; if (checkpoints.at(-1).revealed) break; }
        }
        await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", buttons: 0, clickCount: 1 });
      }
      await waitFor(`document.querySelector('[data-revealed="true"]') !== null`, "Scratch gesture did not reveal the selected card", 80);
      const final = await state();
      const motion = await evaluate(`(()=>{const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const dust=document.querySelector('[data-scratch-dust]');const scratch=document.querySelector('[data-scratch-progress]');const card=scratch?.querySelector('[data-complete="true"]');return {reduce,dustDisplay:dust?getComputedStyle(dust).display:null,dustChildren:dust?.children.length||0,cardAnimation:card?getComputedStyle(card).animationName:null,runningAnimations:document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName||'').filter(Boolean)}})()`);
      const progressed = checkpoints.some(point => point.normalized > 0 && point.normalized < 100);
      if (!progressed || !final.revealed) throw new Error("Scratch interaction did not produce measurable progress and reveal");
      if (reduced && (!motion.reduce || motion.dustChildren !== 0 || motion.cardAnimation !== "none" || motionBefore.dustDisplay !== "none" || motionBefore.cardTransition !== "0s" || motionBefore.cardTransform !== "none" || motionBefore.progressAnimation !== "none")) throw new Error("Reduced-motion scratch effects are still animated");
      if (!reduced && (motion.reduce || motionBefore.dustDisplay === "none" || !checkpoints.some(point => point.dust > 0 || point.animations.some(animation => animation.name.endsWith("foilDust"))))) throw new Error("No-preference dust animation was not observed");
      return { checkpoints, final, motionBefore, motion };
    }

    await bootstrapProtectionCookie();

    for (const [viewportIndex, viewport] of VIEWPORTS.entries()) {
      activeViewport = { name: viewport.name, width: viewport.width, height: viewport.height, input: viewport.input, motion: viewport.motion, phase: "configure", checkpoints: [] };
      await cdp("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.mobile ? 2 : 1, mobile: viewport.mobile });
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, ...(viewport.mobile ? { maxTouchPoints: 5 } : {}) });
      await cdp("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: viewport.motion }] });
      await navigate("/meme-cards");
      activeViewport.phase = "gallery-loaded";
      await waitFor("document.querySelectorAll('button[data-card-id]').length > 0", "Meme-card catalog did not render");
      let announcement = { expected: viewportIndex === 0, appeared: false, dismissed: false };
      if (viewportIndex === 0) {
        await waitFor("document.querySelector('[role=dialog][aria-labelledby=changelog-title]') !== null", "First-visit changelog announcement did not appear", 40);
        announcement = { ...announcement, appeared: true };
        if (!await actualClick('[role=dialog][aria-labelledby=changelog-title] button:not([aria-label])', viewport.input)) throw new Error("Changelog confirmation control was not clickable");
        await waitFor("document.querySelector('[role=dialog][aria-labelledby=changelog-title]') === null && document.body.style.overflow !== 'hidden'", "Changelog announcement did not dismiss");
        announcement.dismissed = true;
      }
      const document = documentResponses.findLast(response => response.route === "/meme-cards");
      if (!document || document.status !== 200 || new URL(document.url).origin !== options.origin) throw new Error(`Gallery document failed at ${viewport.name}`);
      const before = await evaluate(`(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:document.querySelectorAll('button[data-card-id]').length,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches}))()`);
      if (before.scrollWidth > before.width + 1) throw new Error(`Horizontal overflow at ${viewport.name}`);
      const cardSelector = options.cardId ? `button[data-card-id="${options.cardId}"]` : 'button[data-card-id]';
      await waitFor(`document.querySelector(${JSON.stringify(cardSelector)}) !== null`, "Requested card did not render on the gallery page");
      const selectedCardId = await evaluate(`document.querySelector(${JSON.stringify(cardSelector)})?.getAttribute('data-card-id')`);
      let selected = false;
      for (let attempt = 0; attempt < 20 && !selected; attempt++) {
        if (!await actualClick(cardSelector, viewport.input)) { await delay(100); continue; }
        await delay(120);
        selected = await evaluate(`${JSON.stringify(selectedCardId)} === new URL(location.href).searchParams.get('card') && document.querySelector('[data-scratch-progress]')?.getAttribute('data-card-id') === ${JSON.stringify(selectedCardId)}`);
      }
      if (!selected) throw new Error("Hydrated catalog card did not respond to real browser input");
      activeViewport.phase = "card-selected";
      await waitFor(`document.querySelector('[data-testid="scratch-canvas"][data-canvas-state="ready"]') !== null`, "Scratch canvas did not become ready");
      await evaluate(`document.querySelector('[data-testid="scratch-canvas"]')?.scrollIntoView({block:'center'})`);
      await delay(150);
      const motionBefore = await evaluate(`(()=>{const dust=document.querySelector('[data-scratch-dust]');const card=document.querySelector('[data-scratch-progress] > div');const progress=document.querySelector('[role="progressbar"] span');let css='';for(const sheet of document.styleSheets){try{css += [...sheet.cssRules].map(rule=>rule.cssText).join(' ')}catch{}}const cardStyle=card?getComputedStyle(card):null;return {reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,dustDisplay:dust?getComputedStyle(dust).display:null,cardTransition:cardStyle?.transitionDuration??null,cardTransform:cardStyle?.transform??null,progressAnimation:progress?getComputedStyle(progress,'::after').animationName:null,stylesheetHasReducedMotion:css.includes('prefers-reduced-motion: reduce'),stylesheetHidesDust:css.includes('scratchDust')&&css.includes('display: none')}})()`);
      if (!motionBefore.stylesheetHasReducedMotion || !motionBefore.stylesheetHidesDust) throw new Error("Reduced-motion stylesheet contract is missing");
      const rect = await evaluate(`(()=>{const r=document.querySelector('[data-testid="scratch-canvas"]')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,width:r.width,height:r.height}})()`);
      activeViewport.initialRect = rect;
      if (!rect?.width || !rect?.height) throw new Error("Scratch canvas has no interactive area");
      activeViewport.phase = "scratching";
      const interaction = await dispatchScratch(viewport.input, viewport.motion === "reduce", motionBefore);
      const after = await evaluate(`(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.querySelector('#meme-card-reveal-title')?.textContent?.trim(),cardId:document.querySelector('[data-revealed="true"]')?.dataset.cardId,finalUrl:location.href}))()`);
      if (after.scrollWidth > after.width + 1) throw new Error(`Horizontal overflow after reveal at ${viewport.name}`);
      const editorial = selectedCardId === "mc-0012" ? await evaluate(`(()=>{const card=document.querySelector('[data-revealed="true"]');return {cardId:card?.dataset.cardId,text:card?.textContent?.trim()||'',symbols:[...card.querySelectorAll('[data-symbol]')].map(node=>node.getAttribute('data-symbol'))}})()`) : null;
      if (editorial) validateZicoCardResult(editorial);
      viewports.push({ ...viewport, announcement, document, before, after: { ...after, finalUrl: sanitizeUrl(after.finalUrl) }, editorial, interaction, screenshot: await screenshot(viewport.name) });
      activeViewport = null;
    }

    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const path of DETAIL_PATHS) {
      const chain = [];
      const stop = on("Network.requestWillBeSent", params => {
        if (params.type === "Document" && params.redirectResponse) chain.push({ status: params.redirectResponse.status, from: sanitizeUrl(params.redirectResponse.url), to: sanitizeUrl(params.request.url) });
      });
      await navigate(path);
      await waitFor("document.querySelector('h1')?.textContent?.includes('새삥 챌린지')", "Detail identity did not finish rendering", 300);
      if (options.cardId === "mc-0012") {
        await waitFor(`(()=>{const text=document.querySelector('main')?.textContent||'';return text.includes('리더 계급 미션곡')&&text.includes('위댐보이즈 바타')&&[...document.querySelectorAll('a[href]')].some(a=>a.href==='https://www.youtube.com/watch?v=JnQu_5O4lh4')})()`, "Corrected 새삥 detail did not finish streaming", 300);
      }
      stop();
      const document = documentResponses.findLast(response => response.route === path);
      const result = { requested: sanitizeUrl(options.origin + path), final: sanitizeUrl(await evaluate("location.href")), status: document?.status ?? null, releaseSha: document?.releaseSha ?? null, title: sanitizeDiagnostic(await evaluate("document.title")), heading: sanitizeDiagnostic(await evaluate("document.querySelector('h1')?.textContent?.trim()||''")), chain };
      validateDetailResult(result, options.origin);
      if (options.cardId === "mc-0012") {
        result.editorial = await evaluate(`(()=>{const text=document.querySelector('main')?.textContent||'';return {missionContext:text.includes('리더 계급 미션곡'),choreographer:text.includes('위댐보이즈 바타'),incorrectEnglish:text.includes('Freak-y'),officialDanceLink:[...document.querySelectorAll('a[href]')].some(a=>a.href==='https://www.youtube.com/watch?v=JnQu_5O4lh4')}})()`);
        if (!result.editorial.missionContext || !result.editorial.choreographer || result.editorial.incorrectEnglish || !result.editorial.officialDanceLink) throw new Error("Corrected 새삥 detail copy and official source did not render");
      }
      redirects.push(result);
    }

    const failures = [];
    if (diagnostics.runtime.length) failures.push(`${diagnostics.runtime.length} runtime exception(s)`);
    if (diagnostics.console.some(item => item.level === "error")) failures.push("console error(s)");
    if (diagnostics.log.some(item => item.level === "error")) failures.push("browser log error(s)");
    if (diagnostics.firstPartyNetwork.length) failures.push(`${diagnostics.firstPartyNetwork.length} first-party network error(s)`);
    if (diagnostics.control.length) failures.push(`${diagnostics.control.length} browser-control error(s)`);
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: options.origin,
      isolatedProfile: true,
      mutationPolicy: "All non-GET/HEAD/OPTIONS requests were blocked before transmission",
      directory,
      ok: failures.length === 0,
      failures,
      viewports,
      redirects,
      documentResponses,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, report: reportPath, viewports: viewports.map(item => ({ name: item.name, input: item.input, motion: item.motion, progress: item.interaction.checkpoints.map(point => point.normalized), revealed: item.interaction.final.revealed, screenshot: item.screenshot })), redirects, diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) }));
    if (!report.ok) process.exitCode = 1;
    return report;
  } catch (error) {
    const evidence = await captureFailureEvidence?.().catch(() => null);
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: options.origin,
      isolatedProfile: true,
      ok: false,
      error: sanitizeProtectionBypassDiagnostic(error instanceof Error ? error.message : error, protectionBypassToken),
      directory,
      failedViewport: activeViewport,
      failureEvidence: evidence,
      viewports,
      redirects,
      documentResponses,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.error(JSON.stringify({ ok: false, report: reportPath, error: report.error, failedViewport: activeViewport, failureEvidence: evidence, diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) }));
    process.exitCode = 1;
    return report;
  } finally {
    await browserClose?.();
    if (!chrome.killed) chrome.kill("SIGTERM");
    socket?.close();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { await runMemeCardQa(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: sanitizeDiagnostic(error instanceof Error ? error.message : error) })); process.exitCode = 1; }
}
