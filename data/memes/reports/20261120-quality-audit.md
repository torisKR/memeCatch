# Content quality audit, 2026-11-20

**Basis: metadata snapshot only.** This audit uses `memes.csv` (read-only production export taken 2026-11-20, 5,096 memes, all statuses). It reads lengths and counts (summary_len, description_len, origin_len, usage_examples_n, sources_n, contents_n, translations_n) and status/date columns. It does **not** read the full text of any meme.

Consequently it cannot detect: factual errors in summary, description, or origin; whether a source actually supports the claim it is attached to; dead or changed source URLs; misleading or unidiomatic usage examples; boilerplate or copy-pasted prose unless it changes a length; caution or usage-note quality; translation quality or stale translations; tag quality; whether media actually plays; safety-level misclassification; near-duplicates that do not share a title or alias; and whether `contents_n` counts only renderable content. Counts are taken as recorded.

Scope: "public" means moderation_status approved or limited (3,840 memes). Non-public means pending, fact_checking, rights_checking, or rejected (1,256 memes).

Title key: Python port of `scripts/meme-title-key.mjs`, verified to match the Node implementation on all 10,298 titles and aliases in the export (0 mismatches).

## 1. Normalized title/alias collisions among public memes
- Public memes with a collision to a **public** meme: **654** — t6hxy4r2 (훈남), 7v79r9re (엽기), wjcbn47v (황빠, 황까), s5uqajj2 (애매한것을정해주는남자, 애정남), 32v5hkm3 (ᄀᄉ, 초성체), bq2mdv4s (여의도텔레토비, snl코리아여의도텔레토비), k8emreny (훈남), gpu8f289 (멘탈붕괴), qnemt5c4 (애매합니다잉), ffvcm8bg (오나전캐안습, 오나전), jd9t24mf (허니버터칩대란, 허니버터칩품절대란, 허버칩), wqvt4wj4 (엄친아, 엄친딸), x6ysg6rw (엄친아, 엄친딸), yazz5dvu (응답하라시리즈), xyfnse8f (니가가라하와이), 6umhkq5y (명수는12살), q9tq66rx (뽀대나다), mfg8gter (방가방가), 9qt2zgd6 (무비무비무비), pmhr9r35 (기모찌), yut7x3qp (마음의소리), mf8qtmz3 (테란의황제), hy3gqdv6 (정다연), ftahcnss (야인시대사딸라), mwr3b2y3 (안구에습기), wzpmcqpd (런닝맨기린, 이광수기린), tvypr49h (박명수어록), twfwrn7c (탑블레이드, 베이블레이드), 78q9skag (낚였다, 낚시글, 떡밥), hw6shn7w (낚였다, 낚시글, 낚시), dqk37gzs (윤후짜파구리), tet9nfv7 (34, 룰라삼사), hupx34xy (마시마로), k834ev8g (회오리춤), ngvj9sct (애매한것을정해주는남자), dsecykzp (런닝맨기린, 이광수기린), 7wzzs3ez (병맛), eb4vgkdn (박명수어록), 2gvy9tyj (다모폐인), tbntu54k (뿌까, pucca) … +614 more
- Public memes with a collision to a **non-public** meme only (no public-public): **28**
  — dr2ksdx6 (싸이월드도토리, 도토리), 94bhhfek (마네킹챌린지, mannequinchallenge), xa8jrd42 (할많하않), 26zd6ga5 (tungtungtungsahur), kt3mnpct (리즈시절), nxt5edxz (67), a3a3gk7e (labubu), sthk2gqa (황금막내), gc53rtqh (허거덩거덩스, 허거덩거덩스한상황), sexkn7zy (2026isthenew2016), n4srdru6 (아이러브스쿨), evr2qu8t (다마고치열풍, 다마고치), drxj4skw (퇴마록), q7cjtg8h (버디버디), zpqke8cg (차가운도시남자, 차도남차도녀, 차가운도시여자), jajqn55r (popcat), dqdg5gfe (치킨조키, chickenjockey), vm8bpc3g (케데헌골든, 골든), w5aw2r2f (공룡만해밈), ux8vqp8u (aurafarming), smbxrr4v (chillguy), yzbfc8yk (moodeng), af6b6477 (gorpcore), d76hm4tg (grimaceshake), q3a6zzj7 (coquetteaesthetic), n4c6q333 (bratsummer), ndzke4ad (wellerman), aydhk9yy (베댓)
