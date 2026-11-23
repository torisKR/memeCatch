// Module hooks for chat-fixture.mjs: the two modules lib/meme-chat.server.ts
// reads the database through are replaced by chat-fixture-stubs.mjs, so the
// real answerMemeQuestion runs on rows the fixture script hands it.
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
const stubs = ${JSON.stringify(new URL("./chat-fixture-stubs.mjs", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/meme-reference-search.server" || specifier === "@/lib/db/server") {
    return { url: stubs, shortCircuit: true };
  }
  return next(specifier, context);
}
`));
