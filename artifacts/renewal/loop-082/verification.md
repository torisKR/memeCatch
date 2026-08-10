# LOOP-082 Verification — Artifact-first translation intake

## Scope

사람/외부 편집자가 제공하는 번역 pack을 자동 공개 없이 운영자 검수용 SQL artifact로
변환하는 intake 수직만 변경했다. 실제 번역 문구와 Supabase 쓰기는 수행하지 않았다.

## Acceptance evidence

- `scripts/translation-intake.mjs` 기본 실행은 report-only다.
- `--emit-artifact`는 `--require-complete` 없이는 거부된다.
- 지원 locale은 `en`, `ja`, `zh`, `zh-tw`로 제한된다.
- 밈별 네 locale, worklist membership, duplicate `(meme_id, locale)`, 동일 source snapshot,
  기존 target-language/source-fidelity validator를 검사한다.
- 출력 SQL은 기존 atomic source lock, public moderation gate, machine status,
  `reviewed_at = null`, conflict guard를 재사용한다.

## Commands

| 명령 | 결과 |
| --- | --- |
| `pnpm translation:intake:test` | PASS — temporary 4-locale pack 검증·SQL artifact 생성·기존 checker readback |
| `pnpm translate:memes:mlx-linked:test` | PASS — 기존 MLX-linked safeguards 회귀 없음 |
| `node scripts/translation-intake.mjs --help` | PASS — report-only/write usage와 complete gate가 노출됨 |
| `pnpm translation:check -- --json` | PASS — 448/1,520, errors 0 |
| `pnpm translation:check:complete -- --json` | EXPECTED FAIL — en 258 / ja 238 / zh 290 / zh-tw 286 missing |
| `pnpm test` | PASS — 148 files / 961 tests |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm lint` | PASS — 0 errors / existing warnings 7 |
| `pnpm build` | PASS — Next.js 16.2.10 webpack, 73/73 static pages; existing metadataBase warnings |
| `git diff --check` | PASS |

## Boundary

실제 번역 pack 제공, 운영자 번역 검수·CAS 발행, Supabase migration/SQL 적용, authenticated
Plus·관리자 E2E, production deploy/push/merge는 미수행이다. 현재 글로벌 offline catalog는
문구를 발명하지 않아 448/1,520행 그대로다.