- Public memes with both kinds: **16**
- Total distinct public memes with any collision: **682**

## 2. Status / publish-date mismatches
Legitimate combinations (validator header and `--audit-sql` note): approved or limited with a published date; pending, fact_checking, rights_checking, or rejected without one. `limited` with a date is treated as consistent. Rows failing the first rule are the audit SQL's `approved_missing_published_at`; the second rule is `unpublished_status_has_published_at`.
- **Public (approved/limited) with no published date: 0**
  - of which approved: 0, limited: 0
- **Non-public with a published date: 722** — s9avp6rt (fact_checking), a4hkbc7n (fact_checking), anpd9kpv (fact_checking), 6su5ry86 (fact_checking), xgfn3js5 (fact_checking), j29t8s8a (fact_checking), 3unk6uev (fact_checking), gbywgftu (fact_checking), xdyc4wjw (fact_checking), d8tpejey (fact_checking), xnny5aea (fact_checking), 9ztqunac (fact_checking), d9x3hvf2 (fact_checking), 2jaw8rkp (fact_checking), skdu5qft (fact_checking), 4umxfw2w (fact_checking), vt2kywqy (fact_checking), 23vrggux (fact_checking), r2kyhx6v (fact_checking), 59sjkavg (fact_checking), 8mkj7tfh (fact_checking), 2nj2eqr5 (fact_checking), mhmeje2q (fact_checking), 75w3a6ds (fact_checking), r689fa8v (fact_checking), a4f84j6w (fact_checking), 8pg6zgh5 (fact_checking), nvkr7w9t (fact_checking), ubc58b2k (fact_checking), hq2n9fb2 (fact_checking), jazzxgub (fact_checking), 24mx6jve (fact_checking), 9hx33p29 (fact_checking), rv84nnnj (fact_checking), ucf3un3t (fact_checking), 2bmxxbbw (fact_checking), zax25rjx (fact_checking), agt9rbew (fact_checking), 7qp8ntfe (fact_checking), g8p2rz8j (fact_checking) … +682 more
  - by status: {'fact_checking': 119, 'rejected': 603}

