#!/usr/bin/env node
/** Worker gate: real, anonymous IFrame playback in a disposable browser. No user profile or downloads. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { producedVideoEmbedUrl } from "../lib/video-production/video-schema.mjs";

export function validateEmbedProbeInput({ videoId, channelId, artifactHash }) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId ?? "")) throw new Error("invalid_embed_video_id");
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId ?? "")) throw new Error("invalid_embed_channel_id");
  if (!/^[a-f0-9]{64}$/.test(artifactHash ?? "")) throw new Error("invalid_embed_artifact_hash");
}

export function embedProbeHtml(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId ?? "")) throw new Error("invalid_embed_video_id");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Anonymous playback check</title>
<iframe id="player" width="360" height="640" title="Anonymous playback check" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe><script>
const probeUrl = new URL(${JSON.stringify(producedVideoEmbedUrl(videoId))});
probeUrl.searchParams.set('enablejsapi','1');
probeUrl.searchParams.set('autoplay','1');
probeUrl.searchParams.set('mute','1');
probeUrl.searchParams.set('playsinline','1');
probeUrl.searchParams.set('origin',location.origin);
document.getElementById('player').src = probeUrl.href;
window.probe = {ready:false, playing:false, error:null, firstTime:null, lastTime:null, videoId:null};
window.onYouTubeIframeAPIReady = function() {
  // Attach to the existing privacy-enhanced iframe; do not replace its host.
  const player = new YT.Player('player', {events:{
    onReady: function(e){ window.probe.ready=true; e.target.mute(); e.target.playVideo(); },
    onError: function(e){ window.probe.error=Number(e.data); },
    onStateChange: function(e){if(e.data===YT.PlayerState.PLAYING)window.probe.playing=true;}
  }});
  setInterval(function(){
    if(!window.probe.playing)return;
    try {
      const t=player.getCurrentTime();
      window.probe.videoId=player.getVideoData().video_id;
      if(window.probe.firstTime===null)window.probe.firstTime=t;
      window.probe.lastTime=t;
    }catch(e) {window.probe.error=-1;}
  },200);
};
</script><script src="https://www.youtube.com/iframe_api"></script></html>`;
}

export function validatePlaybackEvidence(result, videoId) {
  if (result?.error !== null && result?.error !== undefined) throw new Error("youtube_embed_player_rejected");
  if (result?.videoId !== videoId || result?.ready !== true || result?.playing !== true
    || !Number.isFinite(result.firstTime) || !Number.isFinite(result.lastTime)
    || result.lastTime - result.firstTime < 0.5) throw new Error("youtube_embed_playback_unverified");
  return true;
}

function chromeExecutable() {
  // An explicit deployment path is an executable configuration, never a shell command.
  if (process.env.VIDEO_CHROME_EXECUTABLE) return process.env.VIDEO_CHROME_EXECUTABLE;
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (process.platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  return "google-chrome";
}

function waitForEndpoint(chrome) {
  return new Promise((resolve, reject) => {
    let text = "";
    const timer = setTimeout(() => reject(new Error("embed_browser_start_failed")), 15_000);
    chrome.stderr.on("data", (chunk) => {
      text = (text + chunk.toString()).slice(-8192);
      const match = text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[0-9]+\/devtools\/browser\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.once("error", () => { clearTimeout(timer); reject(new Error("embed_browser_start_failed")); });
    chrome.once("exit", () => { clearTimeout(timer); reject(new Error("embed_browser_start_failed")); });
  });
}

export async function runAnonymousPlayerProbe(videoId, { timeoutMs = 30_000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) throw new Error("invalid_embed_probe_timeout");
  const html = embedProbeHtml(videoId);
  const profile = await mkdtemp(join(tmpdir(), "memecatch-embed-probe-"));
  const server = createServer((request, response) => {
    if (request.method !== "GET" || request.url !== "/") { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin" }).end(html);
  });
  let chrome, socket;
  const pending = new Map();
  let send;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const port = server.address().port;
    chrome = spawn(chromeExecutable(), ["--headless=new", `--user-data-dir=${profile}`, "--remote-debugging-port=0",
      "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-background-networking",
      "--disable-component-update", "--autoplay-policy=no-user-gesture-required", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] });
    socket = new WebSocket(await waitForEndpoint(chrome));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("embed_browser_connection_failed")), 5000);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = () => { clearTimeout(timer); reject(new Error("embed_browser_connection_failed")); };
    });
    let id = 0;
    socket.onmessage = ({ data }) => {
      let message;
      try { message = JSON.parse(data); } catch { return; }
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id); clearTimeout(command.timer);
      if (message.error) command.reject(new Error("embed_browser_command_failed"));
      else command.resolve(message.result);
    };
    send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("embed_browser_command_timeout")); }, 5000);
      pending.set(requestId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    const navigate = await send("Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);
    if (navigate.errorText) throw new Error("embed_probe_document_failed");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await send("Runtime.evaluate", { expression: "window.probe || null", returnByValue: true }, sessionId);
      if (response.exceptionDetails) throw new Error("embed_probe_runtime_failed");
      const result = response.result?.value;
      if (result?.error !== null && result?.error !== undefined) throw new Error("youtube_embed_player_rejected");
      if (result?.playing && result.lastTime - result.firstTime >= 0.5) {
        validatePlaybackEvidence(result, videoId);
        return result;
      }
      await delay(250);
    }
    throw new Error("youtube_embed_playback_unverified");
  } finally {
    if (socket?.readyState === WebSocket.OPEN && send) await send("Browser.close").catch(() => {});
    for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("embed_probe_closed")); }
    pending.clear();
    socket?.close();
    // Kill only the process this function launched, never a user's browser.
    if (chrome && chrome.exitCode === null) {
      chrome.kill("SIGTERM");
      await Promise.race([new Promise((resolve) => chrome.once("exit", resolve)), delay(1000)]);
      if (chrome.exitCode === null) chrome.kill("SIGKILL");
    }
    await new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); });
    await rm(profile, { recursive: true, force: true });
  }
}

export async function verifyYouTubeEmbed(input, { probe = runAnonymousPlayerProbe } = {}) {
  validateEmbedProbeInput(input);
  const result = await probe(input.videoId);
  validatePlaybackEvidence(result, input.videoId);
  return { verified: true, videoId: input.videoId, artifactHash: input.artifactHash, checkedAt: new Date().toISOString() };
}
