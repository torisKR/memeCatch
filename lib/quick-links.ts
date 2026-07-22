/**
 * 탐색 퀵링크(추천 컬렉션) 단일 소스 — 홈 카테고리 벤토와 /explore 추천
 * 컬렉션 스트립이 공유한다. href는 전부 실제 동작하는 /explore 필터 쿼리만
 * 사용한다(app/explore/page.tsx parseFilters 지원 파라미터: category(다중)·
 * difficulty·lifecycle·media·year(2000s/2010s/2020s)·platform·sort).
 * 백엔드가 지원하지 않는 조건(안전도 필터 등)은 만들지 않는다.
 */
export type QuickLink = {
  key: string;
  title: string;
  description: string;
  href: string;
  /** 벤토 강조 타일(2칸 폭) 여부 */
  featured?: boolean;
};

export const EXPLORE_QUICK_LINKS: QuickLink[] = [
  {
    key: "rising",
    title: "지금 급상승",
    description: "트렌드 점수가 뛰는 밈",
    href: "/explore?lifecycle=rising",
    featured: true,
  },
  {
    key: "recent",
    title: "이번 주 새로 등장",
    description: "가장 최근 등록된 순서로",
    href: "/explore?sort=recent",
  },
  {
    key: "beginner",
    title: "밈알못 입문 코스",
    description: "입문 난이도만 골라 보기",
    href: "/explore?difficulty=beginner",
  },
  {
    key: "comment",
    title: "댓글에서 자주 보이는 표현",
    description: "댓글 밈만 모아 보기",
    href: "/explore?category=comment",
  },
  {
    key: "2000s",
    title: "2000년대 추억 소환",
    description: "싸이월드 시절의 그 밈",
    href: "/explore?year=2000s",
  },
  {
    key: "song-challenge",
    title: "노래·챌린지",
    description: "밈송과 챌린지 모아 보기",
    href: "/explore?category=song&category=challenge",
  },
  {
    key: "youtube",
    title: "원본 영상이 확인된 밈",
    description: "유튜브 원본과 함께 보기",
    href: "/explore?platform=youtube",
    featured: true,
  },
  {
    key: "controversial",
    title: "지금 논쟁 중",
    description: "쓰기 전에 맥락 확인 필수",
    href: "/explore?sort=controversial",
  },
];
