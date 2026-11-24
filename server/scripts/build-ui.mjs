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
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
const MODULES = [
  "meme-card",
  "meme-chatbot",
  "meme-detail-title",
  "originals-editorial/original-edition",
  "meme-collectible",
];
// CSS modules only one page renders, each page's in its own stylesheet
// (assets/pages/<name>.css), linked after site.css by that page alone, as
// Next loads a route's module CSS only on that route.
const PAGE_STYLES = {
  home: ["home/home-web3", "home/home-immersive-story", "home/home-story-scene-view", "home/home-discovery"],
};
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
  "timeline.js",
  "slang.js",
  "export.js",
  "contribute.js",
  "community.js",
  "auth-forms.js",
  "login.js",
  "onboarding.js",
  "invite.js",
  "house.js",
  "embed.js",
  "thumbnail.js",
];
// Scripts only one page runs, each its own file (assets/pages/<name>.js),
// loaded after site.js by that page alone: the bundle every page loads
// stays small.
// A page script may use pure modules of the repository (`libs`: name and
// file, such as `lib/quiz.ts` or a module of `ui/` two pages share); their
// `@/...` imports become reads of the bundle's `lib` object, and two of the
// app's modules are answered by the frame: `@/lib/analytics` (core.js's
// `track`, on `window.memecatch`) and `@/lib/site` (the page's `data-site-url`).
const PAGE_FILES = {
  "community-new": { libs: { uploadShared: "lib/upload-shared.ts", upload: "lib/upload.ts", plan: "lib/db/plan.ts" } },
  explore: {},
  "meme-cards": {},
  my: {
    libs: {
      memeCollectible: "lib/meme-collectible.ts",
      memeCollectibleUi: "lib/meme-collectible-ui.ts",
      memeCardArt: "lib/meme-card-art.ts",
      dailyQuiz: "lib/daily-quiz.ts",
      plan: "lib/db/plan.ts",
      labels: "lib/labels.ts",
      dailyQuizWidget: "server/ui/daily-quiz-widget.js",
    },
  },
  quiz: { libs: { quiz: "lib/quiz.ts", quizShare: "lib/quiz-share.ts", quizCard: "lib/quiz-card.ts" } },
  "search-page": { libs: { searchSuggestions: "lib/search-suggestions.ts", referenceSearch: "server/ui/reference-search.js" } },
  studio: {
    libs: {
      memeArtifacts: "components/studio/meme-artifacts.ts",
      uploadShared: "lib/upload-shared.ts",
      upload: "lib/upload.ts",
      referenceSearch: "server/ui/reference-search.js",
    },
  },
  submit: { libs: { uploadShared: "lib/upload-shared.ts", upload: "lib/upload.ts", plan: "lib/db/plan.ts", labels: "lib/labels.ts" } },
  support: {},
  home: { libs: { homeScrollBinding: "components/home/home-scroll-binding.ts", dailyQuiz: "lib/daily-quiz.ts" } },
  // The home page's three.js scene: an ES module the home script imports
  // when the scene comes into view, as home-scene.tsx imports it. `bundle`
  // is a module of the repository bundled with its packages (the versions
  // of the lockfile) by Rolldown, the bundler Vite runs on, minified, its
  // licence comments kept.
  "home-scene": { bundle: "components/home/home-scene-renderer.ts" },
};
const PAGE_SHIMS = {
  analytics: "lib.analytics = { track: (...args) => window.memecatch.track(...args) };",
  site: 'lib.site = { SITE_URL: (document.querySelector("[data-site-url]")?.dataset.siteUrl ?? location.origin).replace(/\\/+$/, "") };',
};
const pageOutput = (name) => resolve(server, `assets/pages/${name}.js`);
const pageStyleOutput = (name) => resolve(server, `assets/pages/${name}.css`);

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
    // `:global(x)` is `x` unrenamed, as Next compiles it.
    return css
      .replace(/\.([A-Za-z][A-Za-z0-9]*)/g, (_, local) => `.${name}-${kebab(local)}`)
      .replace(/:global\(([^()]*)\)/g, "$1");
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
  // Plain CSS (no Tailwind directive in these modules), minified alike.
  const pages = Object.entries(PAGE_STYLES).map(([name, modules]) => [
    pageStyleOutput(name),
    optimize(modules.map(moduleCss).join("\n"), { file: `${name}.css`, minify: true }).code,
  ]);
  return { code, pages };
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
  const pages = Object.entries(PAGE_FILES).filter(([, entry]) => !entry.bundle).map(([name, { libs = {} }]) => {
    const byFile = Object.fromEntries(Object.entries(libs).map(([lib, file]) => [file.replace(/\.[tj]s$/, ""), lib]));
    const shims = new Set();
    // `import { a, b as c } from "@/x/y";` → `const { a, b: c } = lib.<name of x/y>;`
    const link = (code, file) => code.replace(/^import \{([^}]*)\} from "@\/([\w/-]+)";$/gm, (_, names, module) => {
      const shim = module.replace(/^lib\//, "");
      const lib = byFile[module] ?? (PAGE_SHIMS[shim] ? (shims.add(shim), shim) : null);
      if (!lib) throw new Error(`${file} imports @/${module}, which pages/${name}.js does not carry`);
      return `const {${names.replace(/\s+as\s+/g, ": ")}} = lib.${lib};`;
    });
    const modules = Object.entries(libs).map(([lib, file]) => {
      const source = readFileSync(resolve(root, file), "utf8");
      const exported = [...source.matchAll(/^export (?:async )?(?:function\*?|const|let|class) (\w+)/gm)].map((m) => m[1]);
      // `export { a, b };` re-exports what the module imported: `lib.<name>` of its own module carries them.
      const body = link(compile(source, file), file).replace(/^export \{[^}]*\};?$/gm, "").replace(/^export /gm, "");
      if (/^\s*(import|export)\b/m.test(body)) throw new Error(`${file} still imports or exports at run time`);
      return `lib.${lib} = (() => {\n${body}\nreturn { ${exported.join(", ")} };\n})();\n`;
    });
    const script = link(compile(readFileSync(resolve(server, "ui", `${name}.js`), "utf8"), `${name}.js`), `${name}.js`);
    const prelude = [...shims].map((module) => PAGE_SHIMS[module]).join("\n");
    const code = `(() => {\n"use strict";\nconst lib = {};\n${prelude}\n${modules.join("\n")}${script}})();\n`;
    return [pageOutput(name), code.replace(/\n\s*\n+/g, "\n")];
  });
  return { code: code.replace(/\n\s*\n+/g, "\n"), parts, pages };
}

