# Loop 148 — TikTok public oEmbed high-7 agent review (2026-08-29)

Ranking file: `data/memes/review/social-source-ranking-tiktok-public-oembed-2026-08-28.jsonl`  
Insert contract: `scripts/prepare-contextual-social-promotions.mjs` + `scripts/contextual-social-promotions-to-sql.mjs`  
No new auto-publish pipeline. Moderation status of memes was not changed.

## Decisions

| # | Ranking title | URL | Decision | Why | Written |
| --- | --- | --- | --- | --- | --- |
| 1 | 검정고무신 애니메이션 | tiktok.com/@user46581317026217/video/7215972442940984577 | skipped | already in production (5pzu8tzp); prepare gate would fail (weak title / fanmade) | none |
| 2 | 포철고 챌린지 | tiktok.com/@yul.__2/video/7361412126969302280 | skipped | already in production (vh6ah33y) from 2026-07-16 batch | none |
| 3 | 검정고무신 애니메이션 | tiktok.com/@ckdqhbgryqj/video/7452655814482922760 | skipped | already in production (5pzu8tzp); prepare gate would fail (clip reuse) | none |
| 4 | 봄바르딜로 크로코딜로 | tiktok.com/@armenjiharhanyan/video/7473526211541536055 | insert (SQL ready) | oEmbed 200; alias Bombardiro Crocodilo; live title is 봄바르디로 크로코딜로(Bombardiro Crocodilo) (acueznbz). URL absent. Local seed has no row. Production SQL not applied (write gate). | `tiktok-oembed-high7-promotions-2026-08-29.sql` unapplied |
| 5 | 이탈리안 브레인로트 | tiktok.com/@bstchld/video/7584647367173967135 | inserted locally | oEmbed 200; ranking title gone; surviving 이탈리안 브레인롯 (local 8egbfkba limited). Production URL still absent. | local `meme_contents` + `meme_sources` |
| 6 | 이탈리안 브레인롯 (broader) | same as #4 | skipped | broader_meme_match; Bombardiro ≠ 이탈리안 브레인롯 | none |
| 7 | 인생네컷 | tiktok.com/@itslive_official/video/7276462763906551042 | skipped | already in production (xzy4nr54) | none |

## Local apply evidence

```
docker exec -i supabase_db_memecatch psql … < tiktok-oembed-high7-promotions-local-2026-08-29.sql
INSERT 0 1 / INSERT 0 1 / COMMIT
이탈리안 브레인롯 | …/7584647367173967135 | is_representative=f | embeddable | Gabe Cataldi
```

## AuthInvite

- SSR HTML includes `data-auth-invite="pending"` + same guest copy + `invisible pointer-events-none`
- Mobile 390×844: pending→guest markup swap deltaAfterTop=0, deltaInviteH=0, layout-shift entries=[]
- `pnpm exec vitest run components/auth-invite.test.tsx` — 3/3 passed
- On the verified detail page the card sits below the first viewport (after answer + media)

## Admin unsourced

Unauthenticated `GET /admin/memes?focus=unsourced` → 307 `/login?next=%2Fadmin%2Fmemes` (focus query dropped). No operator session; queue not opened.
