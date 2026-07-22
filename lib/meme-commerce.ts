export type Audience = "20s" | "30s" | "40s";

export type MemeProduct = {
  id: string;
  title: string;
  description: string;
  category: "크리에이터" | "교류 앱" | "패션" | "차량" | "학습";
  audiences: Audience[];
  provider: "adpick";
  status: "approved";
  destinationUrl: string;
  sourceUrl: string;
  disclosure: string;
  approvedAt: string;
  expiresAt: string;
};

const ALLOWED_ADPICK_DOMAINS = ["adpick.co.kr", "deg.kr", "bitl.bz"] as const;

/**
 * lifestyle_blog의 공개 Adpick 캠페인 설정과 비교 글 메타데이터를 가져온다.
 * 비밀번호·정산 데이터·API 키는 포함하지 않고 공개 제휴 링크만 보관한다.
 *
 * 재검증: 2026-07-22 — 오퍼 페이지(adpick.co.kr/?ac=offer) 전수 응답 확인으로
 * 11개 캠페인 전부 진행 중임을 확인하고 검증 창(approvedAt→expiresAt 7일)을 갱신.
 * 만료가 다가오면 같은 방식으로 오퍼 생존을 확인한 뒤 날짜만 갱신하면 된다.
 */
export const MEME_PRODUCTS: readonly MemeProduct[] = [
  {
    id: "adpick-shoppingmate-signup",
    title: "애드픽 쇼핑메이트 시작 전 수익·광고표시 체크리스트",
    description: "상품 링크를 공유하기 전에 커미션 조건, 반품·쿠키 누락, 광고 표시, 콘텐츠 비용과 출금 기준을 확인합니다.",
    category: "크리에이터",
    audiences: ["20s", "30s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/15ddff1",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=a8753",
    disclosure: "광고: 이 링크를 통해 가입하면 운영자가 수수료를 받을 수 있으며, 가입자의 수익은 보장되지 않습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "amasia-friend-app",
    title: "가까운 인연·국제 교류 앱 설치 전 안전 점검",
    description: "연령, 위치 노출, 결제, 개인정보와 오프라인 만남 안전을 먼저 확인하는 가이드입니다.",
    category: "교류 앱",
    audiences: ["20s", "30s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/363db5f",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=7fcba",
    disclosure: "광고: 만 18세 이상 이용자가 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "carebear-summer-fashion",
    title: "케어베어 여름 의류 세일, 결제 전 확인할 7가지",
    description: "실측 사이즈, 소재, 배송비, 반품비와 최종 결제금액을 할인율보다 먼저 확인합니다.",
    category: "패션",
    audiences: ["20s", "30s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://bitl.bz/uO18Zh",
    sourceUrl: "https://adpick.co.kr/?ac=agent",
    disclosure: "광고: 이 링크를 통해 상품을 구매하면 운영자가 구매금액의 일부를 수수료로 제공받습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "chago-long-term-rental",
    title: "첫 차 장기렌트·리스 비교 전 확인할 8가지",
    description: "보증금, 약정거리, 보험, 중도해지와 반납 비용을 같은 조건으로 비교하는 체크리스트입니다.",
    category: "차량",
    audiences: ["30s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/3eb76b9",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=f82c7",
    disclosure: "광고: 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있으며, 절감액이나 계약 조건을 보장하지 않습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "daesung-grade12-signup",
    title: "고1·2 온라인 강의 가입 혜택 확인 체크리스트",
    description: "대상 학년, 신규회원 기준, 쿠폰 사용기한과 실제 학습 계획을 먼저 확인합니다.",
    category: "학습",
    audiences: ["40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/43e005a",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=90a44",
    disclosure: "광고: 이 링크를 통해 캠페인 페이지를 방문하면 운영자가 수수료를 받을 수 있습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "daytalk-friend-app",
    title: "채팅 앱 시작 전 프로필·결제·만남 안전 체크리스트",
    description: "프로필 노출, 위치 권한, 인앱 결제, 신고·차단과 오프라인 만남 기준을 확인합니다.",
    category: "교류 앱",
    audiences: ["20s", "30s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/2e86da6",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=03074",
    disclosure: "광고: 만 18세 이상 이용자가 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "dokit-friend-app",
    title: "일본 친구 채팅 앱 설치 전 안전 기준 7가지",
    description: "번역 의존도, 프로필 공개, 결제 조건, 신고·차단과 만남 안전을 점검합니다.",
    category: "교류 앱",
    audiences: ["20s", "30s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/41ab716",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=a7bea",
    disclosure: "광고: 만 18세 이상 이용자가 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "gangdae-math-season1",
    title: "수학 모의고사 패키지 고르기 전 확인할 7가지",
    description: "시험 범위, 해설 방식, 학습 시간과 기존 교재 중복을 비교하는 실전 체크리스트입니다.",
    category: "학습",
    audiences: ["40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/25408ad",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=2706b",
    disclosure: "광고: 이 링크를 통해 캠페인 페이지를 방문하면 운영자가 수수료를 받을 수 있으며, 성적 결과는 보장하지 않습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "kimseungri-gyeolgyeok-sayu",
    title: "고난도 국어 강좌 결제 전 확인할 7가지",
    description: "현재 약점, 강좌 분량, 교재비, 복습 방식과 환불 조건을 먼저 비교합니다.",
    category: "학습",
    audiences: ["20s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/3e64de0",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=a20ee",
    disclosure: "광고: 이 링크를 통해 캠페인 페이지를 방문하면 운영자가 수수료를 받을 수 있으며, 수강 성과는 보장하지 않습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "kmate-friend-app",
    title: "외국인 친구 앱 개인정보·언어교환 체크리스트",
    description: "교류 목적, 프로필 공개 범위, 번역 기능, 신고·차단과 오프라인 만남 안전을 확인합니다.",
    category: "교류 앱",
    audiences: ["20s", "30s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/712595a",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=f937d",
    disclosure: "광고: 만 18세 이상 이용자가 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
  {
    id: "truckdoctor-truck-lease",
    title: "1톤 트럭 리스 전 계산할 8가지",
    description: "차량 용도, 매출 변동, 보험·정비·유류비, 중도해지와 출고 조건을 먼저 계산합니다.",
    category: "차량",
    audiences: ["30s", "40s"],
    provider: "adpick",
    status: "approved",
    destinationUrl: "https://deg.kr/6db9794",
    sourceUrl: "https://adpick.co.kr/?ac=offer&offer=e4cb7",
    disclosure: "광고: 이 링크를 통해 앱을 설치하면 운영자가 수수료를 받을 수 있으며, 차량 가격이나 출고 일정은 보장하지 않습니다.",
    approvedAt: "2026-07-22",
    expiresAt: "2026-07-29",
  },
] as const;

function hostnameAllowed(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return ALLOWED_ADPICK_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function dateInSeoul(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isMemeProductActive(product: MemeProduct, now = new Date()): boolean {
  return (
    product.status === "approved" &&
    hostnameAllowed(product.destinationUrl) &&
    product.approvedAt <= dateInSeoul(now) &&
    product.expiresAt >= dateInSeoul(now)
  );
}

export function validateMemeProducts(products: readonly MemeProduct[] = MEME_PRODUCTS): void {
  const ids = new Set<string>();
  for (const product of products) {
    if (ids.has(product.id)) throw new Error(`중복된 밈 상품 ID: ${product.id}`);
    ids.add(product.id);
    if (!hostnameAllowed(product.destinationUrl)) {
      throw new Error(`허용되지 않은 Adpick 링크: ${product.destinationUrl}`);
    }
    if (new URL(product.destinationUrl).protocol !== "https:") {
      throw new Error(`HTTPS가 아닌 Adpick 링크: ${product.destinationUrl}`);
    }
    if (product.approvedAt > product.expiresAt) {
      throw new Error(`승인일보다 만료일이 빠른 밈 상품: ${product.id}`);
    }
  }
}

validateMemeProducts();
