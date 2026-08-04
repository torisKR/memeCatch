-- HG-008 B안 재분류 DML — 표본 검토에서 확인된 「밈 아님」 9건을 doc_class='event'로
-- 전환한다. 선행 조건: 20260804120000_meme_doc_class.sql이 적용돼 있어야 한다
-- (doc_class 컬럼 존재). 대상·근거: artifacts/renewal/loop-023/sample-review-synthesis.md
-- §3. 전부 moderation_status='approved'(공개 상태), URL·moderation_status는 그대로
-- 유지한다 — 바뀌는 것은 doc_class 한 필드뿐이다.
--
-- 세 갈래 근거:
--   사건·인물 기록: jxj74cyd(악동뮤지션 K팝스타2 우승) · pgzgkx58(슈퍼스타K3 울랄라세션
--     우승) · 2jaw8rkp(아이러브스쿨 신드롬) · nsf5c2gn(트럭 시위)
--   게임 고유명사: 56e4yxbk(검은 마법사) · e8ferq5u(리부트 서버) · dkaaam5p(핑크빈)
--     — 전부 메이플스토리 용어
--   곡·실존 인물: kkz7run4(보아 - No.1, 2002년 발매곡) · vkb5ctmz(따효니, 실존 스트리머)

begin;

update public.memes
set doc_class = 'event'
where short_id in (
  'jxj74cyd', 'kkz7run4', 'pgzgkx58', '2jaw8rkp', '56e4yxbk',
  'e8ferq5u', 'dkaaam5p', 'nsf5c2gn', 'vkb5ctmz'
);

-- 적용 확인: 9행이어야 한다.
-- select short_id, title, doc_class from public.memes
--   where short_id in (
--     'jxj74cyd', 'kkz7run4', 'pgzgkx58', '2jaw8rkp', '56e4yxbk',
--     'e8ferq5u', 'dkaaam5p', 'nsf5c2gn', 'vkb5ctmz'
--   );

commit;

-- ── 롤백 ────────────────────────────────────────────────
-- update public.memes
-- set doc_class = 'meme'
-- where short_id in (
--   'jxj74cyd', 'kkz7run4', 'pgzgkx58', '2jaw8rkp', '56e4yxbk',
--   'e8ferq5u', 'dkaaam5p', 'nsf5c2gn', 'vkb5ctmz'
-- );
