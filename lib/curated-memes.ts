import { passesContentIndexGate, type ContentDepthInput } from "@/lib/content-depth";
import type { MemeCategory, SafetyLevel, LifecycleStatus } from "@/lib/labels";
import { getSeoCopy, type SeoRouteLocale } from "@/lib/i18n-routing";
import type { HomeEntry } from "@/components/home/home-experience";
import { memePathFrom } from "@/lib/labels";
import { generateHouseMemeCardDataUrl } from "@/lib/meme-generator/image-generator";

export type CuratedMeme = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  category: MemeCategory;
  safety_level: SafetyLevel;
  lifecycle_status: LifecycleStatus;
  origin_year: number;
  usage_context: {
    friends: SafetyLevel;
    work: SafetyLevel;
    sns: SafetyLevel;
  };
  usage_examples: Array<{
    context: string;
    description?: string;
    dialogue: Array<{ speaker: string; line: string }>;
  }>;
  trend_now: {
    status_label: string;
    analysis: string;
  };
  caution: string | null;
  tags: string[];
};

export const CURATED_CORE_MEMES: readonly CuratedMeme[] = [
  {
    id: "curated-jung-kkuk-ma",
    short_id: "jkm2022k",
    slug: "jung-kkuk-ma",
    title: "중요한 건 꺾이지 않는 마음 (중꺾마)",
    summary: "어떤 역경과 실패에도 끝까지 포기하지 않고 도전하는 굳은 의지를 격려할 때 쓰는 대표적인 긍정 밈.",
    description: "2022년 리그 오브 레전드 월드 챔피언십(롤드컵)에서 DRX 소속 데프트(Deft) 선수의 극적인 우승 서사와 함께 유행한 문구입니다. 스포츠, 취업 준비, 스타트업, 일상 등 모든 도전 과제에서 희망과 의지를 북돋는 데 사용됩니다.",
    origin: "2022년 롤드컵 조별리그 1라운드 로그전 패배 후 쿠키뉴스 문대찬 기자가 작성한 인터뷰 기사 제목에서 최초 유래했습니다.",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    origin_year: 2022,
    usage_context: {
      friends: "green",
      work: "green",
      sns: "green",
    },
    usage_examples: [
      {
        context: "친구와의 대화 (취업 준비)",
        dialogue: [
          { speaker: "지훈", line: "이번 하반기 공채 서류 또 다 떨어졌어… 진짜 막막하다." },
          { speaker: "민수", line: "야, 아직 11월이야. 중요한 건 꺾이지 않는 마음인 거 알지? 포기만 안 하면 된다!" },
        ],
      },
      {
        context: "회사 슬랙 (프로젝트 배포 난관)",
        dialogue: [
          { speaker: "팀원", line: "빌드 오류가 계속 잡히지 않네요. 오늘 안에 해결할 수 있을지 걱정입니다." },
          { speaker: "팀장", line: "원인 하나씩 디버깅해 봅시다. 중꺾마 정신으로 차근차근 풀면 금방 끝납니다." },
        ],
      },
      {
        context: "SNS 댓글 (운동 루틴 인증)",
        dialogue: [
          { speaker: "작성자", line: "오늘 비 오지만 헬스장 출석 완료!" },
          { speaker: "팔로워", line: "비 와도 나가는 중꺾마 리스펙합니다 🔥" },
        ],
      },
    ],
    trend_now: {
      status_label: "사회적 명언으로 정착 (클래식)",
      analysis: "단순 인터넷 유행어를 넘어 지상파 뉴스, 대기업 사내 캠페인, 국가대표 인터뷰에서도 공식적으로 인용되는 현대 관용어로 자리 잡았습니다.",
    },
    caution: "공식적인 대외 계약서나 엄격한 비즈니스 제안서 등 초격식 문서에는 '굳은 의지' 등으로 순화하는 것이 바람직합니다.",
    tags: ["롤드컵", "데프트", "동기부여", "응원", "직장인가능"],
  },
  {
    id: "curated-form-crazy",
    short_id: "fmc2022k",
    slug: "form-crazy",
    title: "폼 미쳤다",
    summary: "특정인의 뛰어난 역량, 센스 넘치는 퍼포먼스, 혹은 음식·작품의 대단한 퀄리티를 극찬할 때 쓰는 감탄 표현.",
    description: "스포츠 선수의 컨디션('폼')이 절정에 달했을 때 쓰이던 축구 커뮤니티 은어에서 출발해, 현재는 패션, 디자인, 업무 성과 등 다방면에서 대단함을 찬양하는 국민 칭찬 밈으로 확장되었습니다.",
    origin: "인터넷 방송인 및 해외 축구 갤러리에서 활약하는 선수를 향해 외치던 칭찬 어구에서 비롯되었습니다.",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    origin_year: 2022,
    usage_context: {
      friends: "green",
      work: "yellow",
      sns: "green",
    },
    usage_examples: [
      {
        context: "친구와의 대화 (새 옷 착용)",
        dialogue: [
          { speaker: "수진", line: "오늘 코디 어때? 새로 산 재킷인데." },
          { speaker: "유진", line: "와 대박… 오늘 핏이랑 폼 미쳤다 진짜 잘 어울려!" },
        ],
      },
      {
        context: "회사 메신저 (디자인 결과물 공유)",
        dialogue: [
          { speaker: "디자이너", line: "새 랜딩 페이지 3D 에셋 렌더링 완료본 공유드립니다." },
          { speaker: "기획자", line: "와 퀄리티 폼 미쳤네요! 바로 개발팀에 넘겨도 되겠습니다." },
        ],
      },
    ],
    trend_now: {
      status_label: "일상 칭찬어로 대중화",
      analysis: "10대부터 30대까지 캐주얼 대화에서 가장 자주 쓰이는 긍정 감탄사입니다.",
    },
    caution: "임원 보고나 격식 있는 발표 자리에서는 '탁월한 역량', '압도적인 완성도' 등으로 대체해 주세요.",
    tags: ["칭찬", "감탄사", "축구", "일상"],
  },
  {
    id: "curated-ohiryeo-joha",
    short_id: "oyj2021k",
    slug: "ohiryeo-joha",
    title: "오히려 좋아",
    summary: "예상치 못한 불운이나 계획의 어긋남을 긍정적인 반전 기회로 유쾌하게 받아들이는 마인드셋 밈.",
    description: "약속이 취소되거나 버스를 놓치는 등 낭패를 겪었을 때, 낙담하는 대신 '오히려 다른 여유가 생겼으니 더 잘됐다'며 스트레스를 해소하고 분위기를 반전시키는 멘탈 관리 표현입니다.",
    origin: "트위치 및 유튜브 스트리머들의 방송에서 돌발 상황을 유머러스하게 극복하며 자주 사용하면서 전국적으로 유행했습니다.",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    origin_year: 2021,
    usage_context: {
      friends: "green",
      work: "green",
      sns: "green",
    },
    usage_examples: [
      {
        context: "친구와의 약속 (식당 웨이팅 실패)",
        dialogue: [
          { speaker: "민호", line: "가려던 파스타집 오늘 휴무래… 어떡하냐?" },
          { speaker: "준수", line: "오히려 좋아! 옆 골목에 새로 생긴 라멘 맛집 가보자." },
        ],
      },
      {
        context: "회사 슬랙 (회의 일정 연기)",
        dialogue: [
          { speaker: "동료", line: "오후 2시 기획 회의가 내일로 밀렸대요." },
          { speaker: "나", line: "오히려 좋네요! 오전 보고서 여유 있게 다듬을 시간 벌었습니다." },
        ],
      },
    ],
    trend_now: {
      status_label: "스테디셀러 긍정 관용구",
      analysis: "위기 극복 유머로 직장 동료 간에도 부담 없이 통용되는 대표적인 무해한 밈입니다.",
    },
    caution: "심각한 사고나 타인의 큰 슬픔/손해 상황에서 쓰면 공감 능력 결여로 오해받을 수 있습니다.",
    tags: ["긍정", "멘탈케어", "직장가능", "무해한밈"],
  },
  {
    id: "curated-ne-mwo-dwae",
    short_id: "nmd2022k",
    slug: "ne-mwo-dwae",
    title: "너 뭐 돼?",
    summary: "분수에 넘치게 거들먹거리거나 잘난 척하는 상대를 향해 날리는 날카로운 조롱 및 반박 표현.",
    description: "상대방의 오만함이나 과도한 간섭을 단칼에 무안하게 만드는 강력한 비격식 반문입니다. 친밀도가 매우 높은 친구 간 장난이 아니면 즉각적인 갈등과 싸움을 유발합니다.",
    origin: "유튜브 크리에이터 겸 댄서 가비(Gabee)가 웹 예능 등에서 특유의 제스처와 함께 사용하여 선풍적인 인기를 끌었습니다.",
    category: "phrase",
    safety_level: "red",
    lifecycle_status: "active",
    origin_year: 2022,
    usage_context: {
      friends: "yellow",
      work: "red",
      sns: "red",
    },
    usage_examples: [
      {
        context: "절친 간의 가벼운 장난",
        dialogue: [
          { speaker: "친구", line: "내가 오늘 너한테 커피 한 잔 특별히 사줄 기회를 하사하마." },
          { speaker: "나", line: "웃겨 진짜, 너 뭐 돼? ㅋㅋㅋ" },
        ],
      },
      {
        context: "직장/공식 석상 (사용 금지)",
        dialogue: [
          { speaker: "팀원", line: "선배님, 그 기획 방식은 좀 올드한 것 같습니다." },
          { speaker: "선배", line: "(속마음: '너 뭐 돼?'라고 하고 싶지만 엄격히 금기어이므로 차분히 피드백)" },
        ],
      },
    ],
    trend_now: {
      status_label: "고위험 어휘로 정착",
      analysis: "밈 자체의 파급력은 여전하지만, 공격성이 높아 대화 상대를 극도로 가려야 합니다.",
    },
    caution: "직장, 학교 선후배, 초면인 사람, 비즈니스 파트너에게 사용 시 심각한 인성 논란과 징계 사유가 될 수 있습니다.",
    tags: ["주의필요", "공격성", "직장절대금지", "조롱"],
  },
  {
    id: "curated-mal-noon-gwang",
    short_id: "mng2022k",
    slug: "mal-noon-gwang",
    title: "맑은 눈의 광인 (맑눈광)",
    summary: "겉으로는 순진하고 맑은 눈빛을 띠고 있으나, 속으로는 예측 불가능한 집착과 광기를 품은 인물을 지칭하는 밈.",
    description: "SNL 코리아 'MZ오피스'의 김아영 캐릭터를 통해 대중화된 신조어입니다. 조용하고 예의 바르게 행동하면서도 에어팟을 끼고 일하거나 엉뚱한 고집을 꺾지 않는 특유의 현대적 사회 초년생 유형을 풍자할 때 자주 쓰입니다.",
    origin: "웹툰 '마음의 소리' 등 인터넷 커뮤니티에서 순진무구한 눈망울 속에 소시오패스적 면모를 숨긴 캐릭터들을 묘사하던 데서 유래했습니다.",
    category: "phrase",
    safety_level: "yellow",
    lifecycle_status: "active",
    origin_year: 2022,
    usage_context: {
      friends: "green",
      work: "yellow",
      sns: "green",
    },
    usage_examples: [
      {
        context: "친구들 간의 인물 묘사",
        dialogue: [
          { speaker: "수아", line: "영희 걔 평소엔 조용한데, 노래방 가면 눈빛 돌변하더라?" },
          { speaker: "민경", line: "진짜 전형적인 맑은 눈의 광인이라니까 ㅋㅋㅋ" },
        ],
      },
      {
        context: "사내 티타임 (가벼운 농담)",
        dialogue: [
          { speaker: "선배", line: "신입사원 김 프로님, 오늘 야근 안 하겠다고 칼퇴 선언하고 나가셨어요." },
          { speaker: "동기", line: "와… 미소 지으면서 또박또박 말하는데 맑눈광 포스 제대로네요." },
        ],
      },
    ],
    trend_now: {
      status_label: "유형 분석 대명사로 활발히 사용",
      analysis: "예능 및 직장 생활 관찰 콘텐츠에서 고유 명사처럼 굳어졌습니다.",
    },
    caution: "당사자가 면전에서 들었을 때 '이상한 사람'으로 낙인찍힌다고 느껴 불쾌해할 수 있으므로 공식 평가 자리에서는 지양하세요.",
    tags: ["MZ오피스", "캐릭터", "풍자", "성향분석"],
  },
  {
    id: "curated-bun-jo-ka",
    short_id: "bjk2021k",
    slug: "bun-jo-ka",
    title: "분좋카 (분위기 좋은 카페)",
    summary: "감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.",
    description: "인스타그램 릴스 및 블로그 맛집 리뷰에서 데이트 코스나 힐링 스팟을 추천할 때 대표적으로 쓰이는 편안한 축약어입니다.",
    origin: "인스타그램 감성 카페 투어 트렌드와 함께 2021년경부터 널리 확산된 줄임말입니다.",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    origin_year: 2021,
    usage_context: {
      friends: "green",
      work: "green",
      sns: "green",
    },
    usage_examples: [
      {
        context: "주말 약속 장소 선정",
        dialogue: [
          { speaker: "지민", line: "이번 주 토요일에 성수동 가기로 했잖아, 어디 갈래?" },
          { speaker: "서연", line: "내가 성수역 3번 출구 근처에 분좋카 하나 알아뒀어. 거기서 커피 마시자!" },
        ],
      },
    ],
    trend_now: {
      status_label: "표준 생활 어휘로 안착",
      analysis: "지도 앱 검색어나 카페 마케팅 태그로 공식 채택될 만큼 대중화되었습니다.",
    },
    caution: "상대방에게 전혀 부정적인 영향을 주지 않는 100% 무해한 표현입니다.",
    tags: ["카페", "성수동", "일상", "줄임말"],
  },
  {
    id: "curated-hidink-hungry",
    short_id: "gnact78h",
    slug: "hidink-hungry",
    title: "히딩크 '나는 아직 배가 고프다'",
    summary: "큰 성과나 목표를 달성한 뒤에도 결코 자만하지 않고 더 큰 성취를 향해 나아가겠다는 프로페셔널한 명언 밈.",
    description: "2002 한일 월드컵 16강 진출 확정 직후, 거스 히딩크 감독이 기자회견에서 남긴 역사적인 발언(I'm still hungry)입니다. 현재도 시험 통과, 매출 목표 달성, 추가 도전 시 겸손과 열정을 동시에 보여주는 긍정적 표현으로 널리 인용됩니다.",
    origin: "2002년 6월 14일, 포르투갈전 승리로 대한민국 축구 역사상 최초의 16강 진출을 이룬 후 히딩크 감독의 인터뷰 공식 기자회견.",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "archived",
    origin_year: 2002,
    usage_context: {
      friends: "green",
      work: "green",
      sns: "green",
    },
    usage_examples: [
      {
        context: "업무 분기 목표 초과 달성 후",
        dialogue: [
          { speaker: "팀장", line: "이번 3분기 KPI 120% 조기 달성했습니다. 고생 많으셨습니다!" },
          { speaker: "이사", line: "축하합니다. 하지만 히딩크 감독 말처럼 우리는 아직 배가 고픕니다. 4분기 신시장도 공략해 봅시다." },
        ],
      },
    ],
    trend_now: {
      status_label: "국민 명언 아카이브",
      analysis: "세대 불문 누구나 뜻과 맥락을 알고 공감하는 한국 현대사의 상징적 어록입니다.",
    },
    caution: "식사 직후에 문자 그대로 장난치는 개그로도 자주 쓰입니다.",
    tags: ["2002월드컵", "히딩크", "명언", "스포츠", "격식가능"],
  },
  {
    id: "curated-eok-kka",
    short_id: "okk2020k",
    slug: "eok-kka",
    title: "억까 (억지 까기)",
    summary: "정당한 이유 없이 억지로 트집을 잡아 비난하거나, 불합리할 정도로 지독한 불운이 겹칠 때 쓰는 밈.",
    description: "인터넷 게임 중 아무리 컨트롤해도 피할 수 없는 황당한 버그나 악재가 발생했을 때 '게임이 나를 억까한다'고 하거나, 연예인·인플루언서를 향한 악의적 루머에 '이건 완전 억까다'라고 반박할 때 주로 쓰입니다.",
    origin: "아프리카TV 및 트위치 게임 스트리밍 커뮤니티에서 롤(LoL) 등 대전 게임 플레이 중 탄생한 신조어입니다.",
    category: "phrase",
    safety_level: "yellow",
    lifecycle_status: "active",
    origin_year: 2020,
    usage_context: {
      friends: "green",
      work: "yellow",
      sns: "green",
    },
    usage_examples: [
      {
        context: "비 오는 날 출근길 (불운 상황)",
        dialogue: [
          { speaker: "동기", line: "오늘 우산 챙겨 나왔는데 지하철 타자마자 우산 살 부러짐…" },
          { speaker: "나", line: "아침부터 날씨랑 우산이 쌍으로 억까하네 진짜 ㅠㅠ 힘내라." },
        ],
      },
    ],
    trend_now: {
      status_label: "청년층 일상 불평어로 널리 정착",
      analysis: "반대말인 '억빠'(억지 빠돌이/무지성 칭찬)와 짝을 이뤄 활발히 소비됩니다.",
    },
    caution: "업무상 정당한 지적이나 코드 리뷰 피드백에 '억까하지 마세요'라고 응수하면 태도 불량으로 비화될 수 있습니다.",
    tags: ["게임", "스트리머", "억지비난", "주의필요"],
  },
];

