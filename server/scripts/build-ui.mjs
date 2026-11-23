#!/usr/bin/env node
// Builds server/assets/site.css and server/assets/site.js, the stylesheet and
// the one script of the native pages.
//
//   node server/scripts/build-ui.mjs           write both files
//   node server/scripts/build-ui.mjs --check   exit 1 if either file is stale
//   node server/scripts/build-ui.mjs --sizes   also print what each part adds
//
// The stylesheet, in this order:
//   1. app/globals.css as it is, except that Tailwind looks for class names
//      in server/src/pages and server/ui and nowhere else. The design tokens,
//      the theme and the hand-written classes are the ones Next uses.
//   2. The CSS modules in MODULES, with `.name` rewritten to
//      `.<module>-<name-in-kebab-case>`. Next names the same class
//      `<module>_<name>__<hash>`; the Maud templates use the stable spelling.
//   3. server/ui/site.css.
//
// The script: the `lib/` modules in LIB_MODULES, compiled from TypeScript and
// each wrapped as `lib.<name>`, then the files of UI_FILES, all in one
// function scope. Comments are dropped; nothing is renamed, so a stack trace
// reads like the source. A module in LIB_MODULES may import types only.
//
// The output is committed: the server embeds it, and its build needs no Node.
// Run this after changing a class name in src/pages, a file of server/ui, or
// any input above. Needs the packages of the repository root.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const server = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(server, "..");
const cssOutput = resolve(server, "assets/site.css");
const jsOutput = resolve(server, "assets/site.js");
const requireFromRoot = createRequire(resolve(root, "package.json"));

// CSS modules a native page renders markup of.
const MODULES = ["meme-card", "meme-chatbot", "meme-detail-title", "originals-editorial/original-edition"];
const TAILWIND_IMPORT = '@import "tailwindcss";';
// Pure modules of the Next app the scripts reuse, so their rules exist once.
const LIB_MODULES = {
  attribution: "lib/attribution.ts",
  scrollChrome: "lib/scroll-chrome.ts",
  chatStream: "lib/meme-chat-stream.ts",
  sourceLinks: "lib/source-links.ts",
};
// One file per feature of the frame or the page, in the order they run.
// core.js defines what the others share.
const UI_FILES = [
  "core.js",
  "page.js",
  "attribution.js",
  "menu.js",
  "locale.js",
  "account.js",
  "save.js",
  "chat.js",
  "pwa.js",
  "progress.js",
  "scroll.js",
  "search.js",
  "pointer.js",
  "originals.js",
  "card.js",
];

async function buildCss() {
  // @tailwindcss/node and @tailwindcss/oxide are dependencies of the PostCSS
  // plugin Next builds with, so this is the same compiler at the same version.
  const fromPlugin = createRequire(requireFromRoot.resolve("@tailwindcss/postcss"));
  const load = (name) => import(pathToFileURL(fromPlugin.resolve(name)).href);
  const { compile, optimize } = await load("@tailwindcss/node");
  const { Scanner } = await load("@tailwindcss/oxide");

  const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  // `components/<path>.module.css`; the class prefix is the file's name.
  const moduleCss = (path) => {
    const name = path.split("/").pop();
    const css = readFileSync(resolve(root, `components/${path}.module.css`), "utf8");
    // A class selector starts with a letter; `.94` and `.5px` are numbers.
    return css.replace(/\.([A-Za-z][A-Za-z0-9]*)/g, (_, local) => `.${name}-${kebab(local)}`);
  };

  const globals = readFileSync(resolve(root, "app/globals.css"), "utf8");
  if (!globals.startsWith(TAILWIND_IMPORT)) {
    console.error(`app/globals.css no longer starts with ${TAILWIND_IMPORT}; update build-ui.mjs`);
    process.exit(2);
  }
  const input = [
    `@import "tailwindcss" source(none);\n@source "../src/pages";\n@source "../ui/*.js";${globals.slice(TAILWIND_IMPORT.length)}`,
    ...MODULES.map(moduleCss),
    readFileSync(resolve(server, "ui/site.css"), "utf8"),
  ].join("\n");

  const compiler = await compile(input, { base: resolve(server, "ui"), onDependency() {} });
  const candidates = new Scanner({ sources: compiler.sources }).scan();
  const { code } = optimize(compiler.build(candidates), { file: "site.css", minify: true });
  return code;
}

function buildJs() {
  const ts = requireFromRoot("typescript");
  const compile = (source, file) =>
    ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        removeComments: true,
      },
    }).outputText;

  const parts = Object.entries(LIB_MODULES).map(([name, file]) => {
    const source = readFileSync(resolve(root, file), "utf8");
    const exported = [...source.matchAll(/^export (?:async )?(?:function\*?|const|let|class) (\w+)/gm)].map((m) => m[1]);
    const body = compile(source, file)
      .replace(/^export \{\};?$/gm, "")
      .replace(/^export /gm, "");
    if (/^\s*(import|export)\b/m.test(body)) throw new Error(`${file} imports at run time; LIB_MODULES takes pure modules`);
    return { name: `lib/${name}`, code: `lib.${name} = (() => {\n${body}\nreturn { ${exported.join(", ")} };\n})();\n` };
  });
  for (const file of UI_FILES) {
    parts.push({ name: `ui/${file}`, code: compile(readFileSync(resolve(server, "ui", file), "utf8"), file) });
  }
  const code = `(() => {\n"use strict";\nconst lib = {};\n${parts.map((part) => part.code).join("\n")}})();\n`;
  // Collapse the blank lines the compiler leaves where comments were.
  return { code: code.replace(/\n\s*\n+/g, "\n"), parts };
}

const sizeOf = (text) => ({ raw: Buffer.byteLength(text), gzip: gzipSync(text).length });

const css = await buildCss();
const { code: js, parts } = buildJs();

if (process.argv.includes("--check")) {
  let stale = 0;
  for (const [file, text] of [[cssOutput, css], [jsOutput, js]]) {
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error(`${file.slice(root.length + 1)} is stale: run node server/scripts/build-ui.mjs`);
      stale += 1;
    }
  }
  process.exit(stale ? 1 : 0);
}

writeFileSync(cssOutput, css);
writeFileSync(jsOutput, js);
for (const [file, text] of [[cssOutput, css], [jsOutput, js]]) {
  const size = sizeOf(text);
  console.log(`${file.slice(root.length + 1)}: ${size.raw} bytes, ${size.gzip} gzip`);
}
if (process.argv.includes("--sizes")) {
  // Each part alone; together they compress better than the sum.
  for (const part of parts) {
    const size = sizeOf(part.code);
    console.log(`  ${part.name.padEnd(22)} ${String(size.raw).padStart(6)} bytes ${String(size.gzip).padStart(6)} gzip`);
  }
}
