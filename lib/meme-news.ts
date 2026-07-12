import type { Audience } from "@/lib/meme-commerce";

export const AUDIENCE_LABELS: Record<Audience, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
};

export type MemeNewsBrief = {
  id: string;
  audience: Audience;
  title: string;
  summary: string;
  checklist: readonly string[];
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  tone: "money" | "safety" | "culture";
};

/** lifestyle_blog의 비교·안전 체크리스트를 밈 생활에 맞게 압축한 세대별 브리핑. */
export const MEME_NEWS_BRIEFS: readonly MemeNewsBrief[] = [
  {
    id: "20s-affiliate-disclosure",
    audience: "20s",
    title: "밈 계정에 제휴 링크를 올리기 전 30초 점검",
    summary: "재미있는 게시물이어도 수수료를 받는 링크라면 광고임을 게시물 첫 화면에서 분명하게 알려야 해요.",
    checklist: ["제목이나 첫 문장에 광고 표시", "반품·쿠키 누락 조건 확인", "수익을 보장하는 표현 금지"],
    sourceName: "애드픽 쇼핑메이트 캠페인",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=a8753",
    verifiedAt: "2026-07-12",
    tone: "money",
  },
  {
    id: "20s-social-app-safety",
    audience: "20s",
    title: "친구 찾기 앱의 밈 프로필, 위치부터 잠그기",
    summary: "유행하는 밈 사진을 프로필에 써도 학교·회사·동네를 함께 드러내면 신원이 쉽게 연결될 수 있어요.",
    checklist: ["정확한 위치 권한 끄기", "SNS 아이디 자동 연결 확인", "신고·차단 메뉴 위치 확인"],
    sourceName: "교류 앱 안전 체크리스트",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=7fcba",
    verifiedAt: "2026-07-12",
    tone: "safety",
  },
  {
    id: "20s-sale-meme-check",
    audience: "20s",
    title: "세일 밈에 웃고 결제하기 전, 최종 금액 보기",
    summary: "할인율 캡처보다 실측 사이즈, 배송비, 반품비를 더하면 실제로 아끼는 금액이 보입니다.",
    checklist: ["실측표와 소재 확인", "배송비·반품비 합산", "비교 가격의 기준일 확인"],
    sourceName: "케어베어 여름 의류 캠페인",
    sourceUrl: "https://adpick.co.kr/?ac=agent",
    verifiedAt: "2026-07-12",
    tone: "money",
  },
  {
    id: "30s-work-chat-meme",
    audience: "30s",
    title: "회사 단톡방 밈, 보내기 전에 공개 범위 확인",
    summary: "친한 팀에서 통하던 밈도 고객·협력사가 있는 방에서는 다른 의미로 읽힐 수 있어요.",
    checklist: ["원본 맥락과 비하 표현 확인", "업무 채널의 외부 참여자 확인", "설명이 필요한 밈은 보내지 않기"],
    sourceName: "밈캐치 사용 안전 원칙",
    sourceUrl: "https://catchmeme.com/about",
    verifiedAt: "2026-07-13",
    tone: "culture",
  },
  {
    id: "30s-ott-check",
    audience: "30s",
    title: "밈 원본 보려고 OTT를 결제한다면",
    summary: "월요금만 보지 말고 보고 싶은 콘텐츠, 계정·기기 수, 해지·환불과 가격 변경 조건을 같이 비교하세요.",
    checklist: ["독점 콘텐츠 실제 제공 여부", "동시접속·공유 제한", "결제 주체별 해지 경로"],
    sourceName: "한국소비자원 OTT 소비자정보",
    sourceUrl: "https://www.kca.go.kr/kca/sub.do?menukey=5084&mode=view&no=1003906095",
    verifiedAt: "2026-07-12",
    tone: "money",
  },
  {
    id: "30s-car-total-cost",
    audience: "30s",
    title: "차량 밈 광고, 월 납입금보다 총비용",
    summary: "장기렌트·리스 홍보를 볼 때는 보증금과 만기 인수금, 중도해지 비용을 같은 조건으로 맞춰야 합니다.",
    checklist: ["총 납입액 계산", "약정거리·보험 범위", "중도해지·반납 비용"],
    sourceName: "장기렌트·리스 비교 캠페인",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=f82c7",
    verifiedAt: "2026-07-12",
    tone: "money",
  },
  {
    id: "40s-family-meme-context",
    audience: "40s",
    title: "자녀가 쓰는 밈, 금지보다 원본 맥락 확인",
    summary: "뜻만 묻기보다 어디에서 시작됐고 누구를 향한 표현인지 같이 보면 대화가 짧고 정확해집니다.",
    checklist: ["원본 영상·발언 확인", "비하 대상과 사용 안전도 확인", "공개 계정 사용 여부 점검"],
    sourceName: "밈캐치 밈 사전",
    sourceUrl: "https://catchmeme.com/explore",
    verifiedAt: "2026-07-13",
    tone: "culture",
  },
  {
    id: "40s-study-benefit-dates",
    audience: "40s",
    title: "온라인 강의 무료혜택, 날짜 3개만 먼저 적기",
    summary: "가입 기간, 혜택 지급일, 쿠폰 사용기한이 학습 일정과 맞지 않으면 무료 혜택도 쓰기 어렵습니다.",
    checklist: ["가입 가능 기간", "혜택 지급 조건과 날짜", "쿠폰·자료 사용 마감일"],
    sourceName: "온라인 강의 가입 캠페인",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=90a44",
    verifiedAt: "2026-07-12",
    tone: "money",
  },
  {
    id: "40s-chat-app-boundary",
    audience: "40s",
    title: "숏폼에서 본 채팅 앱, 결제·만남 경계 세우기",
    summary: "앱 설치 전 프로필 공개 범위와 자동결제, 신고·차단 기능을 확인하면 불필요한 위험을 줄일 수 있습니다.",
    checklist: ["자동결제와 환불 조건", "연락처·위치 노출 범위", "오프라인 만남은 공개 장소에서"],
    sourceName: "채팅 앱 안전 체크리스트",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=03074",
    verifiedAt: "2026-07-12",
    tone: "safety",
  },
] as const;

export function getBriefsForAudience(audience: Audience): readonly MemeNewsBrief[] {
  return MEME_NEWS_BRIEFS.filter((brief) => brief.audience === audience);
}
