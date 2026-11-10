export type EditorialOriginal = {
  slug: string;
  title: string;
  caption: string;
  summary: string;
  situation: string;
  alternateCaption: string;
  image: string;
  imageAlt: string;
};

export const EDITORIAL_ORIGINALS: readonly EditorialOriginal[] = [
  {
    slug: "monday-loading",
    title: "월요일, 아직 로딩 중",
    caption: "출근은 했는데 영혼은 아직 로딩 중",
    summary: "월요일 아침, 커피보다 먼저 도착한 일들 앞에서 잠시 멈춘 귤 친구.",
    situation: "주말이 끝났다는 사실을 머리보다 몸이 늦게 받아들이는 순간에 어울려요.",
    alternateCaption: "몸은 회의실에, 마음은 일요일에",
    image: "/images/originals/monday-loading.png",
    imageAlt: "서류가 쌓인 책상에서 커피를 든 채 지친 귤색 캐릭터",
  },
  {
    slug: "five-minutes-to-go",
    title: "퇴근 5분 전",
    caption: "손은 일하는 중, 마음은 이미 현관",
    summary: "아무렇지 않은 척 시계를 보지만 가방은 벌써 준비된 귤 친구.",
    situation: "집에 갈 시간이 가까워질수록 시계를 자꾸 확인하게 될 때 써 보세요.",
    alternateCaption: "퇴근 버튼은 어디에 있나요",
    image: "/images/originals/five-minutes-to-go.png",
    imageAlt: "가방을 챙기고 시계를 살피는 귤색 캐릭터",
  },
  {
    slug: "late-night-meeting",
    title: "야식 회의",
    caption: "분명 배 안 고팠는데 메뉴는 다 정했다",
    summary: "휴대폰을 보다가 야식 생각과 진지한 회의에 들어간 귤 친구.",
    situation: "잠들기 전 메뉴를 구경하다가 어느새 주문을 고민하는 밤을 담았어요.",
    alternateCaption: "검색만 한다고 했지 주문 안 한다고는 안 했다",
    image: "/images/originals/late-night-meeting.png",
    imageAlt: "밤에 휴대폰을 보며 간식을 상상하는 귤색 캐릭터",
  },
];

export function getEditorialOriginal(slug: string): EditorialOriginal | null {
  return EDITORIAL_ORIGINALS.find((edition) => edition.slug === slug) ?? null;
}

export function nextEditorialOriginal(slug: string): EditorialOriginal {
  const index = EDITORIAL_ORIGINALS.findIndex((edition) => edition.slug === slug);
  const next = index < 0 ? 0 : (index + 1) % EDITORIAL_ORIGINALS.length;
  return EDITORIAL_ORIGINALS[next] ?? EDITORIAL_ORIGINALS[0];
}

export function editorialOriginalPath(slug: string): string {
  return `/originals/edition/${slug}`;
}
