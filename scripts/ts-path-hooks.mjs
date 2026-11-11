import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensions = [".ts", ".tsx", ".js", ".mjs", ".json"];

function fileFor(base) {
  if (existsSync(base)) return base;
  return extensions.map((extension) => base + extension).find((path) => existsSync(path)) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(join(root, "scripts/server-only-stub.mjs")).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    const hit = fileFor(join(root, specifier.slice(2)));
    if (!hit) throw new Error(`Cannot resolve ${specifier}`);
    return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      const hit = fileFor(join(dirname(fileURLToPath(context.parentURL)), specifier));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
      throw error;
    }
  }
  return nextResolve(specifier, context);
}
