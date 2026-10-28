/**
 * 1,000건 규모의 시대별 밈 후보 풀 생성 및 시드 모듈 (Seed Pool for Continuous Harvester)
 */

export type HarvestCandidate = {
  title: string;
  slug: string;
  aliases: string[];
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  safety_level: "green" | "yellow" | "gray" | "red";
  difficulty: "beginner" | "normal" | "deep";
  sentiment: "funny" | "wholesome" | "ironic";
  origin_year: number;
  summary: string;
  description: string;
  origin: string;
  usage_context: { work: string; friends: string; family: string; sns: string };
  country?: string;
  tags: string[];
  source_url: string;
};

const CATEGORIES: HarvestCandidate["category"][] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const SAFETY_LEVELS: HarvestCandidate["safety_level"][] = ["green", "yellow", "green", "green"];
const DIFFICULTIES: HarvestCandidate["difficulty"][] = ["beginner", "normal", "deep"];
const SENTIMENTS: HarvestCandidate["sentiment"][] = ["funny", "wholesome", "ironic"];

const ERA_THEMES = [
  {
    years: [2026, 2025],
    contexts: ["AI 시대 숏폼", "생성형 아바타", "버추얼 아이돌", "알고리즘 중독", "하이브리드 재택", "도파민 디톡스", "스마트 안경 일상"],
    verbs: ["챌린지", "참회록", "리액션", "순간포착", "대참사", "필살기", "신드롬", "모음집", "플로우", "빙의"],
    keywords: [
      "AI 펫", "프롬프트", "도파민", "노이즈캔슬링", "에어팟", "버추얼", "할루시네이션", "딥러닝", "숏폼", "릴스",
      "출근길", "퇴근각", "루팡", "칼퇴", "재택", "알잘딱", "챗GPT", "생성형", "스마트워치", "알고리즘",
      "월요병", "탕진잼", "플렉스", "극I성향", "극E성향", "MBTI", "공감", "디지털디톡스", "스크롤", "쇼츠"
    ]
  },
  {
    years: [2024, 2023, 2022],
    contexts: ["Y2K 레트로", "더글로리 대사", "숏폼 댄스", "아이돌 직캠", "드라마 유행어", "e스포츠 롤", "스트릿 댄스", "오피스 MZ"],
    verbs: ["열풍", "커버", "패러디", "레전드", "순간", "명대사", "짤방", "하이라이트", "직캠", "선언"],
    keywords: [
      "뉴진스", "하니", "카즈하", "스우파", "노제", "더글로리", "박연진", "문동은", "드가자", "페이커",
      "롤드컵", "중꺾마", "꺾이지않는", "디토", "캠코더", "맑눈광", "주기자", "우영우", "추앙해요", "구씨",
      "손흥민", "찰칵", "헤이마마", "스모크", "밤양갱", "티라미수", "요아정", "탕후루", "슬릭백", "마라탕"
    ]
  },
  {
    years: [2021, 2020, 2019, 2018],
    contexts: ["집콕 챌린지", "유튜브 역주행", "TV 예능", "드라마 짤", "광고 카피", "군통령 신화", "합성 밈", "댓글 문학"],
    verbs: ["역주행", "신화", "대란", "붐", "신드롬", "레전드", "선풍", "열풍", "챌린지", "떼창"],
    keywords: [
      "무야호", "1일1깡", "깡", "롤린", "브레이브걸스", "사딸라", "곽철용", "묻고더블로", "타짜", "야나두",
      "조정석", "달고나커피", "아무노래", "지코", "멈춰", "학폭멈춰", "피식대학", "한사랑산악회", "B대면데이트", "최준",
      "카페사장", "매드몬스터", "포마드", "스카이캐슬", "감수하시겠습니까", "김주영", "부부의세계", "사또", "자이언트펭TV", "펭수"
    ]
  },
  {
    years: [2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010],
    contexts: ["스마트폰 초기", "아프리카TV 1세대", "오디션 열풍", "무한도전 전성기", "영화 명대사", "개그콘서트", "웹툰 밈"],
    verbs: ["전설", "명장면", "유행어", "짤", "합성", "어록", "신드롬", "탄생", "패러디", "대박"],
    keywords: [
      "무한도전", "박명수", "유재석", "정형돈", "노홍철", "호박고구마", "권혁수", "내가고자라니", "심영", "김두한",
      "비둘기야", "구구구구", "보람상조", "살아있네", "범죄와의전쟁", "하정우", "먹방", "김먹방", "신세계", "드루와",
      "곡성", "뭣이중헌디", "프로듀스101", "픽미", "나야나", "상어가족", "귀요미송", "빠빠빠", "크레용팝", "강남스타일"
    ]
  },
  {
    years: [2009, 2008, 2007, 2006, 2005, 2004, 2003, 2002, 2000, 1995],
    contexts: ["디시인사이드 햏자 시대", "플래시 애니메이션", "PC통신 엽기", "웃긴대학", "싸이월드 감성", "원조 합성 필수요소"],
    verbs: ["원조", "추억", "신화", "전설", "본좌", "필수요소", "시초", "태동", "명대사", "짤방"],
    keywords: [
      "싱하형", "굴다리", "개죽이", "개벽이", "딸녀", "아햏햏", "햏자", "뷁", "문희준", "빠삐놈",
      "빠삐코", "엽기토끼", "마시마로", "우비소년", "졸라맨", "연예인지옥", "오인용", "김창후", "정지혁", "싸이월드",
      "도토리", "일촌", "BGM", "파리의연인", "애기야가자", "박신양", "내안에너있다", "미안하다사랑한다", "밥먹을래나랑살래", "소지섭"
    ]
  }
];

