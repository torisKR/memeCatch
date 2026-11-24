// Module hooks for parity scripts that import lib/ modules using
// `next/server` (lib/indexnow.server.ts imports `after`): Node's ESM loader
// needs the file name Next ships, `next/server.js`. Load after
// scripts/register-ts-paths.mjs: `--import ./server/parity/next-server.mjs`.
export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
}
