#!/usr/bin/env node
/** Disposable, read-only publisher-page QA. Never opens a user profile or runs ads. */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  cancelPendingCommands,
  isCanceledReadInterception,
  sanitizeDiagnostic,
  sanitizeProtectionBypassDiagnostic,
  sanitizeUrl,
  shouldBlockRequest,
  protectionBypassHeaders,
  readProtectionBypassToken,
  validateReleaseOrigin,
} from "./qa-meme-cards.mjs";

export const LOCAL_PUBLISHER_ORIGIN = "http://127.0.0.1:3012";
export const PRODUCTION_PUBLISHER_ORIGIN = "https://catchmeme.com";
export const ADSENSE_ACCOUNT = "ca-pub-3004906966180197";
const DEFAULT_ARTIFACT_ROOT = fileURLToPath(new URL("../.local/", import.meta.url));
const ROUTES = ["/", "/guides/reading-memes", "/about", "/explore"];
const VIEWPORTS = [
  { name: "mobile-320x568", width: 320, height: 568, mobile: true, motion: "no-preference" },
  { name: "mobile-375x812", width: 375, height: 812, mobile: true, motion: "no-preference" },
  { name: "mobile-390x844-reduced", width: 390, height: 844, mobile: true, motion: "reduce" },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false, motion: "no-preference" },
];
const AD_HOSTS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagservices.com",
];
const EXPECTED_HEADINGS = {
  "/": "지금 궁금한 밈, 한눈에.",
  "/guides/reading-memes": "밈의 원본과 사용 맥락을 확인하는 방법",
  "/about": "밈캐치 소개",
  "/explore": "밈 탐색",
};

export function validatePublisherOrigin(value) {
  if (value !== LOCAL_PUBLISHER_ORIGIN && value !== PRODUCTION_PUBLISHER_ORIGIN) {
    throw new Error(`Publisher QA origin must be ${LOCAL_PUBLISHER_ORIGIN} or ${PRODUCTION_PUBLISHER_ORIGIN}`);
  }
  return value;
}

export function validateLocalPublisherOrigin(value) {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const validPort = /^\d{1,5}$/.test(url.port)
      && Number(url.port) >= 1
      && Number(url.port) <= 65_535;
    if (url.protocol !== "http:" || !validHost || !validPort
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("invalid");
    }
    return url.origin;
  } catch {
    throw new Error("Publisher QA local origin must be an HTTP localhost or 127.0.0.1 origin with an explicit port");
  }
}

export function validateMemePath(value) {
  if (typeof value !== "string" || !value.startsWith("/memes/")
    || value.includes("?") || value.includes("#") || value.includes("\\")
    || /%(?:2f|5c|2e|25(?:2f|5c|2e))/i.test(value)) {
    throw new Error("Meme path must be a canonical /memes/SHORTID-SLUG path");
  }
  const encodedKey = value.slice("/memes/".length);
  let key;
  try { key = decodeURIComponent(encodedKey); }
  catch { throw new Error("Meme path must contain valid percent encoding"); }
  const separator = key.indexOf("-");
  const shortId = separator > 0 ? key.slice(0, separator) : "";
  const slug = separator > 0 ? key.slice(separator + 1) : "";
  if (!/^[a-zA-Z0-9]{4,32}$/.test(shortId) || !slug.trim() || slug.length > 180
    || slug === "." || slug === ".." || slug.includes("/") || slug.includes("\\") || /%[0-9a-f]{2}/i.test(slug)) {
    throw new Error("Meme path must be a canonical /memes/SHORTID-SLUG path");
  }
  return `/memes/${encodeURIComponent(shortId)}-${encodeURIComponent(slug)}`;
}

