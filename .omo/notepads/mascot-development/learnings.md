## Catch mascot scene audit — 2026-09-11

- The existing mascot already had stable `useId()`-derived SVG paint/filter IDs, the C-ring/signal-dot/speech-tail silhouette, and decorative `aria-hidden` semantics; those contracts were preserved.
- The previous `idle`, `discovering`, and `help` states only changed bob timing. The scene now adds an explicit signal sweep for discovery and a compact context-card/check cue for help, while keeping the artwork deterministic and dependency-free.
- Added `data-catch-size` and `data-catch-state` hooks to make the public size/state contract testable without exposing decorative SVG to assistive technology.
- Reduced motion disables all mascot transforms/animations; the scene remains visible as a static cue. Fresh homepage screenshots were captured at 375, 768, and 1280px; browser console errors were clear. The multimodal image inspection helper was unavailable, so pixel-level visual review remains a tooling limitation.