/**
 * 홈 화면에 표시할 최근 밈 목록을 보장합니다.
 * DB 조회 결과가 비어 있거나 개수가 부족한 경우, 자체 검증된 고품질 큐레이션 데이터로 채워
 * 방문자와 검색엔진 봇에게 '콘텐츠가 풍부하고 살아있는 서비스'를 항상 제공합니다.
 */
export function getGuaranteedHomeEntries(
  locale: SeoRouteLocale,
  liveEntries: readonly HomeEntry[],
): readonly HomeEntry[] {
  if (liveEntries && liveEntries.length >= 4) {
    return liveEntries;
  }

  const categoryCopy = getSeoCopy(locale).categories;

  const fallbackEntries: HomeEntry[] = CURATED_CORE_MEMES.map((meme) => {
    const cardDataUrl = generateHouseMemeCardDataUrl(
      {
        title: meme.title,
        summary: meme.summary,
        category: meme.category,
        safety_level: meme.safety_level,
        usage_examples: meme.usage_examples.map((example) => ({
          situation: example.context,
          dialogue: example.dialogue,
        })),
      },
      "landscape",
      meme.safety_level === "green" ? "obsidian_coral" : "cyber_indigo",
    );

    return {
      id: meme.id,
      href: memePathFrom(meme.short_id, meme.slug),
      title: meme.title,
      summary: meme.summary,
      categoryLabel: categoryCopy[meme.category] ?? "밈 용어",
      category: meme.category,
      safetyLevel: meme.safety_level,
      year: meme.origin_year,
      artUrl: null,
      thumbnailUrl: cardDataUrl,
    };
  });

  if (liveEntries && liveEntries.length > 0) {
    const liveIds = new Set(liveEntries.map((e) => e.id));
    const uniqueFallbacks = fallbackEntries.filter((f) => !liveIds.has(f.id));
    return [...liveEntries, ...uniqueFallbacks].slice(0, 8);
  }

  return fallbackEntries.slice(0, 8);
}