## 3. Thin content on public memes
- **summary<20: 91** — dxwk6j96, s26gzmev, j3n8rcxe, 4xtm9emu, q9hgvnvy, kwwutywf, ymvna47f, eg262hn7, pb57adjq, fa4vzxye, qty9n9nb, m2vpvmfz, cvv23fa3, acy77h6t, 595cu5st, h74pncek, egpkwnpg, 345hhqyt, r2zsubzc, vfq5mqa3, yujhwhux, k7x4uevb, da4tvkk7, bzh8g6bk, twe3bysb, tdk6c5u7, 9gkyrhav, ynufkn9u, x9syfzpq, 7j6vwb5q, mzajf3vg, tqbhjqd2, n9tad97v, x9fehcsf, k6rfn5em, gppkepjq, tb7jxmzd, grx9f9sa, 9rwdkz5y, p523a89e … +51 more
- **description<150: 2702** — dxwk6j96, s26gzmev, wu27ecn7, t6hxy4r2, 7v79r9re, 77m87r9b, mazce2u5, wjcbn47v, 8gk69mj9, 67zvzczp, 9e4wxp8e, s5uqajj2, h4w6zhbr, jxxnks9w, 32v5hkm3, jgrnwbj7, bq2mdv4s, ecy3rsff, k8emreny, d6dggtkp, kz56s7kc, xzgpfqdb, gpu8f289, qnemt5c4, ffvcm8bg, ee2bv4y9, jd9t24mf, r57ffqg6, m7eaa6k7, wqvt4wj4, 2frja29t, anvpkqqb, 63q6qnp7, vpbvzztu, vufkrm6m, 85pcv532, ce5h6eek, r6dm73h2, rawdcja5, yazz5dvu … +2662 more
- **origin=0: 0**
- **usage_examples=0: 3569** — dxwk6j96, s26gzmev, wu27ecn7, t6hxy4r2, 7v79r9re, 77m87r9b, tbq4j5n2, mazce2u5, wjcbn47v, 67zvzczp, 9e4wxp8e, s5uqajj2, 6tvcnre5, jxxnks9w, amtuc4nf, 32v5hkm3, bq2mdv4s, ecy3rsff, k8emreny, d6dggtkp, kz56s7kc, xzgpfqdb, gpu8f289, qnemt5c4, ffvcm8bg, ee2bv4y9, m7eaa6k7, wqvt4wj4, 2frja29t, anvpkqqb, 63q6qnp7, vpbvzztu, 85pcv532, ce5h6eek, r6dm73h2, rawdcja5, zpsr9u2k, 9wtcc3nd, kv6d9ctc, hrmcn8n8 … +3529 more
- **Overlap: failing 3 or more of the four: 66** — dxwk6j96 (summary<20,description<150,usage_examples=0), s26gzmev (summary<20,description<150,usage_examples=0), 4xtm9emu (summary<20,description<150,usage_examples=0), q9hgvnvy (summary<20,description<150,usage_examples=0), kwwutywf (summary<20,description<150,usage_examples=0), ymvna47f (summary<20,description<150,usage_examples=0), eg262hn7 (summary<20,description<150,usage_examples=0), pb57adjq (summary<20,description<150,usage_examples=0), fa4vzxye (summary<20,description<150,usage_examples=0), m2vpvmfz (summary<20,description<150,usage_examples=0), cvv23fa3 (summary<20,description<150,usage_examples=0), acy77h6t (summary<20,description<150,usage_examples=0), 595cu5st (summary<20,description<150,usage_examples=0), h74pncek (summary<20,description<150,usage_examples=0), egpkwnpg (summary<20,description<150,usage_examples=0), r2zsubzc (summary<20,description<150,usage_examples=0), vfq5mqa3 (summary<20,description<150,usage_examples=0), yujhwhux (summary<20,description<150,usage_examples=0), k7x4uevb (summary<20,description<150,usage_examples=0), bzh8g6bk (summary<20,description<150,usage_examples=0), 7j6vwb5q (summary<20,description<150,usage_examples=0), mzajf3vg (summary<20,description<150,usage_examples=0), tqbhjqd2 (summary<20,description<150,usage_examples=0), n9tad97v (summary<20,description<150,usage_examples=0), k6rfn5em (summary<20,description<150,usage_examples=0), gppkepjq (summary<20,description<150,usage_examples=0), tb7jxmzd (summary<20,description<150,usage_examples=0), grx9f9sa (summary<20,description<150,usage_examples=0), 9rwdkz5y (summary<20,description<150,usage_examples=0), p523a89e (summary<20,description<150,usage_examples=0), s7ccn5zn (summary<20,description<150,usage_examples=0), 7h2zrbdz (summary<20,description<150,usage_examples=0), cmz3rw6v (summary<20,description<150,usage_examples=0), 99u2rws3 (summary<20,description<150,usage_examples=0), cj5a7hdh (summary<20,description<150,usage_examples=0), xs8gfxnv (summary<20,description<150,usage_examples=0), jg2rcqrn (summary<20,description<150,usage_examples=0), mkbpmpus (summary<20,description<150,usage_examples=0), a2njf7cc (summary<20,description<150,usage_examples=0), btn46tug (summary<20,description<150,usage_examples=0) … +26 more
  - failing all four: 0

## 4. Sources and contents on public memes
- **Public with sources_n = 0: 1151** — kv6d9ctc, rwxyhzba, 9qt2zgd6, fncws5uw, g3ggtkn4, fms9q3qa, 47vdwv36, e7eqt6t4, 3pccytjy, 3jhy8rcp, ry623jhw, pjg2amsh, vggzgpuw, 5mpe4rek, zbmkzfkr, wubqkwet, 52uwbnkw, jc7x94gc, fa4vzxye, ajecnvw2, e4gugufp, 595cu5st, rw76s7f7, bkd2bn7h, fcd99djb, ybsmbq96, 6gfw8xv9, znf9nzz2, r7gv8gwb, du7kpb5q, qugz4vuz, cwqhbfbb, asgmqcpt, t7nzpdw6, dtdnwyfk, 7m5c6srw, nz3362jc, wrqv9pnq, 8zd9y3n8, snbmsypv … +1111 more
- **Public image/video/audio/embed with contents_n = 0: 139** — 77m87r9b (image), tbq4j5n2 (image), jxxnks9w (image), ecy3rsff (image), 2frja29t (image), rawdcja5 (image), yut7x3qp (image), qfgk225g (image), tvypr49h (image), kbq4za8x (image), wu38tb9q (image), 9gfxwpbh (image), 595cu5st (image), fcd99djb (image), wrqv9pnq (image), jearh7bj (image), y9mvckkf (image), mq38uqvq (image), v75gxh8v (image), bdxf4uh4 (image), 6u9quqrc (image), fxv3z2bx (image), jw7btga4 (image), thtuhntt (image), 8a9cmvye (image), u9j6hhnh (image), ghy4rpys (image), 2vgjr9kk (image), utuxgryy (image), 7a988khc (image), rbcgz5de (image), 5mv67vam (image), w65bda4t (image), 9evk56cg (image), wap5k4mw (image), j8efhs7z (image), 5zrbscnt (image), msf9wpux (image), sr5ajf2g (image), nsmvyrtq (image) … +99 more
  - by media type: {'image': 138, 'video': 1}

