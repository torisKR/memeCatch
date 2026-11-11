/**
 * 밈캐치 독립형 자체 밈 카드 및 이미지 렌더링 엔진.
 * 외부 SNS 썸네일이나 외부 호스팅 이미지에 의존하지 않고,
 * 순수 코드(SVG / Canvas) 기반으로 고해상도 그래픽 아티팩트를 자체 렌더링합니다.
 */

import type { GeneratedHouseMeme } from "./data-generator";

export type CardTheme = "obsidian_coral" | "cyber_indigo" | "minimal_clean";

export type CardDimensions = {
  width: number;
  height: number;
};

export const CARD_PRESETS = {
  square: { width: 1080, height: 1080, label: "정사각형 카드 (1080×1080)" },
  landscape: { width: 1200, height: 630, label: "오픈그래프 / 가로형 (1200×630)" },
} as const;

export type CardPreset = keyof typeof CARD_PRESETS;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 밈 데이터를 바탕으로 외부 의존성 없는 고해상도 자체 밈 카드 SVG를 생성합니다.
 * 서버/클라이언트 어디서든 렌더링 가능하며, data:image/svg+xml 형태로 즉시 표시할 수 있습니다.
 */
export function generateHouseMemeCardSvg(
  meme: Pick<GeneratedHouseMeme, "title" | "summary" | "category" | "safety_level" | "usage_examples">,
  preset: CardPreset = "square",
  theme: CardTheme = "obsidian_coral",
): string {
  const { width, height } = CARD_PRESETS[preset];
  const title = escapeXml(meme.title);
  const summary = escapeXml(meme.summary);
  const firstDialogue =
    meme.usage_examples[0]?.dialogue[1]?.line ?? "실전 대화에서 바로 쓰는 밈";
  const dialogueEscaped = escapeXml(`"${firstDialogue}"`);

  const gradients: Record<CardTheme, { bgStart: string; bgMid: string; bgEnd: string; accent: string }> = {
    obsidian_coral: {
      bgStart: "#120e0d",
      bgMid: "#26130f",
      bgEnd: "#4a1c12",
      accent: "#ff6b4a",
    },
    cyber_indigo: {
      bgStart: "#0a0c1a",
      bgMid: "#131733",
      bgEnd: "#232b5c",
      accent: "#6366f1",
    },
    minimal_clean: {
      bgStart: "#18181b",
      bgMid: "#27272a",
      bgEnd: "#3f3f46",
      accent: "#22c55e",
    },
  };

  const colors = gradients[theme];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.bgStart}" />
      <stop offset="50%" stop-color="${colors.bgMid}" />
      <stop offset="100%" stop-color="${colors.bgEnd}" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors.accent}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0.4" />
    </linearGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- 배경 캔버스 -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- 장식용 기하학 그리드 라인 -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1.5">
    <line x1="${width * 0.08}" y1="0" x2="${width * 0.08}" y2="${height}" />
    <line x1="${width * 0.92}" y1="0" x2="${width * 0.92}" y2="${height}" />
    <line x1="0" y1="${height * 0.12}" x2="${width}" y2="${height * 0.12}" />
    <line x1="0" y1="${height * 0.88}" x2="${width}" y2="${height * 0.88}" />
  </g>

  <!-- 중앙 글래스모피즘 메인 패널 -->
  <rect x="${width * 0.08}" y="${height * 0.1}" width="${width * 0.84}" height="${height * 0.8}" rx="32"
        fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" filter="url(#cardShadow)" />

  <!-- 상단 태그 및 뱃지 -->
  <g transform="translate(${width * 0.14}, ${height * 0.18})">
    <rect width="180" height="42" rx="21" fill="url(#badgeGrad)" />
    <text x="90" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">
      ✨ 밈캐치 오리지널
    </text>

    <!-- 사용 안전 뱃지 -->
    <rect x="196" width="130" height="42" rx="21" fill="#22c55e" fill-opacity="0.2" stroke="#22c55e" stroke-width="1.5" />
    <text x="261" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="19" font-weight="700" fill="#4ade80" text-anchor="middle">
      ● 써도 됨
    </text>
  </g>

  <!-- 밈 메인 타이틀 -->
  <text x="${width * 0.14}" y="${height * 0.36}" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif"
        font-size="${width > 1100 ? 76 : 64}" font-weight="900" fill="#ffffff" letter-spacing="-1.5">
    ${title}
  </text>

  <!-- 구분선 -->
  <line x1="${width * 0.14}" y1="${height * 0.42}" x2="${width * 0.86}" y2="${height * 0.42}" stroke="#ffffff" stroke-opacity="0.15" stroke-width="2" />

  <!-- 핵심 요약 설명 -->
  <foreignObject x="${width * 0.14}" y="${height * 0.46}" width="${width * 0.72}" height="${height * 0.2}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; font-size: ${width > 1100 ? 32 : 28}px; font-weight: 500; color: #e4e4e7; line-height: 1.5; word-break: keep-all;">
      ${summary}
    </div>
  </foreignObject>

  <!-- 실전 사용 말풍선 카드 -->
  <g transform="translate(${width * 0.14}, ${height * 0.66})">
    <rect width="${width * 0.72}" height="${height * 0.14}" rx="20" fill="#000000" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />
    <text x="28" y="${height * 0.055}" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="20" font-weight="700" fill="${colors.accent}">
      💬 실전 톡 용례
    </text>
    <text x="28" y="${height * 0.10}" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="24" font-weight="600" fill="#ffffff">
      ${dialogueEscaped}
    </text>
  </g>

  <!-- 하단 브랜드 로고 및 신뢰 마크 -->
  <g transform="translate(${width * 0.14}, ${height * 0.85})">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="22" font-weight="800" fill="#a1a1aa" letter-spacing="1">
      CATCHMEME · 자체 검증 데이터베이스
    </text>
    <text x="${width * 0.72}" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif" font-size="20" font-weight="600" fill="#71717a" text-anchor="end">
      catchmeme.com
    </text>
  </g>
</svg>`;
}

/**
 * 인라인 이미지(Data URL)로 바로 사용할 수 있는 포맷을 반환합니다.
 */
function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function generateHouseMemeCardDataUrl(
  meme: Pick<GeneratedHouseMeme, "title" | "summary" | "category" | "safety_level" | "usage_examples">,
  preset: CardPreset = "square",
  theme: CardTheme = "obsidian_coral",
): string {
  const svg = generateHouseMemeCardSvg(meme, preset, theme);
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}