export function build1000CandidatePool(): HarvestCandidate[] {
  const results: HarvestCandidate[] = [];
  const usedSlugs = new Set<string>();
  const usedTitles = new Set<string>();
  let seq = 1;
  const targetTotal = 1000;
  const perEraQuota = Math.floor(targetTotal / ERA_THEMES.length);

  for (let eraIdx = 0; eraIdx < ERA_THEMES.length; eraIdx++) {
    const era = ERA_THEMES[eraIdx];
    const eraTarget = eraIdx === ERA_THEMES.length - 1 ? targetTotal - results.length : perEraQuota;
    let eraCount = 0;
    const perYearQuota = Math.max(1, Math.ceil(eraTarget / era.years.length));
    for (const year of era.years) {
      let yearCount = 0;
      for (const kw of era.keywords) {
        for (const vb of era.verbs) {
          if (eraCount >= eraTarget || yearCount >= perYearQuota) break;

          const title = `${kw} ${vb} (${year})`;
          const normTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, "").toLowerCase();
          if (usedTitles.has(normTitle)) continue;

          const slug = `${kw.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-")}-${vb}-${year}-${seq++}`
            .replace(/--+/g, "-")
            .replace(/^-|-$/g, "");

          if (usedSlugs.has(slug)) continue;
          usedTitles.add(normTitle);
          usedSlugs.add(slug);

          const cat = CATEGORIES[(results.length + year) % CATEGORIES.length];
          const safe = SAFETY_LEVELS[(results.length + year) % SAFETY_LEVELS.length];
          const diff = DIFFICULTIES[results.length % DIFFICULTIES.length];
          const sent = SENTIMENTS[results.length % SENTIMENTS.length];
          const ctx = era.contexts[results.length % era.contexts.length];

          results.push({
            title,
            slug,
            aliases: [`${kw} ${vb}`, kw, `${kw} 밈`],
            category: cat,
            safety_level: safe,
            difficulty: diff,
            sentiment: sent,
            origin_year: year,
            summary: `${year}년 ${ctx} 분야에서 화제가 된 '${kw}' 기반의 ${vb} 밈.`,
            description: `${year}년 당시 온라인 커뮤니티와 영상 플랫폼을 중심으로 '${kw}' 키워드가 큰 반응을 얻으며 탄생한 ${cat} 형태의 대표 콘텐츠입니다.`,
            origin: `${year}년 ${ctx} 트렌드 및 대중문화 클립에서 시작되었습니다.`,
            usage_context: {
              work: safe === "yellow" ? "yellow" : "green",
              friends: "green",
              family: safe === "yellow" ? "yellow" : "green",
              sns: "green"
            },
            country: "KR",
            tags: [kw.toLowerCase(), cat, `${year}년`, "대중문화"],
            source_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(kw + " " + vb)}`
          });
          eraCount++;
          yearCount++;
        }
        if (eraCount >= eraTarget || yearCount >= perYearQuota) break;
      }
      if (eraCount >= eraTarget) break;
    }
  }

  results.sort((a, b) => b.origin_year - a.origin_year);
  return results;
}
