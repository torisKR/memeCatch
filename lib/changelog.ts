/**
 * 배포 체인지로그 — "새 소식" 모달의 데이터 소스.
 *
 * 사용법: 배포에 포함되는 사용자 대상 변경점을 배열 **맨 앞**에 추가한다.
 * id가 바뀌면(=새 항목) 기존 방문자에게 모달이 1회 노출되고,
 * 확인하면 localStorage(mc:changelog:last-seen)에 기록되어 다시 뜨지 않는다.
 * 첫 방문자(키 없음)에게는 최신 항목 1건만 노출한다.
 *
 * id 규칙: 배포 날짜(YYYY-MM-DD). 같은 날 2회 배포면 "YYYY-MM-DD.2"처럼 구분.
 */
export type ChangelogEntry = {
  /** 고유 id — 최신 항목이 배열 맨 앞 */
  id: string;
  /** 표시용 날짜 */
  date: string;
  /** 한 줄 제목 */
  title: string;
  /** 변경점 목록(사용자 언어로, 기능 관점) */
  items: string[];
  action?: { label: string; href: string };
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-09-05",
    date: "2026-09-05",
    title: "밈을 쓰기 전, 5가지만 확인해 보세요",
    items: [
      "SNS에 올리기 전 뜻·독자·맥락·출처·이용 조건을 살펴보는 무료 확인표를 준비했어요.",
      "복사해서 채우는 빈칸과 ‘브금’, ‘잘자 내꿈꿔’ 예시를 내 게시물에 적용해 보세요.",
      "콘텐츠 만드는 분 5명을 모집해요. 공개 가능한 상황을 글에 댓글로 남기면, 1회 무료로 표현 후보와 출처를 함께 살펴드려요.",
    ],
    action: {
      label: "무료 확인표와 참여 안내 보기",
      href: "/community/745c8c04-0ec1-4abd-bee4-3a5d41df6a77",
    },
  },
  {
    id: "2026-07-22",
    date: "2026-07-22",
    title: "댓글·공감 오픈 & 고객센터 신설",
    items: [
      "이제 밈에 댓글을 남기고 공감 표현을 누를 수 있어요 — 여러분의 밈 이야기를 들려주세요.",
      "고객센터가 생겼어요 — 버그 신고, 콘텐츠 정정 요청, 건의사항을 바로 보낼 수 있어요.",
      "보낸 문의와 운영자 답변을 고객센터에서 모아볼 수 있어요.",
      "업데이트가 배포되면 이렇게 새 소식으로 알려드려요.",
    ],
  },
];

export const LATEST_CHANGELOG_ID: string | null = CHANGELOG[0]?.id ?? null;
