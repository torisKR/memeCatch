// Stands in for @/lib/meme-reference-search.server and @/lib/db/server in
// chat-fixture.mjs: the search finds `globalThis.chatFixture.ids`, and every
// query of the static client gives `globalThis.chatFixture.rows`.
export async function searchMemeReferences() {
  return { mode: "keyword", reason: "model_unavailable", items: globalThis.chatFixture.ids.map((id) => ({ id })) };
}

function query() {
  const builder = new Proxy({}, {
    get(_, name) {
      if (name === "then") {
        const rows = globalThis.chatFixture.rows.map((row) => JSON.parse(row));
        return (resolve) => resolve({ data: rows, error: null });
      }
      return () => builder;
    },
  });
  return builder;
}

export function createStaticClient() {
  return { from: query };
}