export function parsePublisherArgs(argv) {
  const options = { origin: LOCAL_PUBLISHER_ORIGIN, out: DEFAULT_ARTIFACT_ROOT, release: false };
  let originSelector = null;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--origin" || value === "--local-origin" || value === "--release-origin") {
      if (originSelector) throw new Error("Use only one origin selector");
      originSelector = value;
      options.origin = argv[++index];
      options.release = value === "--release-origin";
      options.local = value === "--local-origin";
    }
    else if (value === "--meme-path") options.memePath = argv[++index];
    else if (value === "--out") options.out = argv[++index];
    else if (value === "--protection-bypass-file") {
      options.protectionBypassFile = argv[++index];
      if (!options.protectionBypassFile) throw new Error("Protection bypass file requires a value");
    }
    else if (value === "--expected-release") options.expectedRelease = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!options.origin) throw new Error("Origin argument requires a value");
  if (!options.out) throw new Error("Output argument requires a value");
  if (options.expectedRelease !== undefined && !/^[a-zA-Z0-9._-]{4,128}$/.test(options.expectedRelease ?? "")) {
    throw new Error("Expected release must be a short non-secret identifier");
  }
  options.origin = options.release
    ? validateReleaseOrigin(options.origin)
    : options.local
      ? validateLocalPublisherOrigin(options.origin)
      : validatePublisherOrigin(options.origin);
  if (options.memePath !== undefined) options.memePath = validateMemePath(options.memePath);
  if (options.protectionBypassFile && !options.release) {
    throw new Error("Protection bypass file requires an explicit release origin");
  }
  options.out = isAbsolute(options.out) ? options.out : resolve(process.cwd(), options.out);
  if (options.protectionBypassFile) {
    options.protectionBypassFile = isAbsolute(options.protectionBypassFile)
      ? options.protectionBypassFile
      : resolve(process.cwd(), options.protectionBypassFile);
  }
  return options;
}

export function isAdvertisingUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return AD_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
      || /^adservice\.google\.[a-z.]+$/.test(host)
      || /^pagead\.google\.[a-z.]+$/.test(host)
      || host === "adtrafficquality.google"
      || host.endsWith(".adtrafficquality.google");
  } catch {
    return false;
  }
}

export function isExpectedBlockedAnalytics(method, value) {
  if (String(method).toUpperCase() !== "POST") return false;
  try {
    const url = new URL(value);
    return url.origin === "https://stats.g.doubleclick.net"
      && !url.username
      && !url.password
      && url.pathname === "/g/collect";
  } catch {
    return false;
  }
}

export function isExpectedNoJsScriptFailure(route, params) {
  return typeof route === "string"
    && route.endsWith("#no-js")
    && params?.type === "Script"
    && params?.errorText === "";
}

