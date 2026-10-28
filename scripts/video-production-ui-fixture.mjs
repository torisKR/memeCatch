#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let port = 3014;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--port" && /^\d+$/.test(args[index + 1] ?? "")) {
    port = Number(args[index + 1]);
    index += 1;
  } else if (args[index] === "--help") {
    console.log("Usage: node scripts/video-production-ui-fixture.mjs [--port 3014]");
    console.log("Binds only to 127.0.0.1. Modes: ?mode=ready, ?mode=review, ?mode=setup");
    process.exit(0);
  } else {
    throw new Error(`Unsupported argument: ${args[index]}`);
  }
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("port must be an integer from 1024 to 65535");

const fixtureDir = await mkdtemp(join(repoRoot, ".video-production-ui-fixture-"));
const configPath = join(fixtureDir, "vite.config.mjs");
const actionStub = join(fixtureDir, "admin-action-stub.ts");
const navigationStub = join(fixtureDir, "navigation-stub.ts");
const linkStub = join(fixtureDir, "link-stub.tsx");
const entry = join(repoRoot, "scripts/video-production-ui-fixture.tsx");

await writeFile(join(fixtureDir, "index.html"), `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>밈캐치 영상 제작 UI 픽스처</title></head><body><div id="root"></div><script type="module" src="/@fs${entry}"></script></body></html>`, "utf8");
await writeFile(actionStub, `export async function performVideoProductionCommand(command) { window.dispatchEvent(new CustomEvent("video-production-fixture-action", { detail: { kind: command?.kind } })); await new Promise((resolve) => setTimeout(resolve, 80)); return { ok: true, id: "fixture-only" }; }\n`, "utf8");
await writeFile(navigationStub, `export function useRouter() { return { refresh() {} }; } export function usePathname() { return "/admin/video-productions"; }\n`, "utf8");
await writeFile(linkStub, `export default function Link({ href, children, ...props }) { return <a href={typeof href === "string" ? href : "#"} {...props}>{children}</a>; }\n`, "utf8");
await writeFile(configPath, `import react from "@vitejs/plugin-react"; import { defineConfig } from "vitest/config"; export default defineConfig({ root: ${JSON.stringify(fixtureDir)}, plugins: [react()], css: { postcss: ${JSON.stringify(repoRoot)} }, resolve: { dedupe: ["react", "react-dom"], alias: [{ find: "@/lib/actions/admin-video-productions", replacement: ${JSON.stringify(actionStub)} }, { find: "next/navigation", replacement: ${JSON.stringify(navigationStub)} }, { find: "next/link", replacement: ${JSON.stringify(linkStub)} }, { find: "@", replacement: ${JSON.stringify(repoRoot)} }] }, server: { host: "127.0.0.1", port: ${port}, strictPort: true, fs: { allow: [${JSON.stringify(repoRoot)}, ${JSON.stringify(fixtureDir)}] } } });\n`, "utf8");

const child = spawn("pnpm", ["exec", "vite", "--config", configPath, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: repoRoot,
  env: { ...process.env, BROWSER: "none" },
  stdio: ["inherit", "pipe", "pipe"],
});

let reported = false;
const relay = (chunk, stream) => {
  const text = chunk.toString();
  stream.write(text);
  if (!reported && /Local:\s+http:\/\/127\.0\.0\.1:/u.test(text)) {
    reported = true;
    console.log(JSON.stringify({
      fixture: "video-production-admin",
      origin: `http://127.0.0.1:${port}`,
      modes: ["ready", "review", "setup"],
      externalActions: false,
    }));
  }
};
child.stdout.on("data", (chunk) => relay(chunk, process.stdout));
child.stderr.on("data", (chunk) => relay(chunk, process.stderr));

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM");
}
process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));

const exitCode = await new Promise((resolveExit) => {
  child.on("error", (error) => {
    console.error(`UI fixture failed to start: ${error.message}`);
    resolveExit(1);
  });
  child.on("exit", (code, signal) => resolveExit(code ?? (signal ? 0 : 1)));
});
await rm(fixtureDir, { recursive: true, force: true });
process.exitCode = exitCode;
