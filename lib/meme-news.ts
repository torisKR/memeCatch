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

/**
 * 세대별 밈 활용과 디지털 소통 에티켓·안전 가이드.
 * 단순 상업 광고/제휴 링크 대신 실제 밈 문화 이해와 상황별 실전 가이드를 제공합니다.
 */
export const MEME_NEWS_BRIEFS: readonly MemeNewsBrief[] = [
  {
    id: "20s-shortform-copyright",
    audience: "20s",
    title: "숏폼 챌린지 밈 참여 시 음원 저작권과 초상권 체크",
    summary: "유행하는 댄스·오디오 챌린지에 참여할 때도 상업적 계정에서는 음원 라이선스와 타인 얼굴 노출을 주의해야 해요.",
    checklist: [
      "상업용·비즈니스 계정 음원 사용 범위 확인",
      "촬영 시 불특정 다수 얼굴 모자이크 처리",
      "공식 플랫폼 내 제공 정식 라이선스 오디오 사용",
    ],
    sourceName: "한국저작권위원회 오픈 강좌 가이드",
    sourceUrl: "https://www.copyright.or.kr",
    verifiedAt: "2026-11-02",
    tone: "safety",
  },
  {
    id: "20s-ai-meme-verification",
    audience: "20s",
    title: "AI 생성 밈과 딥페이크, 공유 전 팩트체크 기준",
    summary: "실제 발언처럼 합성된 유명인 밈이 빠르게 확산될 때는 공식 보도나 원본 영상의 진위 여부를 먼저 확인해야 해요.",
    checklist: [
      "발언 출처가 명시된 언론 보도 대조",
      "AI 생성물 워터마크·라벨 유무 확인",
      "풍자 밈일 경우 패러디 표기 명시",
    ],
    sourceName: "방송통신심의위원회 클린UGC 가이드",
    sourceUrl: "https://www.kocsc.or.kr",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "20s-creator-attribution",
    audience: "20s",
    title: "SNS 밈 큐레이션 계정의 올바른 2차 저작물 출처 표기",
    summary: "커뮤니티 밈을 가져와 카드뉴스로 만들 때는 최초 창작자의 닉네임이나 계정을 본문에 밝히는 것이 에티켓이에요.",
    checklist: [
      "최초 발원 커뮤니티 및 닉네임 표기",
      "원작자의 재업로드 금지 요청 확인",
      "영리 목적 활용 시 사전 동의 필수",
    ],
    sourceName: "밈캐치 콘텐츠 편집 원칙",
    sourceUrl: "https://catchmeme.com/editorial",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "30s-work-chat-meme",
    audience: "30s",
    title: "회사 단톡방·슬랙 밈, 보내기 전에 공개 범위 확인",
    summary: "친한 팀에서 통하던 밈도 고객·협력사가 있는 공용 채널에서는 다른 의미나 불쾌감으로 읽힐 수 있어요.",
    checklist: [
      "원본 맥락과 혐오·비하 표현 유무 확인",
      "업무 채널의 외부 참여자 확인",
      "설명이 필요한 난해한 밈은 업무 시 지양",
    ],
    sourceName: "밈캐치 사용 안전 신호 가이드",
    sourceUrl: "https://catchmeme.com/about",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "30s-ott-check",
    audience: "30s",
    title: "밈 원본 영상 보려고 OTT 결제할 때 비교 포인트",
    summary: "월 요금만 보지 말고 보고 싶은 콘텐츠의 실제 스트리밍 여부, 계정 공유 제한, 중도 해지 환불 조건을 함께 살피세요.",
    checklist: [
      "해당 밈 원작의 독점 방영 여부",
      "동시접속 및 계정 공유 제한 정책",
      "결제 수단별 해지 및 부분 환불 규정",
    ],
    sourceName: "한국소비자원 OTT 소비자정보 가이드",
    sourceUrl: "https://www.kca.go.kr",
    verifiedAt: "2026-11-02",
    tone: "money",
  },
  {
    id: "30s-cross-gen-humor",
    audience: "30s",
    title: "직장 내 세대 간 밈 소통, 공감대 넓히는 3가지 요령",
    summary: "무리하게 최신 Z세대 은어를 따라 쓰기보다 상대방이 이해할 수 있는 보편적 대중문화 밈을 활용하는 것이 자연스러워요.",
    checklist: [
      "자연스러운 맥락에서만 가볍게 사용",
      "상대방이 모를 때는 친절하게 유래 설명",
      "비하·조롱 뉘앙스의 밈은 철저히 배제",
    ],
    sourceName: "밈캐치 트렌드 리서치",
    sourceUrl: "https://catchmeme.com/explore",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "40s-family-meme-context",
    audience: "40s",
    title: "자녀가 쓰는 밈, 금지보다 원본 맥락 함께 확인하기",
    summary: "단순히 쓰지 말라고 하기보다 어디서 시작됐고 누구를 향한 표현인지 같이 확인하면 세대 간 대화가 편안해집니다.",
    checklist: [
      "원본 유튜브·쇼츠 영상 맥락 확인",
      "비하 대상이나 공격성 유무 검토",
      "공개 SNS 사용 시 개인정보 노출 방지",
    ],
    sourceName: "밈캐치 밈 사전",
    sourceUrl: "https://catchmeme.com/explore",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "40s-alpha-generation-slang",
    audience: "40s",
    title: "알파 세대 유행어(스킵비디 토일렛 등) 올바르게 이해하기",
    summary: "유튜브와 로블록스 등에서 파생된 알파 세대의 세계관 밈은 놀이 문화의 일환으로 맥락을 파악하는 것이 중요합니다.",
    checklist: [
      "콘텐츠 연령 등급과 폭력성 여부 확인",
      "게임 내 과금 유도 밈 주의",
      "또래 집단에서의 소통 언어로 존중",
    ],
    sourceName: "밈캐치 세대별 밈 아카이브",
    sourceUrl: "https://catchmeme.com/timeline",
    verifiedAt: "2026-11-02",
    tone: "culture",
  },
  {
    id: "40s-messenger-phishing-alert",
    audience: "40s",
    title: "유행 밈·이모티콘을 악용한 메신저 피싱 사칭 주의보",
    summary: "친근한 밈과 가족 말투를 흉내 내 급한 송금이나 기프트카드 구매를 요구하는 사칭 메시지를 주의하세요.",
    checklist: [
      "금전 요구 메시지는 반드시 유선 통화로 재확인",
      "출처가 불분명한 설치 링크(APK) 클릭 금지",
      "메신저 인증 배지와 공식 계정 마크 확인",
    ],
    sourceName: "경찰청 사이버수사국 예방 수칙",
    sourceUrl: "https://www.police.go.kr",
    verifiedAt: "2026-11-02",
    tone: "safety",
  },
] as const;

export function getBriefsForAudience(audience: Audience): readonly MemeNewsBrief[] {
  return MEME_NEWS_BRIEFS.filter((brief) => brief.audience === audience);
}