## 5. Translations on public memes
- **Public with translations_n < 4: 3785** — dxwk6j96, s26gzmev, wu27ecn7, t6hxy4r2, 7v79r9re, 77m87r9b, tbq4j5n2, mazce2u5, wjcbn47v, 8gk69mj9, 67zvzczp, 9e4wxp8e, s5uqajj2, 6tvcnre5, h4w6zhbr, jxxnks9w, amtuc4nf, 32v5hkm3, jgrnwbj7, bq2mdv4s, ecy3rsff, k8emreny, d6dggtkp, kz56s7kc, xzgpfqdb, gpu8f289, qnemt5c4, ffvcm8bg, ee2bv4y9, jd9t24mf, m7eaa6k7, wqvt4wj4, 2frja29t, anvpkqqb, 63q6qnp7, vpbvzztu, vufkrm6m, 85pcv532, ce5h6eek, r6dm73h2 … +3745 more
  - translations_n distribution over public memes: {0: 3483, 1: 142, 2: 138, 3: 22, 4: 55}

## 6. Year anomalies (all statuses; public subset in brackets)
- origin_year null: 703 [public 229] — public sample: 4mdsjtqz, mfsp5nra, ewtakyd2, csy6ezjx, k6wqe4b3, rp9myfb4, y9vyy3me, p25jxxt6, pppqkseg, gek3qt6q, e7bku5ud, gdx9jp5s, takbtz7w, akakfnpf, 92tdev6m, sfwxj2yw, 2qydeur7, htbcwa4t, cn2ejr3s, jwwcr8mq, y25z62gt, gj6bpnh7, hwwbzv8w, 99g2kag9, 597hba6f, 3wjwz86n, 7g3sudjj, 2phh45vr, 9str3b7e, nj8c8uv7, v3ua9b8f, khtg2cwu, 6tygkgjf, cm7khbxz, jfsn6y9q, dduk8tcx, tkycun8r, ea4d8vk7, e7uvpzpf, csahkf49 … +189 more
- origin_year > 2026: 0 [public 0] — none
- origin_year < 1990 with year_precision 'exact': 0 [public 0] — none
- Context: origin_year < 1990 overall: 19

## 7. Distributions
### moderation_status (all)
| moderation_status | count |
|---|---|
| approved | 3833 |
| rejected | 605 |
| fact_checking | 582 |
| pending | 68 |
| limited | 7 |
| rights_checking | 1 |
### category (all / public)
| category | all | public |
|---|---|---|
| phrase | 2415 | 1831 |
| image | 1028 | 432 |
| comment | 747 | 721 |
| challenge | 353 | 312 |
| song | 281 | 277 |
| dance | 272 | 267 |
### origin_year (public only)
| origin_year | count |
|---|---|
|  | 229 |
| 1980 | 3 |
| 1982 | 1 |
| 1983 | 1 |
| 1984 | 2 |
| 1986 | 4 |
| 1987 | 3 |
| 1988 | 1 |
| 1989 | 3 |
| 1990 | 16 |
| 1991 | 11 |
| 1992 | 12 |
| 1993 | 22 |
| 1994 | 18 |
| 1995 | 18 |
| 1996 | 28 |
| 1997 | 34 |
| 1998 | 40 |
| 1999 | 62 |
| 2000 | 69 |
| 2001 | 78 |
| 2002 | 80 |
| 2003 | 53 |
| 2004 | 45 |
| 2005 | 70 |
| 2006 | 51 |
| 2007 | 50 |
| 2008 | 69 |
| 2009 | 41 |
| 2010 | 88 |
| 2011 | 93 |
| 2012 | 118 |
| 2013 | 87 |
| 2014 | 97 |
| 2015 | 173 |
| 2016 | 124 |
| 2017 | 120 |
| 2018 | 190 |
| 2019 | 144 |
| 2020 | 213 |
| 2021 | 220 |
| 2022 | 251 |
| 2023 | 230 |
| 2024 | 237 |
| 2025 | 254 |
| 2026 | 87 |
### lifecycle_status (all / public)
| lifecycle_status | all | public |
|---|---|---|
| cooling | 2781 | 2254 |
| archived | 2233 | 1569 |
| active | 64 | 12 |
| rising | 18 | 5 |

