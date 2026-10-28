#!/usr/bin/env node
/** Isolated, read-only browser QA for the fixed local video-review viewer. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { open, mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { cancelPendingCommands, sanitizeDiagnostic, sanitizeUrl } from "./qa-meme-cards.mjs";

export const LOCAL_REVIEW_ORIGIN = "http://127.0.0.1:3015";
const VIDEO_PRODUCTION_ROOT = resolve(fileURLToPath(new URL("../artifacts/video-production/", import.meta.url)));
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const FIXED_ROUTES = new Set(["/", "/video.mp4", "/poster.png"]);
const FALSE_FLAGS = [
  "assetRightsApproved", "productionApproval", "operatorRightsApproval", "artifactApproval",
  "uploadConsent", "publicationApproval", "publishable",
];
const VIEWPORTS = [
  { name: "mobile-320x568", width: 320, height: 568, mobile: true, motion: "no-preference" },
  { name: "mobile-375x812", width: 375, height: 812, mobile: true, motion: "no-preference" },
  { name: "mobile-390x844-reduced", width: 390, height: 844, mobile: true, motion: "reduce" },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false, motion: "no-preference" },
];

function fail(code) {
  throw new Error(code);
}

function isInside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function parseReviewQaArgs(argv) {
  if (!Array.isArray(argv)) fail("invalid_cli_arguments");
  const values = new Map();
  const allowed = new Set(["--artifact-dir", "--expected-sha", "--out"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || values.has(flag) || typeof value !== "string" || value.startsWith("--")) {
      fail("invalid_cli_arguments");
    }
    values.set(flag, value);
  }
  const artifactValue = values.get("--artifact-dir");
  const expectedSha = values.get("--expected-sha");
  if (!artifactValue) fail("artifact_directory_required");
  if (!SHA256.test(expectedSha ?? "")) fail("invalid_expected_sha");
  const artifactDir = resolve(artifactValue);
  if (!isInside(VIDEO_PRODUCTION_ROOT, artifactDir)) fail("artifact_directory_outside_video_production");
  const out = resolve(values.get("--out") ?? artifactDir);
  if (!isInside(artifactDir, out)) fail("output_directory_outside_artifact");
  return { origin: LOCAL_REVIEW_ORIGIN, artifactDir, expectedSha, out };
}

export function requestDisposition(method, value) {
  if (!["GET", "HEAD"].includes(String(method).toUpperCase())) return { allow: false, reason: "non_read_method" };
  let url;
  try { url = new URL(value); } catch { return { allow: false, reason: "invalid_url" }; }
  if (url.origin !== LOCAL_REVIEW_ORIGIN) return { allow: false, reason: "external_origin" };
  if (url.username || url.password || url.search || url.hash || !FIXED_ROUTES.has(url.pathname)) {
    return { allow: false, reason: "non_fixed_route" };
  }
  return { allow: true, reason: "fixed_read_route" };
}

async function hashFile(path) {
  const handle = await open(path, "r");
  try {
    const hash = createHash("sha256");
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

export async function verifyReviewArtifact(artifactDir, expectedSha) {
  const directory = await realpath(resolve(artifactDir)).catch(() => fail("artifact_directory_unavailable"));
  const root = await realpath(VIDEO_PRODUCTION_ROOT).catch(() => fail("video_production_root_unavailable"));
  if (!isInside(root, directory)) fail("artifact_directory_outside_video_production");
  const manifestPath = join(directory, "review-candidate.json");
  const videoPath = join(directory, "production.mp4");
  const manifestStat = await stat(manifestPath).catch(() => fail("review_manifest_unavailable"));
  const videoStat = await stat(videoPath).catch(() => fail("review_video_unavailable"));
  if (!manifestStat.isFile() || manifestStat.size <= 0 || manifestStat.size > MAX_MANIFEST_BYTES) fail("invalid_review_manifest_size");
  if (!videoStat.isFile() || videoStat.size <= 0 || videoStat.size > MAX_VIDEO_BYTES) fail("invalid_review_video_size");
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch { fail("invalid_review_manifest_json"); }
  if (!manifest || typeof manifest !== "object" || manifest.kind !== "real_meme_local_review_candidate"
      || manifest.operatorReviewRequired !== true || FALSE_FLAGS.some((key) => manifest[key] !== false)) {
    fail("manifest_not_local_review_candidate");
  }
  if (!SHA256.test(manifest.sha256 ?? "") || manifest.sha256 !== expectedSha
      || !Number.isSafeInteger(manifest.byteSize) || manifest.byteSize !== videoStat.size) {
    fail("review_video_identity_mismatch");
  }
  const actualSha = await hashFile(videoPath);
  if (actualSha !== expectedSha) fail("review_video_sha256_mismatch");
  const title = typeof manifest.title === "string" ? manifest.title.trim() : "";
  const technical = manifest.technicalCheck;
  if (!title || !technical || technical.passed !== true || !Number.isInteger(technical.duration_ms)
      || technical.duration_ms <= 0 || !Number.isInteger(technical.width) || !Number.isInteger(technical.height)) {
    fail("invalid_review_technical_metadata");
  }
  return {
    directory,
    title,
    sha256: actualSha,
    byteSize: videoStat.size,
    durationSeconds: technical.duration_ms / 1000,
    width: technical.width,
    height: technical.height,
  };
}

export function validateReviewSnapshot(snapshot, expected) {
  if (snapshot.status !== 200) fail("viewer_document_not_200");
  if (snapshot.headingCount !== 1 || snapshot.heading !== expected.expectedTitle) fail("viewer_heading_mismatch");
  if (!snapshot.notice.includes("로컬 검수용") || !snapshot.notice.includes("업로드·공개 안 함")) fail("local_only_notice_missing");
  if (snapshot.approvalRows.length !== 5 || snapshot.approvalRows.some((value) => value !== "미승인")
      || !snapshot.publishableCopy.includes("발행 가능") || !snapshot.publishableCopy.includes("미승인")) {
    fail("approval_state_mismatch");
  }
  if (snapshot.structuredDataCount !== 0 || snapshot.containsVideoObject) fail("structured_data_present");
  if (snapshot.overflow > 1) fail("horizontal_overflow");
  if (snapshot.reducedMotion !== expected.reduced) fail("reduced_motion_mismatch");
  if (snapshot.autoplay) fail("autoplay_enabled");
  if (snapshot.error !== null) fail("video_media_error");
  if (snapshot.metadata.readyState < 1 || snapshot.metadata.videoWidth !== 1080 || snapshot.metadata.videoHeight !== 1920
      || Math.abs(snapshot.metadata.duration - expected.expectedDuration) > 0.25) {
    fail("video_metadata_mismatch");
  }
  if (!snapshot.playback.advanced) fail("video_time_did_not_advance");
  if (snapshot.playback.frameCount < 1) fail("video_frames_not_observed");
  if (!snapshot.playback.endedOrNearEnd) fail("video_end_seek_failed");
}

function chromeExecutable() {
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  return "google-chrome";
}

function waitForChromeEndpoint(chrome) {
  return new Promise((resolveEndpoint, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error("chrome_debugging_endpoint_unavailable")), 15_000);
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
      if (match) { clearTimeout(timer); resolveEndpoint(match[1]); }
    });
    chrome.once("error", (error) => { clearTimeout(timer); reject(error); });
    chrome.once("exit", () => {
      if (!stderr.includes("DevTools listening on")) { clearTimeout(timer); reject(new Error("chrome_exited_before_qa")); }
    });
  });
}

function consoleText(args = []) {
  return args.map((argument) => argument.value ?? argument.description ?? argument.type).join(" ");
}

export async function runReviewQa(options) {
  const artifact = await verifyReviewArtifact(options.artifactDir, options.expectedSha);
  await mkdir(options.out, { recursive: true });
  const directory = await mkdtemp(join(options.out, "qa-local-"));
  const chrome = spawn(chromeExecutable(), [
    "--headless=new", `--user-data-dir=${join(directory, "profile")}`, "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--metrics-recording-only",
    "--autoplay-policy=no-user-gesture-required", "--mute-audio", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  let browserClose;
  let closing = false;
  let currentViewport = "startup";
  const pages = [];
  const documentResponses = [];
  const diagnostics = { console: [], runtime: [], log: [], network: [], blocked: [], control: [] };

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
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
        return;
      }
      for (const handler of listeners.get(message.method) ?? []) handler(message.params, message.sessionId);
    };
    const send = (method, params = {}, sessionId) => new Promise((resolveResult, reject) => {
      const id = ++nextId;
      const timeout = method === "Page.navigate" ? 30_000 : 20_000;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}_timed_out`)); }, timeout);
      pending.set(id, { resolve: resolveResult, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
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
      const handlers = listeners.get(method) ?? new Set();
      handlers.add(handler);
      listeners.set(method, handlers);
    };
    const evaluate = async (expression) => {
      const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(sanitizeDiagnostic(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
      }
      return result.result.value;
    };

    const requestUrls = new Map();
    const intentionallyBlocked = new Set();
    on("Runtime.consoleAPICalled", (params) => {
      if (["error", "warning"].includes(params.type)) diagnostics.console.push({ viewport: currentViewport, level: params.type, text: sanitizeDiagnostic(consoleText(params.args)) });
    });
    on("Runtime.exceptionThrown", (params) => diagnostics.runtime.push({ viewport: currentViewport, text: sanitizeDiagnostic(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text) }));
    on("Log.entryAdded", (params) => {
      if (["error", "warning"].includes(params.entry.level)) diagnostics.log.push({ viewport: currentViewport, level: params.entry.level, text: sanitizeDiagnostic(params.entry.text), url: params.entry.url ? sanitizeUrl(params.entry.url) : null });
    });
    on("Network.requestWillBeSent", (params) => requestUrls.set(params.requestId, params.request.url));
    on("Network.loadingFinished", (params) => requestUrls.delete(params.requestId));
    on("Network.loadingFailed", (params) => {
      const url = requestUrls.get(params.requestId) ?? "";
      requestUrls.delete(params.requestId);
      if (intentionallyBlocked.delete(params.requestId) || params.canceled || params.blockedReason === "inspector") return;
      diagnostics.network.push({ viewport: currentViewport, url: sanitizeUrl(url), reason: sanitizeDiagnostic(params.errorText) });
    });
    on("Network.responseReceived", (params) => {
      if (params.type === "Document" && params.response.url === `${LOCAL_REVIEW_ORIGIN}/`) {
        documentResponses.push({ viewport: currentViewport, status: params.response.status, url: sanitizeUrl(params.response.url) });
      }
    });
    on("Fetch.requestPaused", (params) => {
      const disposition = requestDisposition(params.request.method, params.request.url);
      const complete = (method, payload) => void cdp(method, payload).catch((error) => {
        if (!closing) diagnostics.control.push({ viewport: currentViewport, method, text: sanitizeDiagnostic(error.message) });
      });
      if (!disposition.allow) {
        diagnostics.blocked.push({ viewport: currentViewport, method: params.request.method, url: sanitizeUrl(params.request.url), reason: disposition.reason });
        if (params.networkId) intentionallyBlocked.add(params.networkId);
        complete("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
      } else {
        complete("Fetch.continueRequest", { requestId: params.requestId });
      }
    });

    await Promise.all([
      cdp("Page.enable"), cdp("Runtime.enable"), cdp("Log.enable"), cdp("Network.enable"),
      cdp("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }),
    ]);
    await cdp("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp("Network.setBypassServiceWorker", { bypass: true });

    const waitFor = async (expression, code, attempts = 200) => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (await evaluate(expression)) return;
        await delay(100);
      }
      fail(code);
    };
    const screenshot = async (name) => {
      const capture = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const path = join(directory, `${name}.png`);
      await writeFile(path, Buffer.from(capture.data, "base64"));
      return path;
    };

    for (const viewport of VIEWPORTS) {
      currentViewport = viewport.name;
      await cdp("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.mobile ? 2 : 1, mobile: viewport.mobile });
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, ...(viewport.mobile ? { maxTouchPoints: 5 } : {}) });
      await cdp("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: viewport.motion }] });
      await cdp("Page.navigate", { url: `${LOCAL_REVIEW_ORIGIN}/` });
      await waitFor("document.readyState === 'complete' && document.querySelector('video') !== null", "viewer_document_not_ready");
      await waitFor("document.querySelector('video').readyState >= 1 || document.querySelector('video').error !== null", "video_metadata_timeout", 300);
      const status = documentResponses.findLast((response) => response.viewport === viewport.name)?.status ?? null;
      const observed = await evaluate(`(async()=>{
        const video=document.querySelector('video');
        const autoplay=video.autoplay||video.hasAttribute('autoplay');
        const errorBefore=video.error?{code:video.error.code,message:video.error.message}:null;
        const start=video.currentTime;
        video.muted=true;
        let frameCount=0;
        let active=true;
        if(typeof video.requestVideoFrameCallback==='function'){
          const count=()=>{frameCount+=1;if(active&&frameCount<8)video.requestVideoFrameCallback(count)};
          video.requestVideoFrameCallback(count);
        }
        await video.play();
        await new Promise(resolve=>setTimeout(resolve,850));
        const advanced=video.currentTime>start+0.15;
        const duration=video.duration;
        video.pause();
        video.currentTime=Math.max(0,duration-0.35);
        await new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();const timer=setTimeout(()=>reject(new Error('seek_timeout')),3000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true})});
        await video.play();
        await Promise.race([
          new Promise(resolve=>video.addEventListener('ended',resolve,{once:true})),
          new Promise(resolve=>setTimeout(resolve,2500)),
        ]);
        active=false;
        const endedOrNearEnd=video.ended||video.currentTime>=duration-0.08;
        const body=document.body.innerText.replace(/\\s+/g,' ').trim();
        const rows=[...document.querySelectorAll('section dl dd.no')].map(node=>node.textContent.trim());
        const publishable=[...document.querySelectorAll('section dl dt')].find(node=>node.textContent.trim()==='발행 가능');
        const publishableCopy=publishable?publishable.textContent+' '+publishable.nextElementSibling?.textContent:'';
        return {
          headingCount:document.querySelectorAll('h1').length,
          heading:document.querySelector('h1')?.textContent.trim()||'',
          notice:document.querySelector('.notice')?.textContent.trim()||'',
          approvalRows:rows,
          publishableCopy,
          structuredDataCount:document.querySelectorAll('script[type="application/ld+json"]').length,
          containsVideoObject:body.includes('VideoObject')||document.documentElement.innerHTML.includes('VideoObject'),
          overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
          reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
          autoplay,
          error:errorBefore||(video.error?{code:video.error.code,message:video.error.message}:null),
          metadata:{duration,videoWidth:video.videoWidth,videoHeight:video.videoHeight,readyState:video.readyState},
          playback:{advanced,frameCount,endedOrNearEnd,currentTime:video.currentTime,ended:video.ended},
        };
      })()`);
      const snapshot = { viewport: viewport.name, status, ...observed };
      validateReviewSnapshot(snapshot, { expectedTitle: artifact.title, reduced: viewport.motion === "reduce", expectedDuration: artifact.durationSeconds });
      pages.push({ ...snapshot, screenshot: await screenshot(viewport.name) });
    }

    const failures = [];
    if (diagnostics.runtime.length) failures.push(`${diagnostics.runtime.length} runtime exception(s)`);
    if (diagnostics.console.some((entry) => entry.level === "error")) failures.push("console error(s)");
    if (diagnostics.log.some((entry) => entry.level === "error")) failures.push("browser log error(s)");
    if (diagnostics.network.length) failures.push(`${diagnostics.network.length} network error(s)`);
    if (diagnostics.control.length) failures.push(`${diagnostics.control.length} browser-control error(s)`);
    if (diagnostics.blocked.length) failures.push(`${diagnostics.blocked.length} unexpected blocked request(s)`);
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: LOCAL_REVIEW_ORIGIN,
      isolatedProfile: true,
      mutationPolicy: "Only GET and HEAD to the three fixed loopback viewer routes were allowed",
      artifact,
      ok: failures.length === 0,
      failures,
      pages,
      documentResponses,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ ok: report.ok, report: reportPath, sha256: artifact.sha256, pages: pages.map((page) => ({ viewport: page.viewport, duration: page.metadata.duration, frameCount: page.playback.frameCount, currentTime: page.playback.currentTime, ended: page.playback.ended, reducedMotion: page.reducedMotion, overflow: page.overflow, screenshot: page.screenshot })), diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) })}\n`);
    if (!report.ok) process.exitCode = 1;
    return report;
  } catch (error) {
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      origin: LOCAL_REVIEW_ORIGIN,
      isolatedProfile: true,
      artifact,
      ok: false,
      error: sanitizeDiagnostic(error instanceof Error ? error.message : error),
      pages,
      documentResponses,
      diagnostics,
    };
    const reportPath = join(directory, "report.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stderr.write(`${JSON.stringify({ ok: false, report: reportPath, error: report.error, failedViewport: currentViewport, diagnostics: Object.fromEntries(Object.entries(diagnostics).map(([key, value]) => [key, value.length])) })}\n`);
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
  try { await runReviewQa(parseReviewQaArgs(process.argv.slice(2))); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: sanitizeDiagnostic(error instanceof Error ? error.message : error) })}\n`);
    process.exitCode = 1;
  }
}