export function validatePublisherPage(result, expectedRelease) {
  if (result.status !== 200) throw new Error(`${result.route} document must return HTTP 200`);
  if (result.metaAccount !== ADSENSE_ACCOUNT) throw new Error(`${result.route} is missing the verified AdSense account metadata`);
  if (result.adScripts !== 0) throw new Error(`${result.route} loaded advertising scripts during no-ads QA`);
  if (result.overflow > 1) throw new Error(`${result.route} has horizontal overflow`);
  if (expectedRelease && result.releaseSha !== expectedRelease) throw new Error(`${result.route} release header did not match`);
  const isDetail = result.route.startsWith("/memes/");
  if (result.headingCount !== 1 || !result.heading
    || (!isDetail && result.heading !== EXPECTED_HEADINGS[result.route])) {
    throw new Error(`${result.route} must render its single expected h1`);
  }
  if (result.route === "/") {
    if (!result.sourceQualityCopy) throw new Error("Home is missing its source-quality promise");
    if (result.homeCards === 0 && !result.homeEmptyState) throw new Error("Home must explain its empty state instead of inventing recommendation cards");
    if (result.homeCardsWithSummary !== result.homeCards) throw new Error("Every rendered home card must include a meaningful summary");
  }
  if (result.route === "/guides/reading-memes") {
    if (!result.guideDate || result.guideExamples !== 3 || result.guideSourceLinks < 2) throw new Error("Reading guide is missing dated examples or primary source links");
  }
  if (result.route === "/about" && result.containsInflatedCount) throw new Error("About still contains the unsupported 3,000 content claim");
  if (result.route === "/explore" && result.exploreCards < 1) throw new Error("Explore did not render any public entries");
  if (isDetail) {
    if (!result.summary) throw new Error("Meme detail must render one visible summary");
    if (result.canonicalPath !== result.route) throw new Error("Meme detail canonical path must match the requested canonical route");
    if (result.koreanAlternatePath !== result.canonicalPath) throw new Error("Meme detail Korean alternate must match the canonical route");
    if (result.defaultAlternatePath !== result.canonicalPath) throw new Error("Meme detail x-default must point to the Korean canonical route");
    if (result.storyPresent && result.storyOpen) throw new Error("Meme detail story must be natively collapsed on first render");
    if (result.sourcesPresent && result.sourcesOpen) throw new Error("Meme detail source evidence must be natively collapsed on first render");
    if (result.usageExamplesPresent && !result.usageExamplesBeforeMedia) throw new Error("Meme detail usage examples must precede media in DOM order");
    if (result.jsonLdParseErrors !== 0) throw new Error("Meme detail JSON-LD must parse without errors");
    if (result.matchedVideoObjects !== result.videoObjects) throw new Error("Every VideoObject must match a visible explanatory video iframe");
  }
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
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolveEndpoint(match[1]); }
    });
    chrome.once("error", (error) => { clearTimeout(timer); reject(error); });
    chrome.once("exit", (code) => {
      if (!stderr.includes("DevTools listening on")) { clearTimeout(timer); reject(new Error(`Chrome exited before QA started (${code})`)); }
    });
  });
}

function consoleText(args = []) {
  return args.map((argument) => argument.value ?? argument.description ?? argument.type).join(" ");
}