## 8. Top 50 public memes most worth enriching
Rule: public memes failing at least one finding-3 threshold, or with a partial content-depth score below MIN_SCORE (5). Sort: origin_year >= 2023 first, then lower partial score, more failed thresholds, shorter description, short_id. Partial score uses lib/content-depth.ts weights without caution or tags (not in snapshot); sources_n and contents_n are raw counts.
- Public memes with a partial score below 5: **3322**; candidates for ranking: **3775**; candidates with origin_year >= 2023: **793**

| # | short_id | title | origin_year | partial score | failed thresholds | desc | origin | examples | sources | contents |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 4unq3c4s | 분깨미 | 2024 | 0 | 2 | 60 | 25 | 0 | 0 | 0 |
| 2 | 2ye5znk7 | 느좋 | 2025 | 0 | 2 | 64 | 25 | 0 | 0 | 0 |
| 3 | a4x9x7yp | 두유노클럽 | 2023 | 0 | 2 | 67 | 8 | 0 | 0 | 0 |
| 4 | w65bda4t | 구냥이 | 2025 | 0 | 2 | 70 | 23 | 0 | 0 | 0 |
| 5 | 8pt2qs9c | 캘박 | 2024 | 0 | 2 | 73 | 22 | 0 | 0 | 0 |
| 6 | v7pa5zeg | 극락퀴즈쇼 | 2023 | 0 | 2 | 73 | 8 | 0 | 0 | 0 |
| 7 | rbcgz5de | 곰뚜리 | 2025 | 0 | 2 | 75 | 19 | 0 | 0 | 0 |
| 8 | w3w7whgc | 뉴스파이팅 | 2023 | 0 | 2 | 77 | 8 | 0 | 0 | 0 |
| 9 | 3s8e39ka | 완내스 | 2023 | 0 | 2 | 81 | 12 | 0 | 0 | 0 |
| 10 | mu9jsrzq | ○○가 되♡ | 2024 | 0 | 2 | 81 | 13 | 0 | 0 | 0 |
| 11 | b8f83qjx | 잠뜨롤 | 2024 | 0 | 2 | 82 | 14 | 0 | 0 | 0 |
| 12 | qmga225k | 빅블러 | 2025 | 0 | 2 | 82 | 24 | 0 | 0 | 0 |
| 13 | k8haba5h | 종노플예 | 2025 | 0 | 2 | 83 | 27 | 0 | 0 | 0 |
| 14 | rdhz2s2j | 망고주스 밈 | 2025 | 0 | 2 | 83 | 24 | 0 | 0 | 0 |
| 15 | r8mu97fy | OO 소개시켜줘야쥬 밈 | 2026 | 0 | 2 | 84 | 21 | 0 | 0 | 0 |
| 16 | 5qvf2smj | 쥬니햄 | 2025 | 0 | 2 | 85 | 24 | 0 | 0 | 0 |
| 17 | 7a58j43j | 강지시간 | 2023 | 0 | 2 | 85 | 13 | 0 | 0 | 0 |
| 18 | 8wqr6fau | 까이스 | 2023 | 0 | 2 | 85 | 16 | 0 | 0 | 0 |
| 19 | n9atkq5b | 일며들다 | 2024 | 0 | 2 | 88 | 21 | 0 | 0 | 0 |
| 20 | 4vhxyzxc | 키캉스 | 2025 | 0 | 2 | 89 | 24 | 0 | 0 | 0 |
| 21 | 9evk56cg | 몰랐어 짤 | 2025 | 0 | 2 | 89 | 22 | 0 | 0 | 0 |
| 22 | p6a8tajj | 밥플릭스 | 2025 | 0 | 2 | 89 | 17 | 0 | 0 | 0 |
| 23 | 2hxyujqj | 하룰라라 | 2025 | 0 | 2 | 91 | 26 | 0 | 0 | 0 |
| 24 | zgjsjrye | 투꾸 해피밀 밈 | 2025 | 0 | 2 | 91 | 22 | 0 | 0 | 0 |
| 25 | 2vgjr9kk | 김장조끼 | 2026 | 0 | 2 | 92 | 24 | 0 | 0 | 0 |
| 26 | 6yrfjkfp | 허경환 유행어 | 2026 | 0 | 2 | 92 | 24 | 0 | 0 | 0 |
| 27 | 5zrbscnt | 눈멍이 | 2025 | 0 | 2 | 93 | 22 | 0 | 0 | 0 |
| 28 | ra75u8v7 | 가면비 | 2025 | 0 | 2 | 94 | 17 | 0 | 0 | 0 |
| 29 | w3zf2pgp | 동결건조 밈 | 2026 | 0 | 2 | 94 | 24 | 0 | 0 | 0 |
| 30 | 7p4mgtfn | 노포 이용주(용주르이용주) | 2023 | 0 | 2 | 95 | 8 | 0 | 0 | 0 |
| 31 | xn9yfy4y | 얼먹젤리 | 2026 | 0 | 2 | 96 | 23 | 0 | 0 | 0 |
| 32 | 7z6gerb3 | 텍스트힙 | 2025 | 0 | 2 | 97 | 24 | 0 | 0 | 0 |
| 33 | grypv5sn | 드르륵 칵 | 2025 | 0 | 2 | 97 | 24 | 0 | 0 | 0 |
| 34 | nnguxwwk | 블로그 제목 밈 | 2025 | 0 | 2 | 97 | 22 | 0 | 0 | 0 |
| 35 | ytb6tvkm | 이모카세 | 2025 | 0 | 2 | 97 | 24 | 0 | 0 | 0 |
| 36 | 4purnhbm | 랜선생님 | 2025 | 0 | 2 | 98 | 17 | 0 | 0 | 0 |
| 37 | f4bkjg9q | 걍 회사 가는 나 | 2025 | 0 | 2 | 98 | 26 | 0 | 0 | 0 |
| 38 | h8m2ykkj | OO 알려주겠다 밈 | 2025 | 0 | 2 | 98 | 27 | 0 | 0 | 0 |
| 39 | rjgmjfrq | 미코노미 | 2025 | 0 | 2 | 98 | 24 | 0 | 0 | 0 |
| 40 | ua4vgf5y | 봄바람 왱왱왱 | 2025 | 0 | 2 | 98 | 29 | 0 | 0 | 0 |
| 41 | zxjrapp9 | 듀아아아 밈 | 2025 | 0 | 2 | 98 | 20 | 0 | 0 | 0 |
| 42 | 9znqaxxv | OO했던 그날 밈 | 2025 | 0 | 2 | 99 | 27 | 0 | 0 | 0 |
| 43 | b8y3xvqy | 놉놉 안됀는것은안돼는것 | 2025 | 0 | 2 | 101 | 27 | 0 | 0 | 0 |
| 44 | 4ypx55yw | 갑차기스러운데 | 2025 | 0 | 2 | 102 | 28 | 0 | 0 | 0 |
| 45 | ubbe9xyu | 킥플립 계훈 버블 | 2025 | 0 | 2 | 102 | 27 | 0 | 0 | 0 |
| 46 | f848z792 | 장시간 비행 옆자리 골라라 밈 | 2026 | 0 | 2 | 103 | 26 | 0 | 0 | 0 |
| 47 | 7wd5pw3m | 화가 머리 끝까지 나네(화:120) | 2025 | 0 | 2 | 105 | 27 | 0 | 0 | 0 |
| 48 | qunyp3q8 | 햄부기 밈 | 2025 | 0 | 2 | 105 | 24 | 0 | 0 | 0 |
| 49 | y3gkzypu | 건축물 리뷰 밈 | 2026 | 0 | 2 | 107 | 23 | 0 | 0 | 0 |
| 50 | 5mv67vam | 투꾸 | 2026 | 0 | 2 | 108 | 29 | 0 | 0 | 0 |

