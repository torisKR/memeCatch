import { ImageResponse } from "next/og";
import { createStaticClient } from "@/lib/supabase/server";
import {
  SAFETY_LEVELS,
  LIFECYCLE_STATUS,
  shortIdFromParam,
  type SafetyLevel,
  type LifecycleStatus,
} from "@/lib/labels";

export const alt = "밈캐치 밈 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG 이미지 색 — globals.css 다크 토큰과 동일한 값
 * (ImageResponse는 CSS 변수를 지원하지 않아 값을 직접 사용)
 */
const C = {
  background: "#131316",
  surface: "#1c1c21",
  surface2: "#26262c",
  border: "#34343c",
  foreground: "#f0efec",
  muted: "#9c99a3",
  accent: "#ff6b47",
  safety: {
    green: { fg: "#3ecf85", bg: "#12301f" },
    yellow: { fg: "#e8b53a", bg: "#33290e" },
    gray: { fg: "#a1a1aa", bg: "#26262c" },
    red: { fg: "#ff6b6b", bg: "#351515" },
  },
  life: {
    rising: "#ff6b47",
    active: "#ffb054",
    cooling: "#7d93aa",
    archived: "#6f6a60",
  },
} as const;

/** 원격 폰트 — 실패 시 시스템 폰트 폴백 허용 (모듈 레벨 캐시) */
let fontCache: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer } | null> | null =
  null;
function loadFonts() {
  fontCache ??= (async () => {
    try {
      const [bold, regular] = await Promise.all([
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf"
        ).then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        }),
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf"
        ).then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        }),
      ]);
      return { bold, regular };
    } catch {
      return null; // 폴백: 기본(시스템) 폰트
    }
  })();
  return fontCache;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default async function Image({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const shortId = shortIdFromParam(key);

  const supabase = createStaticClient();
  const { data: meme } = await supabase
    .from("memes")
    .select("title, summary, safety_level, lifecycle_status")
    .eq("short_id", shortId)
    .maybeSingle();

  const title = truncate(meme?.title ?? "밈캐치", 20);
  const summary = truncate(
    meme?.summary ?? "그 밈, 3초 안에 알려드려요",
    52
  );
  const safety = SAFETY_LEVELS[(meme?.safety_level ?? "yellow") as SafetyLevel];
  const safetyColor =
    C.safety[(meme?.safety_level ?? "yellow") as SafetyLevel];
  const lifecycle =
    LIFECYCLE_STATUS[(meme?.lifecycle_status ?? "active") as LifecycleStatus];
  const lifeColor = C.life[(meme?.lifecycle_status ?? "active") as LifecycleStatus];

  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: C.background,
          padding: "56px 72px",
          fontFamily: fonts ? "Pretendard" : undefined,
        }}
      >
        {/* 상단: 로고 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              backgroundColor: C.accent,
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: C.accent }}>
            밈캐치
          </div>
          <div style={{ fontSize: 26, color: C.muted, marginLeft: 6 }}>
            그 밈, 3초 안에 알려드려요
          </div>
        </div>

        {/* 중앙: 밈명 + 한 줄 뜻 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: title.length > 12 ? 76 : 92,
              fontWeight: 700,
              color: C.foreground,
              lineHeight: 1.15,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 38, color: C.muted, lineHeight: 1.4 }}>
            {summary}
          </div>
        </div>

        {/* 하단: 신호등 뱃지 + 생명 게이지 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* 신호등: 색+아이콘+텍스트 병행 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              backgroundColor: safetyColor.bg,
              border: `2px solid ${safetyColor.fg}`,
              borderRadius: 9999,
              padding: "14px 30px",
            }}
          >
            <div style={{ fontSize: 30, color: safetyColor.fg }}>
              {safety.icon}
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 700, color: safetyColor.fg }}
            >
              {safety.user}
            </div>
          </div>

          {/* 생명 게이지 4칸 */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4].map((cell) => (
                <div
                  key={cell}
                  style={{
                    width: 44,
                    height: 20,
                    borderRadius: 6,
                    backgroundColor:
                      cell <= lifecycle.flame ? lifeColor : C.surface2,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: lifeColor }}>
              {lifecycle.user}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts
        ? [
            {
              name: "Pretendard",
              data: fonts.bold,
              style: "normal" as const,
              weight: 700 as const,
            },
            {
              name: "Pretendard",
              data: fonts.regular,
              style: "normal" as const,
              weight: 400 as const,
            },
          ]
        : undefined,
    }
  );
}
