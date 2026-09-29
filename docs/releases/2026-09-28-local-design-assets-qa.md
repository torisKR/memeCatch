# Local design-asset preview and QA — 2026-09-28

## Scope

Original checkout: `/Users/toris/projects/memecatch` on `main`.

The user requested the previously offered AdSense status notification plus a running local preview and actual tests of the existing design assets. No deployment, review resubmission, Google account mutation, database mutation, or Git commit/push was performed. Existing application design and business code were not changed in this pass.

## Running preview

- URL: `http://127.0.0.1:3105/?lang=ko`
- English: `http://127.0.0.1:3105/en`
- Other localized homes: `/ja`, `/zh`, `/zh-tw`.
- Process launched: PID 3397, Next production-mode server bound to `127.0.0.1:3105`.
- Log: `/tmp/memecatch-design-preview-20260928.log`.
- The server is intentionally left running for inspection on the user's Mac. It is not exposed over the public network or automatically started on login.
- Preload: `.local/design-preview-runtime-20260928.mjs`, importing the existing read-only runtime guard, disables the AdSense runtime and uses a loopback site origin without editing `.env.production`.
- This is a design/data-reading preview; do not use it for real submissions, uploads, purchases, or moderation. Remote mutation attempts through the guarded fetch path are blocked. The browser test uses disposable profiles, no user login credentials, and blocks advertising endpoints.
- The generated `.next` build uses the loopback preview origin. Rebuild with the actual deployment configuration before publishing; do not deploy this local artifact.

## Fresh verification

Node: 24.16.0.

- Focused asset/home/locale tests: **9 files, 70 tests passed**.
- Production-mode build: **passed**, including TypeScript and 96 static pages.
- Existing special-route metadataBase warnings: three; not modified in this task.
- Extended live Chrome run: **passed**, no captured JavaScript exceptions or broken images, no observed horizontal overflow, no loaded AdSense runtime.
- All **15 combinations** of ko/en/ja/zh/zh-tw and 375/768/1440 CSS-pixel widths contained the same five home sections, matching document and selected locale, four usage-signal disclosures, and a working 3D canvas.
- Stale preference cookie and real language-selector change both produced the correct Korean/English home.
- Actual WebGL draw calls confirmed playing, pause, resume, reduced-motion pause, preference restoration, off-screen pause, and return-to-viewport resume.
- Forced context loss removed the canvas and retained the SVG fallback.
- Emulated no-WebGL, Save-Data, and deviceMemory=2 modes each used the visible SVG fallback with zero WebGL draws.
- All four usage-signal disclosures opened and closed using native Enter keystrokes.

### Test-harness issue found and resolved

The first extended keyboard run failed all four open checks. Its low-level keyDown events omitted the Enter character text. The harness was corrected to send `text` and `unmodifiedText` as carriage return, matching native keyboard event semantics; no application component was changed. The subsequent full extended run passed all keyboard assertions. The initial failed report was retained; no assertion was deleted or converted into an expected failure.

References used for the keyboard harness:
- https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchKeyEvent
- https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/server/chromium/crInput.ts

## Evidence on the user's Mac

Final successful report and 23 state screenshots:
`/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-NdcBag/`

Representative files: `report.json`, `ko-375.png`, `en-375.png`, `ko-768.png`, `ko-1440.png`, `dark-reduced-motion.png`, `keyboard-signal-icons.png`, `context-loss-fallback.png`, `no-webgl.png`, `save-data.png`, `low-memory.png`.

Initial extended failure evidence:
`/var/folders/1k/hsqljbyj4c9_ky4dsfh26k1r0000gn/T/memecatch-home-qa-LwTwIg/report.json`

A separate native-image review delegation and an ad-hoc browser diagnostic were blocked by the tool security gate. No permission changes or protected-session access were attempted. The completed coverage above is based on the normal local browser regression script and actual recorded browser state, not a claim of an independent screenshot-design sign-off.

## Reproduce

With the preview running:

```sh
node scripts/qa-unified-home.mjs
```

Start the preview again after it has stopped (the build must already exist):

```sh
NODE_OPTIONS='--import /Users/toris/projects/memecatch/.local/design-preview-runtime-20260928.mjs' \
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3105
```

Before stopping a recorded PID, verify it still belongs to this preview using `lsof -nP -iTCP:3105 -sTCP:LISTEN` and process inspection. PID numbers may later be reused.

## Notification

A ChatGPT condition-watch task was successfully created: check daily around 09:00 Asia/Seoul; notify only on a newly confirmed AdSense site status of Ready or Needs attention. The ads.txt status is not treated as site approval. This task does not resubmit reviews or change account settings. Actual future inspection depends on the authorized connector/browser remaining accessible and authenticated; unavailable state is never interpreted as an approval.

## Limitations

Chrome responsive emulation is not a physical-phone GPU benchmark, Safari test, complete WCAG audit, or an authenticated seller/moderator E2E run. This pass neither changes nor certifies the external AdSense site-review result.
