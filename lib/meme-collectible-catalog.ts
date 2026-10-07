import 'server-only';

import catalog from '@/data/meme-cards/catalog-1000.json';
import type { MemeCardArtComposition, MemeCardArtMotif } from '@/lib/meme-collectible';

export interface MemeCardArtDirection {
  motif: MemeCardArtMotif;
  symbols: string[];
  composition: MemeCardArtComposition;
}

// Review metadata stays on the server. Live database eligibility gates public titles.
const artById = new Map<string, MemeCardArtDirection>(catalog.cards.map(card => [card.id, {
  motif: card.art.motif as MemeCardArtMotif,
  symbols: card.art.symbols,
  composition: card.art.composition as MemeCardArtComposition,
}]));

const captionById = new Map(catalog.cards.map(card => [card.id, card.cardCaption]));

// Callers must establish the current public meme eligibility before serializing this.
export function getMemeCardEditorialCaption(cardId: string): string {
  const caption = captionById.get(cardId);
  if (!caption) throw new Error('Unknown collectible card caption');
  return caption;
}

export function getMemeCardArtMotif(cardId: string): MemeCardArtMotif {
  return getMemeCardArtDirection(cardId).motif;
}

export function getMemeCardArtDirection(cardId: string): MemeCardArtDirection {
  const art = artById.get(cardId);
  if (!art) throw new Error('Unknown collectible card artwork');
  return { ...art, symbols: [...art.symbols] };
}
