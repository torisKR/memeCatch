import type { ReactElement } from "react";
import {
  SAFETY_LEVELS,
  LIFECYCLE_STATUS,
  type SafetyLevel,
  type LifecycleStatus,
} from "@/lib/labels";

/**
 * B2 — 밈 카드 내보내기 렌더러(공유).
 * next/og ImageResponse(satori)로 밈 카드를 그린다. OG 이미지와 별개로,
 * 사용자 다운로드용 고해상도·워터마크 제거·프리미엄 템플릿을 지원한다.
 *
 * satori 제약: 자식이 둘 이상인 요소는 반드시 display:flex 를 명시한다.
 */

/** 다크 토큰(globals.css와 동일값 — ImageResponse는 CSS 변수 미지원) */
const DARK = {
  background: "#131316",
  surface2: "#26262c",
  foreground: "#f0efec",
  muted: "#9c99a3",
  accent: "#ff6b47",
} as const;

const SAFETY_COLOR = {
  green: { fg: "#3ecf85", bg: "#12301f" },
  yellow: { fg: "#e8b53a", bg: "#33290e" },
  gray: { fg: "#a1a1aa", bg: "#26262c" },
  red: { fg: "#ff6b6b", bg: "#351515" },
} as const;

const LIFE_COLOR = {
  rising: "#ff6b47",
  active: "#ffb054",
  cooling: "#7d93aa",
  archived: "#6f6a60",
} as const;

/** 템플릿 — free 1종 + premium 2종 */
export const CARD_TEMPLATES = {
  classic: {
    premium: false,
    label: "클래식",
    bg: DARK.background,
    fg: DARK.foreground,
    sub: DARK.muted,
    accent: DARK.accent,
    cell: DARK.surface2,
  },
  minimal: {
    premium: true,
    label: "미니멀",
    bg: "#faf9f7",
    fg: "#1a1a1e",
    sub: "#6b6870",
    accent: "#ff6b47",
    cell: "#e7e5e0",
  },
  bold: {
    premium: true,
    label: "볼드",
    bg: "#ff6b47",
    fg: "#ffffff",
    sub: "#ffe6de",
    accent: "#ffffff",
    cell: "#ffffff",
  },
} as const;

export type CardTemplate = keyof typeof CARD_TEMPLATES;

/** 포맷 — card(가로, free) + story(세로, premium) */
export const CARD_FORMATS = {
  card: { premium: false, width: 1200, height: 630, label: "카드 (1200×630)" },
  story: { premium: true, width: 1080, height: 1920, label: "스토리 (1080×1920)" },
} as const;

export type CardFormat = keyof typeof CARD_FORMATS;

export function isCardTemplate(v: string | null): v is CardTemplate {
  return v != null && Object.prototype.hasOwnProperty.call(CARD_TEMPLATES, v);
}

export function isCardFormat(v: string | null): v is CardFormat {
  return v != null && Object.prototype.hasOwnProperty.call(CARD_FORMATS, v);
}

/** 원격 폰트(모듈 레벨 캐시) — 실패 시 시스템 폰트 폴백 */
let fontCache: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer } | null> | null =
  null;
export function loadCardFonts() {
  fontCache ??= (async () => {
    try {
      const [bold, regular] = await Promise.all([
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf",
        ).then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        }),
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf",
        ).then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        }),
      ]);
      return { bold, regular };
    } catch {
      return null;
    }
  })();
  return fontCache;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type MemeCardData = {
  title: string;
  summary: string;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
};

/**
 * 밈 카드 JSX를 만든다.
 * @param watermark true면 우하단에 "밈캐치 · catchmeme.com" 표기(무료 티어).
 */
export function renderMemeCard(
  data: MemeCardData,
  opts: { template: CardTemplate; format: CardFormat; watermark: boolean; hasFont: boolean },
): ReactElement {
  const t = CARD_TEMPLATES[opts.template];
  const isStory = opts.format === "story";
  const safety = SAFETY_LEVELS[data.safetyLevel];
  const life = LIFECYCLE_STATUS[data.lifecycleStatus];

  // 볼드 템플릿은 accent 배경이라 신호등을 흰 반투명 배지로 통일한다.
  const badgeBg = opts.template === "bold" ? "rgba(255,255,255,0.16)" : SAFETY_COLOR[data.safetyLevel].bg;
  const badgeFg = opts.template === "bold" ? "#ffffff" : SAFETY_COLOR[data.safetyLevel].fg;
  const lifeFg = opts.template === "bold" ? "#ffffff" : LIFE_COLOR[data.lifecycleStatus];

  const title = truncate(data.title || "밈캐치", isStory ? 26 : 20);
  const summary = truncate(data.summary || "그 밈, 3초 안에 알려드려요", isStory ? 72 : 52);

  const titleSize = isStory ? (title.length > 14 ? 108 : 128) : title.length > 12 ? 76 : 92;
  const summarySize = isStory ? 52 : 38;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: t.bg,
        padding: isStory ? "120px 88px" : "56px 72px",
        fontFamily: opts.hasFont ? "Pretendard" : undefined,
        position: "relative",
      }}
    >
      {/* 상단: 로고 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 20, height: 20, borderRadius: 9999, backgroundColor: t.accent }} />
        <div style={{ fontSize: isStory ? 42 : 34, fontWeight: 700, color: t.accent }}>밈캐치</div>
        <div style={{ fontSize: isStory ? 30 : 26, color: t.sub, marginLeft: 6 }}>
          그 밈, 3초 안에 알려드려요
        </div>
      </div>

      {/* 중앙: 밈명 + 한 줄 뜻 */}
      <div style={{ display: "flex", flexDirection: "column", gap: isStory ? 32 : 22 }}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            color: t.fg,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: summarySize, color: t.sub, lineHeight: 1.4 }}>{summary}</div>
      </div>

      {/* 하단: 신호등 뱃지 + 생명 게이지 */}
      <div
        style={{
          display: "flex",
          alignItems: isStory ? "flex-start" : "center",
          justifyContent: "space-between",
          flexDirection: isStory ? "column" : "row",
          gap: isStory ? 28 : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            backgroundColor: badgeBg,
            border: `2px solid ${badgeFg}`,
            borderRadius: 9999,
            padding: "14px 30px",
          }}
        >
          <div style={{ fontSize: 30, color: badgeFg }}>{safety.icon}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: badgeFg }}>{safety.user}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((cell) => (
              <div
                key={cell}
                style={{
                  width: 44,
                  height: 20,
                  borderRadius: 6,
                  backgroundColor: cell <= life.flame ? lifeFg : t.cell,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: lifeFg }}>{life.user}</div>
        </div>
      </div>

      {/* 워터마크(무료 티어) — 우하단 고정 */}
      {opts.watermark && (
        <div
          style={{
            position: "absolute",
            right: isStory ? 88 : 72,
            bottom: isStory ? 56 : 24,
            fontSize: isStory ? 26 : 22,
            fontWeight: 700,
            color: t.sub,
            opacity: 0.7,
          }}
        >
          catchmeme.com
        </div>
      )}
    </div>
  );
}
