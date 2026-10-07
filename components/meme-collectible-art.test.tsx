import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "@/data/meme-cards/catalog-1000.json";
import { MemeCollectibleArt } from "./meme-collectible-art";
import { MemeCollectibleSymbol } from "./meme-collectible-symbols";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";

describe("original meme card art", () => {
  it("implements every semantic symbol in the server-only 1000-card manifest", () => {
    const symbols = new Set(catalog.cards.flatMap(card => card.art.symbols));
    for (const symbol of symbols) {
      const html = renderToStaticMarkup(<svg><MemeCollectibleSymbol symbol={symbol}/></svg>);
      expect(html).toContain(`data-symbol="${symbol}"`);
      expect(html).toMatch(/<(path|rect|circle|ellipse) /);
    }
    expect(() => renderToStaticMarkup(<svg><MemeCollectibleSymbol symbol="unknown-unreviewed"/></svg>)).toThrow("Unsupported");
  });
  it("renders every reviewed semantic direction and materially different subject compositions", () => {
    for (const item of catalog.cards) {
      const card: MemeCollectibleCard = { id: item.id, cardNo: item.cardNo, edition: item.edition, artSeed: item.artSeed, memeId: item.memeId, title: item.catalogTitle, slug: "test", href: "/memes/test", summary: item.cardCaption, category: item.category, originYear: null, thumbnailUrl: null, artMotif: item.art.motif as MemeCollectibleCard["artMotif"], artSymbols: item.art.symbols, artComposition: item.art.composition as MemeCollectibleCard["artComposition"] };
      const html = renderToStaticMarkup(<MemeCollectibleArt card={card}/>);
      expect(html).toContain(`data-composition="${item.art.composition}"`);
      expect(html).toContain(`data-symbol="${item.art.symbols[0]}"`);
      expect(html).not.toContain("<image");
      expect(html).toContain("MEME ARCHIVE");
    }
  });
});
