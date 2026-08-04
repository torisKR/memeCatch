-- HG-008 B안: 밈이 아닌 공개 문서를 별도 taxonomy로 분리한다.
-- 층화 표본 50건 중 9건(18%)이 밈이 아니라 오디션 우승 사건·발매곡·게임 고유명사·
-- 소비자 사건·실존 스트리머였다 — 전부 moderation_status='approved'(공개 상태)이고
-- 상위 3건은 trend_score 309~335로 랭킹 최상단이다.
-- 근거: artifacts/renewal/loop-023/sample-review-synthesis.md §3
-- 결정: docs/renewal/DECISIONS.md HG-008 B (루프 047 확정) — 비공개 전환(A안) 대신
-- URL을 유지하고 화면에 정직한 라벨(「밈은 아니지만 알아야 할 사건」)만 추가한다.
-- 9건 재분류 DML은 별도 배치: artifacts/renewal/loop-048/hg008-reclass.sql

alter table public.memes
  add column if not exists doc_class text not null default 'meme'
    check (doc_class in ('meme', 'event'));

comment on column public.memes.doc_class is
  '문서 성격. meme: 모방·변형되며 퍼지는 표현 양식. event: 사건·인물·작품·게임 용어
  그 자체를 다루는 기록(밈이 아님, HG-008 B안). 판정 기준은 /editorial에 명문화.';

-- RLS 영향 없음 확인: public.memes의 공개 읽기 정책(memes_public_read)은
-- moderation_status/is_operator()/submitted_by 기준 행(row) 단위 조건이며 컬럼을
-- 열거하지 않는다. 새 컬럼은 select 대상에 자동 포함될 뿐 정책 조건에 관여하지
-- 않으므로 정책 재정의가 필요 없다.

-- 롤백: alter table public.memes drop column if exists doc_class;
