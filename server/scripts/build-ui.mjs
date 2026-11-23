#!/usr/bin/env node
// Builds server/assets/site.css, the stylesheet of the native pages.
//
//   node server/scripts/build-ui.mjs           write the file
//   node server/scripts/build-ui.mjs --check   exit 1 if the file is stale
//
// Input, in this order:
//   1. app/globals.css as it is, except that Tailwind looks for class names
//      in server/src/pages and nowhere else. The design tokens, the theme and
//      the hand-written classes are the ones Next uses.
//   2. The CSS modules in MODULES, with `.name` rewritten to
//      `.<module>-<name-in-kebab-case>`. Next names the same class
//      `<module>_<name>__<hash>`; the Maud templates use the stable spelling.
//   3. server/ui/site.css.
//
// The output is committed: the server embeds it, and its build needs no Node.
// Run this after changing a class name in src/pages or any input above.
// Needs the packages of the repository root (Tailwind 4, as Next uses it).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const server = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(server, "..");
const output = resolve(server, "assets/site.css");

// CSS modules a native page renders markup of.
const MODULES = ["meme-chatbot", "meme-detail-title"];
const TAILWIND_IMPORT = '@import "tailwindcss";';

// @tailwindcss/node and @tailwindcss/oxide are dependencies of the PostCSS
// plugin Next builds with, so this is the same compiler at the same version.
const fromPlugin = createRequire(createRequire(resolve(root, "package.json")).resolve("@tailwindcss/postcss"));
const load = (name) => import(pathToFileURL(fromPlugin.resolve(name)).href);
const { compile, optimize } = await load("@tailwindcss/node");
const { Scanner } = await load("@tailwindcss/oxide");

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function moduleCss(name) {
  const css = readFileSync(resolve(root, `components/${name}.module.css`), "utf8");
  // A class selector starts with a letter; `.94` and `.5px` are numbers.
  return css.replace(/\.([A-Za-z][A-Za-z0-9]*)/g, (_, local) => `.${name}-${kebab(local)}`);
}

const globals = readFileSync(resolve(root, "app/globals.css"), "utf8");
if (!globals.startsWith(TAILWIND_IMPORT)) {
  console.error(`app/globals.css no longer starts with ${TAILWIND_IMPORT}; update build-ui.mjs`);
  process.exit(2);
}
const input = [
  `@import "tailwindcss" source(none);\n@source "../src/pages";${globals.slice(TAILWIND_IMPORT.length)}`,
  ...MODULES.map(moduleCss),
  readFileSync(resolve(server, "ui/site.css"), "utf8"),
].join("\n");

const base = resolve(server, "ui");
const compiler = await compile(input, { base, onDependency() {} });
const candidates = new Scanner({ sources: compiler.sources }).scan();
const { code } = optimize(compiler.build(candidates), { file: "site.css", minify: true });

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== code) {
    console.error("server/assets/site.css is stale: run node server/scripts/build-ui.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(output, code);
  console.log(`${output}: ${code.length} bytes, ${candidates.length} class candidates`);
}
