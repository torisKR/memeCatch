# Loop 089 verification

## 코드 검증

- focused: `pnpm exec vitest run components/admin/missing-translation-draft-preview.test.tsx`
  - **1 file / 7 tests passed** — missing row claim 후 focus route, claim failure 정지, 기존 GPT
    preview/edit/save 회귀
- full suite: `pnpm test`
  - **152 files / 998 tests passed**
- typecheck: `pnpm exec tsc --noEmit`
  - passed
- targeted lint: `pnpm exec eslint components/admin/translation-priority-queue.tsx components/admin/missing-translation-draft-preview.test.tsx`
  - passed
- lint: `pnpm lint`
  - **0 errors / 7 existing warnings**
- production build: `pnpm build`
  - Next.js 16.2.10 webpack, **73/73 static pages generated**
  - existing metadataBase warnings remain
- translation coverage: `pnpm translation:check`
  - **448/1,520 rows**; en=122, ja=142, zh=90, zh-tw=94; missing=1,072
- diff hygiene: `git diff --check`
  - passed

## 수동 QA 경계

- local production server에서 signed-out `GET /admin/translations`를 관찰했다.
  - **307 → `/login?next=%2Fadmin%2Ftranslations`**
  - security headers와 `content-language: ko` 유지
- authenticated operator session과 live translation request fixture가 없어 실제 claim RPC, GPT
  Responses API 호출, machine insert, human reviewed 승인까지는 실행하지 않았다.
- component surface에서 missing row click → claim success → exact focus route와 claim error → queue
  stay를 관찰했다.

## 운영 경계

- migration/table/RPC/cron, production DB write, 번역 발행, external post, push/merge/deploy를
  수행하지 않았다.
- 기존 GPT helper는 `gpt-5.6-sol` + `reasoning.effort=high` + strict JSON + `store=false`로
  유지된다.
- 글로벌 공급은 **448/1,520**에 머물며, `machine`은 human `reviewed/current` 전까지 public,
  sitemap, Plus ready가 아니다.
