#!/usr/bin/env node
// Writes the part of data/meme-cards/catalog-1000.json that the meme card
// routes send (lib/meme-collectible-catalog.ts): each card's caption and art
// direction. The Axum image is built from server/src alone, so it carries
// this copy instead of the 863 KB original.
//
//   node server/parity/meme-card-catalog.mjs > server/src/routes/cards/catalog.json
//
// Rerun it when the catalogue changes. `cargo test` fails until the copy
// matches (routes::cards::catalog::tests).
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(new URL("../../data/meme-cards/catalog-1000.json", import.meta.url), "utf8"),
);

const cards = catalog.cards.map((card) => ({
  id: card.id,
  caption: card.cardCaption,
  motif: card.art.motif,
  symbols: card.art.symbols,
  composition: card.art.composition,
}));

// One card per line keeps a diff of the copy readable.
process.stdout.write(`[\n${cards.map((card) => JSON.stringify(card)).join(",\n")}\n]\n`);