export async function runPublisherQa(options) {
  const protectionBypassToken = options.protectionBypassFile
    ? await readProtectionBypassToken(options.protectionBypassFile)
    : null;
  await mkdir(options.out, { recursive: true });
  const directory = await mkdtemp(join(options.out, "publisher-page-qa-"));
  const chrome = spawn(chromeExecutable(), [
    "--headless=new", `--user-data-dir=${join(directory, "profile")}`, "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--metrics-recording-only", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  let browserClose;
  let currentRoute = "about:blank";
  let closing = false;
  let protectionBootstrapPending = false;
  const pages = [];
  const routes = options.memePath ? [...ROUTES, options.memePath] : ROUTES;
  const documentResponses = [];
  const diagnostics = {
    console: [], runtime: [], network: [], control: [], blockedWrites: [], expectedBlockedLogs: [],
    canceledReadInterceptions: [], expectedBlockedAnalytics: [], expectedNoJsScriptBlocks: [], unexpectedAdRequests: [],
  };

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
      for (const handler of listeners.get(message.method) ?? []) handler(message.params, message.sessionId);
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
    const on = (method, handler) => {
      const handlers = listeners.get(method) ?? new Set(); handlers.add(handler); listeners.set(method, handlers);
    };
    const evaluate = async (expression) => {
      const response = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) {
        throw new Error(sanitizeDiagnostic(
          response.exceptionDetails.exception?.description
            ?? response.exceptionDetails.exception?.value
            ?? response.exceptionDetails.text,
        ));
      }
      return response.result.value;
    };
    const requestUrls = new Map();
    const intentionallyBlocked = new Set();
    on("Runtime.consoleAPICalled", (params) => {
      if (["error", "warning"].includes(params.type)) diagnostics.console.push({ route: currentRoute, level: params.type, text: sanitizeDiagnostic(consoleText(params.args)) });
    });
    on("Runtime.exceptionThrown", (params) => diagnostics.runtime.push({ route: currentRoute, text: sanitizeDiagnostic(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text) }));
    on("Log.entryAdded", (params) => {
      if (!["error", "warning"].includes(params.entry.level)) return;
      const row = { route: currentRoute, level: params.entry.level, url: params.entry.url ? sanitizeUrl(params.entry.url) : null, requestId: params.entry.networkRequestId ?? null, text: sanitizeDiagnostic(params.entry.text) };
      const blocked = [...diagnostics.blockedWrites].reverse().find((item) => (row.requestId && row.requestId === item.requestId) || (row.url && row.url === item.url));
      if (row.text.includes("ERR_BLOCKED_BY_CLIENT") && blocked) diagnostics.expectedBlockedLogs.push(row);
      else diagnostics.console.push(row);
    });
    on("Network.requestWillBeSent", (params) => requestUrls.set(params.requestId, params.request.url));
    on("Network.loadingFinished", (params) => requestUrls.delete(params.requestId));
    on("Network.loadingFailed", (params) => {
      const url = requestUrls.get(params.requestId) ?? "";
      requestUrls.delete(params.requestId);
      if (intentionallyBlocked.delete(params.requestId) || params.canceled || params.blockedReason === "inspector") return;
      const row = { route: currentRoute, type: params.type ?? null, url: sanitizeUrl(url), reason: sanitizeDiagnostic(params.errorText) };
      if (isExpectedNoJsScriptFailure(currentRoute, params)) diagnostics.expectedNoJsScriptBlocks.push(row);
      else diagnostics.network.push(row);
    });
    on("Network.responseReceived", (params) => {
      if (params.type !== "Document") return;
      let responseOrigin;
      try { responseOrigin = new URL(params.response.url).origin; } catch { return; }
      if (responseOrigin !== options.origin) return;
      const headers = Object.fromEntries(Object.entries(params.response.headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
      documentResponses.push({ route: currentRoute, status: params.response.status, url: sanitizeUrl(params.response.url), releaseSha: headers["x-memecatch-release-sha"] ?? null });
    });
    on("Fetch.requestPaused", (params) => {
      const url = params.request.url;
      const ad = isAdvertisingUrl(url);
      const write = shouldBlockRequest(params.request.method);
      const expectedAnalytics = isExpectedBlockedAnalytics(params.request.method, url);
      const complete = (method, payload) => void cdp(method, payload).catch((error) => {
        if (closing) return;
        const row = { route: currentRoute, method, url: sanitizeUrl(url), text: sanitizeProtectionBypassDiagnostic(error.message, protectionBypassToken) };
        if (isCanceledReadInterception(method, error)) diagnostics.canceledReadInterceptions.push(row);
        else diagnostics.control.push(row);
      });
      if (ad || write) {
        const row = { route: currentRoute, method: params.request.method, url: sanitizeUrl(url), requestId: params.networkId ?? null, reason: expectedAnalytics ? "analytics-mutation" : ad ? "advertising-domain" : "mutation" };
        diagnostics.blockedWrites.push(row);
        if (expectedAnalytics) diagnostics.expectedBlockedAnalytics.push(row);
        else if (ad) diagnostics.unexpectedAdRequests.push(row);
        if (params.networkId) intentionallyBlocked.add(params.networkId);
        complete("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
      } else {
        const setBypassCookie = protectionBootstrapPending && params.resourceType === "Document";
        const headers = protectionBypassHeaders({
          release: options.release,
          releaseOrigin: options.origin,
          bypassToken: protectionBypassToken,
          method: params.request.method,
          requestUrl: url,
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

    await Promise.all([
      cdp("Page.enable"), cdp("Runtime.enable"), cdp("Log.enable"), cdp("Network.enable"),
      cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }),
    ]);
    await cdp("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp("Network.setBypassServiceWorker", { bypass: true });
    await cdp("Network.setExtraHTTPHeaders", { headers: { "Accept-Language": "ko-KR,ko;q=0.9" } });
    await cdp("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem('memecatch_ads_disabled', '1'); } catch {}`,
    });

    async function waitFor(expression, message, attempts = 180) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await delay(100);
      }
      throw new Error(message);
    }
    async function navigate(route) {
      currentRoute = route;
      await cdp("Page.navigate", { url: options.origin + route });
      await waitFor("document.readyState === 'complete'", `Page did not load: ${route}`);
      await waitFor(`location.pathname === ${JSON.stringify(route)} && [...document.querySelectorAll('h1')].some(node => node.getClientRects().length > 0)`, `Page did not render its visible heading: ${route}`);
      await delay(200);
    }
    async function bootstrapProtectionCookie() {
      if (!protectionBypassToken) return;
      currentRoute = "protection-bootstrap";
      protectionBootstrapPending = true;
      await cdp("Page.navigate", { url: `${options.origin}/` });
      await waitFor("document.readyState === 'complete'", "Protection bootstrap document did not load");
      await waitFor(`location.origin === ${JSON.stringify(options.origin)}`, "Protection bootstrap escaped the staged origin");
      if (protectionBootstrapPending) throw new Error("Protection bootstrap did not issue the staged Document request");
      await delay(200);
    }
    async function screenshot(name) {
      const capture = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const path = join(directory, `${name}.png`);
      await writeFile(path, Buffer.from(capture.data, "base64"));
      return path;
    }
    async function pressEnter() {
      await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await delay(100);
    }
    async function exerciseDetailKeyboard(route) {
      const result = { storyOpened: null, sourcesOpened: null, sourceAnchorFocused: null };
      const storyPresent = await evaluate("!!document.querySelector('details#meme-story > summary')");
      if (storyPresent) {
        await evaluate("document.querySelector('details#meme-story > summary').focus()");
        await pressEnter();
        result.storyOpened = await evaluate("document.querySelector('details#meme-story')?.open === true");
      }
      const sourcesPresent = await evaluate("!!document.querySelector('#meme-sources details > summary')");
      if (sourcesPresent) {
        await evaluate("document.querySelector('#meme-sources details > summary').focus()");
        await pressEnter();
        result.sourcesOpened = await evaluate("document.querySelector('#meme-sources details')?.open === true");
        result.sourceAnchorFocused = await evaluate(`(()=>{const a=document.querySelector('#meme-sources a[href]');if(!a)return false;a.focus();return document.activeElement===a})()`);
      }
      if (result.storyOpened === false || result.sourcesOpened === false || result.sourceAnchorFocused === false) {
        throw new Error(`${route} keyboard evidence disclosure failed`);
      }
      return result;
    }
    async function captureNoJsDetail(route) {
      currentRoute = `${route}#no-js`;
      await cdp("Emulation.setScriptExecutionDisabled", { value: true });
      try {
        await cdp("Page.navigate", { url: options.origin + route });
        let html = "";
        for (let attempt = 0; attempt < 80; attempt++) {
          const root = await cdp("DOM.getDocument", { depth: -1, pierce: true });
          html = (await cdp("DOM.getOuterHTML", { nodeId: root.root.nodeId })).outerHTML ?? "";
          if (/<h1(?:\s|>)/i.test(html) && /id=["']meme-summary["']/i.test(html)) break;
          await delay(100);
        }
        const result = {
          route,
          heading: /<h1(?:\s|>)/i.test(html),
          summary: /id=["']meme-summary["']/i.test(html),
          jsonLd: /type=["']application\/ld\+json["']/i.test(html),
        };
        if (!result.heading || !result.summary || !result.jsonLd) throw new Error(`${route} no-JavaScript SSR is missing its answer or JSON-LD`);
        return result;
      } finally {
        await cdp("Emulation.setScriptExecutionDisabled", { value: false });
      }
    }

    await bootstrapProtectionCookie();

    for (const viewport of VIEWPORTS) {
      await cdp("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.mobile ? 2 : 1, mobile: viewport.mobile });
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, ...(viewport.mobile ? { maxTouchPoints: 5 } : {}) });
      await cdp("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: viewport.motion }] });
      for (const route of routes) {
        await navigate(route);
        if (route === "/") await waitFor("document.querySelector('[data-home-section=\"recent-content\"] a[href^=\"/memes/\"]') || document.querySelector('[data-home-recommendations]')", "Home did not finish rendering entries or an honest empty state", 300);
        if (route === "/explore") await waitFor("[...document.querySelectorAll('a[href^=\"/memes/\"]')].some(node => node.getClientRects().length > 0)", "Explore did not finish rendering visible public entries", 300);
        const document = documentResponses.findLast((response) => response.route === route);
        const observed = await evaluate(`(()=>{const body=document.body.innerText;const cards=[...document.querySelectorAll('[data-home-section="recent-content"] a[href^="/memes/"]')];const playback=document.querySelector('[data-scene-playback]');const playbackStyle=playback?getComputedStyle(playback):null;const isDetail=location.pathname.startsWith('/memes/');const pathOf=(selector)=>{const href=document.querySelector(selector)?.href;if(!href)return null;try{return new URL(href).pathname}catch{return null}};const scripts=[...document.querySelectorAll('script[type="application/ld+json"]')];const roots=[];let jsonLdParseErrors=0;for(const script of scripts){try{roots.push(JSON.parse(script.textContent||''))}catch{jsonLdParseErrors++}}const nodes=[];const walk=(value)=>{if(Array.isArray(value)){value.forEach(walk);return}if(!value||typeof value!=='object')return;nodes.push(value);if(Array.isArray(value['@graph']))value['@graph'].forEach(walk)};roots.forEach(walk);const videos=nodes.filter(node=>node['@type']==='VideoObject');const matches=videos.filter(video=>{if(typeof video['@id']!=='string'||typeof video.name!=='string'||typeof video.thumbnailUrl!=='string'||typeof video.uploadDate!=='string'||typeof video.embedUrl!=='string')return false;let fragment;let videoId;try{fragment=new URL(video['@id']).hash.slice(1);videoId=new URL(video.embedUrl).pathname.match(/^\\/embed\\/([A-Za-z0-9_-]{11})$/)?.[1]}catch{return false}if(!fragment||!videoId||fragment!==('produced-video-'+videoId))return false;const item=document.getElementById(fragment);const frame=item?.querySelector('iframe');const heading=item?.querySelector('h3');if(!item||!frame||frame.getClientRects().length===0||frame.title!==video.name||heading?.textContent?.trim()!==video.name)return false;try{return new URL(frame.src).pathname==='/embed/'+videoId}catch{return false}});const story=document.querySelector('details#meme-story');const sources=document.querySelector('#meme-sources details');const examples=document.querySelector('#meme-examples');const media=document.querySelector('#meme-media');return {
          heading:(document.querySelector('h1')?.textContent||'').replace(/\s+/g,' ').trim(),
          headingCount:document.querySelectorAll('h1').length,
          metaAccount:document.querySelector('meta[name="google-adsense-account"]')?.content||null,
          adScripts:document.querySelectorAll('script[src*="adsbygoogle"],script[src*="googlesyndication"],ins.adsbygoogle').length,
          overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
          guideLink:!!document.querySelector('a[href="/guides/reading-memes"]'),
          sourceQualityCopy:body.includes('출처와 설명'),
          homeCards:cards.length,
          homeCardsWithSummary:cards.filter(card=>{const summary=card.querySelector('[class*="cardSummary"]');return Boolean(summary&&(summary.textContent||'').replace(/\s+/g,' ').trim())}).length,
          homeEmptyState:!!document.querySelector('[data-home-recommendations="empty"],[data-home-recommendations="unavailable"]'),
          guideDate:!!document.querySelector('time[datetime^="2026-10-12"]'),
          guideExamples:[...document.querySelectorAll('h3')].filter(node=>node.textContent?.trim().startsWith('예시 ')).length,
          guideSourceLinks:[...document.querySelectorAll('a[href]')].filter(a=>['www.youtube.com','cjnews.cj.net'].includes(new URL(a.href).hostname)).length,
          containsInflatedCount:/3,?000(?:\\+|여\\s*건|건)?/.test(body),
          exploreCards:document.querySelectorAll('a[href^="/memes/"]').length,
          summary:isDetail?(document.querySelector('#meme-summary')?.textContent||'').replace(/\s+/g,' ').trim():null,
          canonicalPath:isDetail?pathOf('link[rel="canonical"]'):null,
          koreanAlternatePath:isDetail?pathOf('link[rel="alternate"][hreflang="ko"]'):null,
          defaultAlternatePath:isDetail?pathOf('link[rel="alternate"][hreflang="x-default"]'):null,
          storyPresent:!!story,storyOpen:story?.open??false,sourcesPresent:!!sources,sourcesOpen:sources?.open??false,
          usageExamplesPresent:!!examples,usageExamplesBeforeMedia:!examples||!media||Boolean(examples.compareDocumentPosition(media)&Node.DOCUMENT_POSITION_FOLLOWING),
          jsonLdParseErrors,videoObjects:videos.length,matchedVideoObjects:matches.length,
          reducedMotion:{matches:matchMedia('(prefers-reduced-motion: reduce)').matches,playbackTransition:playbackStyle?.transitionDuration??null,runningAnimations:document.getAnimations().filter(a=>a.playState==='running').length}
        }})()`);
        const result = {
          viewport: viewport.name,
          route,
          status: document?.status ?? null,
          releaseSha: document?.releaseSha ?? null,
          ...observed,
          screenshot: await screenshot(`${viewport.name}-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}`),
        };
        if (viewport.motion === "reduce" && (!result.reducedMotion.matches || (route === "/" && result.reducedMotion.playbackTransition && result.reducedMotion.playbackTransition !== "0s"))) {
          throw new Error(`${route} did not honor reduced-motion media state`);
        }
        validatePublisherPage(result, options.expectedRelease);
        if (route === options.memePath && viewport.name === "desktop-1440x900") {
          result.keyboard = await exerciseDetailKeyboard(route);
        }
        pages.push(result);
      }
    }

    const noJsDetail = options.memePath ? await captureNoJsDetail(options.memePath) : null;

    const failures = [];
    if (diagnostics.runtime.length) failures.push(`${diagnostics.runtime.length} runtime exception(s)`);
    if (diagnostics.console.some((row) => row.level === "error")) failures.push("console error(s)");
    if (diagnostics.network.length) failures.push(`${diagnostics.network.length} network error(s)`);
    if (diagnostics.control.length) failures.push(`${diagnostics.control.length} browser-control error(s)`);
    if (diagnostics.unexpectedAdRequests.length) failures.push(`${diagnostics.unexpectedAdRequests.length} unexpected advertising request(s)`);
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: options.origin,
      expectedRelease: options.expectedRelease ?? null,
      isolatedProfile: true,
      noAdsPolicy: "memecatch_ads_disabled=1 was installed before every document; all advertising hosts and non-read methods were blocked before transmission",
      ok: failures.length === 0,
      failures,
      pages,
      noJsDetail,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, report: reportPath, pages: pages.map(({ viewport, route, status, screenshot }) => ({ viewport, route, status, screenshot })), diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) }));
    if (!report.ok) process.exitCode = 1;
    return report;
  } catch (error) {
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: options.origin,
      isolatedProfile: true,
      ok: false,
      error: sanitizeProtectionBypassDiagnostic(error instanceof Error ? error.message : error, protectionBypassToken),
      pages,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.error(JSON.stringify({ ok: false, report: reportPath, error: report.error, pages: pages.length, diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) }));
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
  try { await runPublisherQa(parsePublisherArgs(process.argv.slice(2))); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: sanitizeDiagnostic(error instanceof Error ? error.message : error) })); process.exitCode = 1; }
}
