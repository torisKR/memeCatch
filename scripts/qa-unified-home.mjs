#!/usr/bin/env node
/** Local-only browser regression. Uses a fresh disposable Chrome profile, never user credentials. */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const origin = process.env.MEMECATCH_QA_ORIGIN ?? "http://127.0.0.1:3105";
// Only the two intentionally configured local design previews are accepted.
if (!["http://127.0.0.1:3105", "http://127.0.0.1:3106"].includes(origin)) {
  throw new Error("Design QA requires an allowlisted loopback preview origin");
}
const artifactRoot = process.argv.includes("--workspace-artifacts")
  ? fileURLToPath(new URL("../.local/", import.meta.url))
  : tmpdir();
const directory = await mkdtemp(join(artifactRoot, "memecatch-home-qa-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless", `--user-data-dir=${join(directory, "profile")}`, "--remote-debugging-port=0",
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let socket;
const results = [];
const exceptions = [];
try {
  const endpoint = await new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(() => reject(new Error("Chrome debugging endpoint unavailable")), 15000);
    chrome.stderr.on("data", (chunk) => {
      text += chunk.toString();
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.once("error", reject);
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
  };
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      // Cold development compilation can outlast ordinary CDP commands.
      const commandTimeout = method === "Page.navigate" ? 45000 : 20000;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, commandTimeout);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const value = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  await cdp("Page.enable"); await cdp("Page.bringToFront");
  await cdp("Runtime.enable"); await cdp("Network.enable");
  await cdp("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp("Network.setBypassServiceWorker", { bypass: true });
  await cdp("Network.setBlockedURLs", { urls: ["*googlesyndication*", "*doubleclick*", "*google-analytics*", "*googletagmanager*"] });
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__qaDraws = 0;
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      for (const name of ['drawElements','drawArrays']) {
        const original = type.prototype[name];
        type.prototype[name] = function(...args) { window.__qaDraws++; return original.apply(this,args); };
      }
    }
  ` });
  async function navigate(path) {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Local relative routes only");
    await cdp("Page.navigate", { url: origin + path });
    for (let n = 0; n < 60; n++) {
      if (await evaluate("document.readyState === 'complete' && !!document.querySelector('[data-home-section]')")) break;
      await delay(150);
    }
    const pathname = new URL(path, origin).pathname;
    const routeLocale = pathname.split('/')[1] || 'ko';
    const htmlLanguage = ({ko:'ko',en:'en',ja:'ja',zh:'zh-Hans','zh-tw':'zh-Hant'})[routeLocale];
    let ready = false;
    for (let n = 0; n < 100; n++) {
      ready = await evaluate(`location.pathname === ${JSON.stringify(pathname)} && document.documentElement.lang === ${JSON.stringify(htmlLanguage)} && document.querySelector('header select')?.value === ${JSON.stringify(routeLocale)} && ['ready','static','failed'].includes(document.querySelector('figure[data-renderer]')?.dataset.renderer)`);
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`Home did not settle at ${pathname}`);
    await evaluate("document.querySelector('button[aria-label=\"새 소식 닫기\"]')?.click()");
    await delay(350);
  }
  const stateExpression = `JSON.stringify({
    path:location.pathname+location.search,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    lang:document.documentElement.lang,selected:document.querySelector('header select')?.value,
    heading:document.querySelector('h1')?.textContent,header:document.querySelector('header a[aria-label]')?.getAttribute('aria-label'),
    sections:[...document.querySelectorAll('[data-home-section]')].map(e=>e.dataset.homeSection),
    scene:document.querySelector('figure[data-renderer]')?.dataset.renderer,
    canvas:!!document.querySelector('[data-home-scene-canvas]'),draws:window.__qaDraws,
    signals:document.querySelectorAll('[data-home-section="usage-signals"] summary').length,
    interactiveControls:document.querySelectorAll('figure[data-renderer] button[aria-pressed]').length,
    interactiveSelected:document.querySelector('[data-home-scene-canvas]')?.dataset.selectedSignal,
    hasAdsense:!!document.querySelector('script[src*="adsbygoogle"]'),
    modal:!!document.querySelector('[role="dialog"],[aria-modal="true"]'),
    brokenImages:[...document.images].filter(e=>e.complete&&!e.naturalWidth).length
  })`;
  async function record(name, screenshot = true) {
    if (name.includes("dark")) {
      console.log(JSON.stringify({ name, searchButton: await evaluate(`(()=>{const b=document.querySelector('[data-home-section="hero-search"] button[type="submit"]');const c=getComputedStyle(b);return {text:b.textContent,color:c.color,opacity:c.opacity,visibility:c.visibility,display:c.display,rect:b.getBoundingClientRect().toJSON()};})()`) }));
    }
    const state = JSON.parse(await evaluate(stateExpression));
    const row = { name, ...state };
    if (screenshot) {
      const jpeg = process.argv.includes('--jpeg');
      const image = await cdp("Page.captureScreenshot", { format: jpeg ? "jpeg" : "png", ...(jpeg ? {quality:72} : {}), captureBeyondViewport: false });
      row.screenshot = join(directory, `${name}.${jpeg ? 'jpg' : 'png'}`);
      await writeFile(row.screenshot, Buffer.from(image.data, "base64"));
    }
    results.push(row); console.log(JSON.stringify(row));
  }
  if (process.argv.includes("--cinematic")) {
    const story = await (await import('./qa-home-cinematic.mjs')).exerciseHomeCinematic({cdp,evaluate,navigate,record,delay});
    const report={checkedAt:new Date().toISOString(),directory,story,exceptions,results};
    await writeFile(join(directory,'cinematic-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({report:join(directory,'cinematic-report.json'),ok:story.ok,exceptions}));
    if(!story.ok || exceptions.length || results.some(r=>r.hasAdsense || r.scrollWidth>r.width+1 || r.brokenImages)) process.exitCode=1;
    await send('Browser.close').catch(()=>{});
  } else if (process.argv.includes("--scroll-only")) {
    const story = await (await import('./qa-home-scroll-story.mjs')).exerciseHomeScrollStory({cdp, evaluate, navigate, record, delay});
    const report = {checkedAt:new Date().toISOString(), directory, story, exceptions, results};
    await writeFile(join(directory, 'scroll-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({report:join(directory,'scroll-report.json'), ok:story.ok, exceptions}));
    if (!story.ok || exceptions.length || results.some(r=>r.hasAdsense || r.scrollWidth>r.width+1 || r.brokenImages)) process.exitCode=1;
    await send('Browser.close').catch(()=>{});
  } else if (process.argv.includes("--spot")) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await navigate("/en"); await delay(1000); await record("en-mobile-spot");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
    await navigate("/?lang=ko"); await delay(1000); await record("dark-cold-navigation");
    await send("Browser.close").catch(() => {});
  } else {
  for (const width of [375, 768, 1440]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height: width < 768 ? 812 : 900, deviceScaleFactor: 1, mobile: width < 768 });
    for (const [locale, path] of [["ko","/?lang=ko"],["en","/en"],["ja","/ja"],["zh","/zh"],["zh-tw","/zh-tw"]]) {
      await navigate(path); await record(`${locale}-${width}`);
    }
  }
  // Stale preference must not replace the URL-owned Korean home during hydration.
  await navigate("/zh-tw");
  await evaluate("document.cookie='memecatch_locale=zh-tw; Path=/; SameSite=Lax'");
  await navigate("/?lang=ko"); await record("stale-cookie-korean");
  await evaluate("const select=document.querySelector('header select'); if(!select) throw new Error('language selector missing'); select.value='en'; select.dispatchEvent(new Event('change',{bubbles:true}));");
  let switchedLocale = false;
  for (let n = 0; n < 100; n++) {
    switchedLocale = await evaluate("location.pathname === '/en' && document.documentElement.lang === 'en' && document.querySelector('header select')?.value === 'en' && document.querySelectorAll('[data-home-section]').length === 5 && document.querySelector('figure[data-renderer]')?.dataset.renderer === 'ready'");
    if (switchedLocale) break;
    await delay(100);
  }
  if (!switchedLocale) throw new Error('Language-selector navigation did not settle');
  await delay(350); await record("selector-english");

  await navigate("/?lang=ko");
  for (let n = 0; n < 30 && !(await evaluate("!!document.querySelector('[data-home-scene-canvas]')")); n++) await delay(150);
  const draws = () => evaluate("window.__qaDraws");
  const before = await draws(); await delay(350); const playing = (await draws()) > before;
  await evaluate("document.querySelector('[data-scene-playback]')?.click()");
  await delay(150); const pausedAt = await draws(); await delay(350); const paused = (await draws()) === pausedAt;
  await evaluate("document.querySelector('[data-scene-playback]')?.click()");
  await delay(150); const resumedAt = await draws(); await delay(350); const resumed = (await draws()) > resumedAt;
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-color-scheme", value: "dark" }] });
  await delay(200); const reducedAt = await draws(); await delay(350); const reducedPaused = (await draws()) === reducedAt;
  await record("dark-reduced-motion");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }, { name: "prefers-color-scheme", value: "light" }] });
  await delay(150); const restoredAt = await draws(); await delay(350); const restored = (await draws()) > restoredAt;
  // Confirm that off-screen artwork stops consuming frames, then resumes in view.
  await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
  await delay(300); const offscreenAt = await draws(); await delay(350);
  const offscreenPaused = (await draws()) === offscreenAt;
  await evaluate("window.scrollTo(0, 0)");
  await delay(300); const onscreenAt = await draws(); await delay(350);
  const viewportResumed = (await draws()) > onscreenAt;
  const playback = { playing, paused, resumed, reducedPaused, restored, offscreenPaused, viewportResumed };
  console.log(JSON.stringify({ playback }));
  // Force context loss only on the disposable QA canvas and verify its SVG recovery.
  await evaluate("document.querySelector('[data-home-scene-canvas]')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()");
  await delay(400); await record("context-loss-fallback");
  const contextLossFallback = await evaluate("document.querySelector('figure[data-renderer]')?.dataset.renderer === 'failed' && !document.querySelector('[data-home-scene-canvas]') && !!document.querySelector('[data-home-scene-fallback]')");

  // Keyboard-operated native details, not programmatic toggles of the open attribute.
  await navigate("/?lang=ko");
  const keyboardSignals = [];
  for (let index = 0; index < 4; index++) {
    await evaluate(`(()=>{const summaries = document.querySelectorAll('[data-home-section="usage-signals"] summary'); summaries[${index}].scrollIntoView({block:'center'}); summaries[${index}].focus();})()`);
    const pressEnter = async () => {
      // Match a real Enter keystroke, including its generated carriage-return text.
      await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await delay(60);
    };
    await pressEnter();
    const opened = await evaluate(`document.querySelectorAll('[data-home-section="usage-signals"] details')[${index}].open`);
    await pressEnter();
    const closed = await evaluate(`!document.querySelectorAll('[data-home-section="usage-signals"] details')[${index}].open`);
    keyboardSignals.push({ index, opened, closed });
  }
  await record("keyboard-signal-icons");

  // Emulate no WebGL, Save-Data, and a low-memory device in disposable pages only.
  const staticModes = [];
  for (const [name, source] of [
    ["no-webgl", "const getContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type,...args){return /^webgl/.test(type) ? null : getContext.call(this,type,...args);};"],
    ["save-data", "Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true});"],
    ["low-memory", "Object.defineProperty(navigator,'deviceMemory',{value:2,configurable:true});"],
  ]) {
    const injection = await cdp("Page.addScriptToEvaluateOnNewDocument", { source });
    await navigate("/?lang=ko");
    const ok = await evaluate("document.querySelector('figure[data-renderer]')?.dataset.renderer === 'static' && !document.querySelector('[data-home-scene-canvas]') && !!document.querySelector('[data-home-scene-fallback]') && getComputedStyle(document.querySelector('[data-home-scene-fallback]')).opacity === '1'");
    staticModes.push({ name, ok });
    await record(name);
    await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  }
  const { exerciseHomeInteractions } = await import('./qa-home-interactions.mjs');
  const interaction = await exerciseHomeInteractions({ cdp, evaluate, navigate, record, delay });
  const web3 = process.argv.includes('--web3')
    ? await (await import('./qa-web3-home.mjs')).exerciseWeb3Home({ cdp, evaluate, navigate, record, delay })
    : null;
  const polish = process.argv.includes('--polish')
    ? await (await import('./qa-interaction-polish.mjs')).exerciseInteractionPolish({ cdp, evaluate, navigate, record, delay })
    : null;
  const extended = { contextLossFallback, keyboardSignals, staticModes, interaction, web3, polish };
  console.log(JSON.stringify({ extended }));
  const matrixRows = results.filter(row => /^(ko|en|ja|zh|zh-tw)-(375|768|1440)$/.test(row.name));
  const localeMatrixValid = matrixRows.length === 15 && matrixRows.every(row => {
    const locale = row.name.replace(/-(375|768|1440)$/, '');
    return row.selected === locale && row.lang === ({ko:'ko',en:'en',ja:'ja',zh:'zh-Hans','zh-tw':'zh-Hant'})[locale]
      && row.scene === 'ready' && row.canvas && row.draws > 0;
  });
  const report = { checkedAt: new Date().toISOString(), directory, playback, extended, localeMatrixValid, exceptions, results };
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: join(directory, "report.json"), exceptions }));
  await send("Browser.close").catch(() => {});
  if (results.some(r => r.scrollWidth > r.width + 1 || r.hasAdsense || r.signals !== 4 || r.interactiveControls !== 4 || r.brokenImages > 0)
    || Object.values(playback).some(v => !v) || exceptions.length > 0 || !localeMatrixValid
    || !contextLossFallback || keyboardSignals.some(r => !r.opened || !r.closed)
    || staticModes.some(r => !r.ok) || !interaction.ok || (web3 && !web3.ok) || (polish && !polish.ok)) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.stack); process.exitCode = 1;
} finally {
  socket?.close(); chrome.kill("SIGTERM");
}
