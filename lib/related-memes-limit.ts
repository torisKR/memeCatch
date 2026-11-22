/**
 * Related meme cards on Korean and localized detail pages. Raised from 6 to 12
 * so each detail document links more indexable neighbours (2026-11-21 crawl review).
 * Lives outside components/related-memes.tsx so tests that mock that component
 * still see the constant.
 */
export const RELATED_MEMES_LIMIT = 12;