/** The `bundle` entries of PAGE_FILES: one ES module each, exports kept. */
async function buildBundles() {
  const bundles = Object.entries(PAGE_FILES).filter(([, entry]) => entry.bundle);
  if (!bundles.length) return [];
  // Rolldown is not a dependency of its own: it is the bundler of the Vite
  // that vitest runs on, so its version follows the lockfile.
  const fromVitest = createRequire(realpathSync(resolve(root, "node_modules/vitest/package.json")));
  const fromVite = createRequire(realpathSync(fromVitest.resolve("vite/package.json")));
  const { rolldown } = await import(pathToFileURL(fromVite.resolve("rolldown")).href);
  const built = [];
  for (const [name, { bundle: input }] of bundles) {
    const build = await rolldown({ input: resolve(root, input), cwd: root, resolve: { alias: { "@": root } }, logLevel: "warn" });
    const { output } = await build.generate({ format: "es", minify: true, comments: { legal: true, annotation: false, jsdoc: false } });
    await build.close();
    if (output.length !== 1) throw new Error(`${input} split into ${output.length} files; pages/${name}.js must be one`);
    // Vendor code, minified: not the repository's to lint.
    built.push([pageOutput(name), `/* eslint-disable */\n${output[0].code}`]);
  }
  return built;
}

const sizeOf = (text) => ({ raw: Buffer.byteLength(text), gzip: gzipSync(text).length });

const { code: css, pages: pageStyles } = await buildCss();
const { code: js, parts, pages } = buildJs();
const outputs = [[cssOutput, css], [jsOutput, js], ...pageStyles, ...pages, ...(await buildBundles())];

if (process.argv.includes("--check")) {
  let stale = 0;
  for (const [file, text] of outputs) {
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

mkdirSync(resolve(server, "assets/pages"), { recursive: true });
for (const [file, text] of outputs) writeFileSync(file, text);
for (const [file, text] of outputs) {
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