const curatedByShortId = new Map(
  CURATED_CORE_MEMES.map((meme) => [meme.short_id, meme] as const),
);

/** Curated cards have no source rows, so they fail the index gate until one is recorded. */
export function curatedContentInput(meme: CuratedMeme): ContentDepthInput {
  return {
    description: meme.description,
    origin: meme.origin,
    usage_note: [
      meme.trend_now.analysis,
      ...meme.usage_examples.map((example) => example.description ?? ""),
    ].join("\n"),
    caution: meme.caution,
    usage_examples: meme.usage_examples.flatMap((example) =>
      example.dialogue.map((line) => ({ situation: example.context, text: line.line })),
    ),
    meme_sources: [],
  };
}

export function curatedPassesIndexGate(meme: CuratedMeme): boolean {
  return passesContentIndexGate(curatedContentInput(meme));
}

export function findCuratedCoreMeme(shortId: string): CuratedMeme | null {
  return curatedByShortId.get(shortId) ?? null;
}

export function curatedMemesMatchingQuery(query: string): readonly CuratedMeme[] {
  const needle = query.normalize("NFC").trim().toLocaleLowerCase("ko-KR");
  if (!needle) return [];
  return CURATED_CORE_MEMES.filter((meme) =>
    [meme.title, meme.summary, meme.slug, ...meme.tags]
      .join("\n")
      .normalize("NFC")
      .toLocaleLowerCase("ko-KR")
      .includes(needle),
  );
}

export function curatedSearchCards(query: string) {
  return curatedMemesMatchingQuery(query).map((meme) => ({
    id: meme.id,
    short_id: meme.short_id,
    slug: meme.slug,
    title: meme.title,
    summary: meme.summary,
    category: meme.category,
    safety_level: meme.safety_level,
    lifecycle_status: meme.lifecycle_status,
    media_type: "image" as const,
    origin_year: meme.origin_year,
    trend_score: 100,
    meme_contents: [
      {
        thumbnail_url: generateHouseMemeCardDataUrl(
          {
            title: meme.title,
            summary: meme.summary,
            category: meme.category,
            safety_level: meme.safety_level,
            usage_examples: meme.usage_examples.map((example) => ({
              situation: example.context,
              dialogue: example.dialogue,
            })),
          },
          "square",
          "obsidian_coral",
        ),
        is_representative: true as const,
      },
    ],
  }));
}
