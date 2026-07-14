# Design QA — Timeline overflow and container alignment

## Scope

- Route: `http://localhost:3000/timeline`
- Source evidence: `/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/TemporaryItems/NSIRD_screencaptureui_DTUQ1L/스크린샷 2026-07-14 오후 10.22.41.png`
- Implementation evidence: `/Users/toris/projects/memecatch/artifacts/design-qa/timeline-after-1668x1226.png`
- Mobile evidence: `/Users/toris/projects/memecatch/artifacts/design-qa/timeline-mobile-after-390x844.png`
- Full comparison: `/Users/toris/projects/memecatch/artifacts/design-qa/timeline-before-after.png`
- Focused comparison: `/Users/toris/projects/memecatch/artifacts/design-qa/timeline-before-after-focus.png`
- Desktop viewport: 1668 × 1226
- Mobile viewport: 390 × 844
- State: Korean locale, top of timeline, locally seeded representative 1991/1992/2000 entries
- Browser: Codex Desktop in-app Browser

## Comparison history

### Pass 1 — source screenshot

- P1: Four-digit year labels wrapped (`1991` → `199` + `1`, `1992` → `199` + `2`).
- P1: The horizontal card strip exceeded the available content width and clipped the right-most card.
- P2: Category and media badges wrapped inside narrow cards.
- P2: Timeline used a narrower container contract than the global header, so horizontal rhythm did not share one alignment system.

### Pass 2 — implementation screenshot

- Year rail reserves 80–96 px at desktop breakpoints and applies `white-space: nowrap`; `1991`, `1992`, and `2000` each render on one line.
- Cards use a two/three/four-column responsive grid rather than a desktop horizontal strip. All four desktop cards remain inside the 1024 px container.
- Badge labels remain on one line and the 390 px mobile layout retains two columns without horizontal overflow.
- Header inner container and main container both measure 1024 px and share left/right coordinates (322 px / 1346 px) at 1668 px viewport width.
- Desktop document width: 1668 px client width / 1668 px scroll width.
- Mobile document width: 390 px client width / 390 px scroll width.
- Console: no runtime errors. Two unrelated development warnings remain (logo LCP eager hint and AdSense `data-nscript`).

## Interaction and responsive checks

- Korean language selection works and updates header/navigation labels.
- Timeline links remain keyboard/semantic links after the layout change.
- Desktop grid: four visible cards for a full year row.
- Mobile grid: two visible columns, 16 px content inset, no clipped year label or page-level horizontal scrolling.

## Final severity check

- P0: none
- P1: none
- P2: none
- P3: unrelated development-only warnings noted above

Final result: passed
