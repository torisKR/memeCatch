import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import catalog from "@/data/meme-cards/catalog-1000.json";
import { MemeCollectibleArt } from "./meme-collectible-art";
import { MemeCollectibleSymbol } from "./meme-collectible-symbols";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";

function catalogCard(index = 0): MemeCollectibleCard {
  const item = catalog.cards[index];
  return {
    id: item.id,
    cardNo: item.cardNo,
    edition: item.edition,
    artSeed: item.artSeed,
    memeId: item.memeId,
    title: item.catalogTitle,
    slug: "test",
    href: "/memes/test",
    summary: item.cardCaption,
    category: item.category,
    originYear: null,
    thumbnailUrl: null,
    artMotif: item.art.motif as MemeCollectibleCard["artMotif"],
    artSymbols: item.art.symbols,
    artComposition: item.art.composition as MemeCollectibleCard["artComposition"],
  };
}

describe("original meme card art", () => {
  it("implements every semantic symbol in the server-only 1000-card manifest", () => {
    const symbols = new Set(catalog.cards.flatMap(card => card.art.symbols));
    expect(symbols.size).toBe(74);
    for (const symbol of symbols) {
      const html = renderToStaticMarkup(<svg><MemeCollectibleSymbol symbol={symbol}/></svg>);
      expect(html).toContain(`data-symbol="${symbol}"`);
      expect(html).toMatch(/<(path|rect|circle|ellipse) /);
    }
    expect(() => renderToStaticMarkup(<svg><MemeCollectibleSymbol symbol="unknown-unreviewed"/></svg>)).toThrow("Unsupported");
  });
  it("renders every reviewed semantic direction and materially different subject compositions", () => {
    expect(catalog.cards).toHaveLength(1000);
    for (const [index, item] of catalog.cards.entries()) {
      const card = catalogCard(index);
      const html = renderToStaticMarkup(<MemeCollectibleArt card={card}/>);
      expect(html).toContain(`data-composition="${item.art.composition}"`);
      expect(html).toContain(`data-motif="${item.art.motif}"`);
      for (const symbol of item.art.symbols.slice(0, 3)) {
        expect(html).toContain(`data-symbol="${symbol}"`);
      }
      expect(html).not.toContain("<image");
    }
  });

  it("keeps revealed text readable and removes the retro archive chrome", () => {
    const card = { ...catalogCard(), title: "A clear title", summary: "The meaning behind this meme.", category: "INTERNAL_CATEGORY_LABEL" };
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(<MemeCollectibleArt card={card} compact={compact}/>);
      expect(html).toContain(">A clear title</h3>");
      expect(html).toContain(">The meaning behind this meme.</p>");
      expect(html).toContain(`role="img" aria-label="카드 번호 ${card.cardNo}"`);
      expect(html).toContain(`role="img" aria-label="에디션 ${card.edition}"`);
      expect(html).toContain('aria-hidden="true" focusable="false" data-motif=');
      expect(html).toContain("--card-paper:#11141b");
      expect(html).toContain("--card-ink:#f0f2f5");
      expect(html).not.toContain("ORIGINAL CARD ART");
      expect(html).not.toContain("MEME ARCHIVE");
      expect(html).not.toContain("INTERNAL_CATEGORY_LABEL");
    }
  });

  it("produces repeatable artwork from the existing art seed", () => {
    const card = catalogCard(41);
    const original = { ...card, artSymbols: [...card.artSymbols] };
    const first = renderToStaticMarkup(<MemeCollectibleArt card={card}/>);
    expect(renderToStaticMarkup(<MemeCollectibleArt card={card}/>)).toBe(first);
    expect(renderToStaticMarkup(<MemeCollectibleArt card={{ ...card, artSeed: card.artSeed + 1 }}/>)).not.toBe(first);
    expect(card).toEqual(original);
  });

  it("keeps foil definitions independent when the same card is shown more than once", () => {
    const card = catalogCard();
    const html = renderToStaticMarkup(<><MemeCollectibleArt card={card}/><MemeCollectibleArt card={card}/><MemeCollectibleArt card={card} compact/></>);
    const ids = [...html.matchAll(/<(?:linearGradient|radialGradient) id="([^"]+)"/g)].map(match => match[1]);
    const references = [...html.matchAll(/(?:fill|stroke)="url\(#([^)]+)\)"/g)].map(match => match[1]);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(new Set(references)).toEqual(new Set(ids));
  });
});
