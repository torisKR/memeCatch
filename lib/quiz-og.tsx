import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { QUIZ_MODE_LABEL, QUIZ_OG_SIZE, type QuizShareResult } from "@/lib/quiz-share";

/**
 * 밈력고사 결과 링크 미리보기 (1200×630 PNG).
 * 점수·등급·모드·정오 패턴만 그린다 — 토큰만으로 렌더하므로 DB 조회 없음.
 * 등급 문구가 자유 한글이라 서브셋(og-fonts/ko.ttf) 대신 전체 ko.otf를 쓴다.
 */

const COLORS = {
  background: "#0f0f13",
  card: "#181820",
  border: "#2d2d38",
  foreground: "#f4f4f5",
  muted: "#a1a1aa",
  accent: "#ff5c38",
  accentSoft: "#331c17",
  accentText: "#ff8a6b",
  signal: "#22d3ee",
  barOff: "#343442",
} as const;

let fontPromise: Promise<Buffer> | null = null;

function loadFont(): Promise<Buffer> {
  // 리터럴 경로 — standalone 파일 트레이스가 폰트를 포함하도록
  fontPromise ??= readFile(join(process.cwd(), "assets/og-fonts/share/ko.otf")).catch((error) => {
    fontPromise = null;
    throw error;
  });
  return fontPromise;
}

export async function renderQuizResultOgImage(result: QuizShareResult): Promise<ImageResponse> {
  const font = await loadFont();
  const { score, total, grade, mode, correct } = result;

  return new ImageResponse(
    (
      <div
        style={{
          width: QUIZ_OG_SIZE.width,
          height: QUIZ_OG_SIZE.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          backgroundColor: COLORS.background,
          backgroundImage:
            "radial-gradient(circle at 92% 8%, rgba(255,92,56,0.30), rgba(255,92,56,0) 45%), radial-gradient(circle at 6% 96%, rgba(34,211,238,0.22), rgba(34,211,238,0) 42%)",
          color: COLORS.foreground,
          fontFamily: "QuizSans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: COLORS.accent,
                marginRight: 14,
              }}
            />
            <div style={{ fontSize: 30 }}>밈캐치 밈력고사</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: COLORS.muted,
              border: `2px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: "6px 22px",
            }}
          >
            {`${QUIZ_MODE_LABEL[mode]} 모드`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, color: COLORS.muted }}>친구의 밈력은</div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
              <div style={{ fontSize: 200, lineHeight: 1, color: COLORS.signal }}>{String(score)}</div>
              <div style={{ fontSize: 72, color: COLORS.muted, marginLeft: 12 }}>{`/ ${total}`}</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 64,
              marginBottom: 24,
              maxWidth: 560,
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 48,
                color: COLORS.accentText,
                backgroundColor: COLORS.accentSoft,
                border: `3px solid ${COLORS.accent}`,
                borderRadius: 999,
                padding: "8px 32px",
              }}
            >
              {grade.label}
            </div>
            <div style={{ display: "flex", marginTop: 20, gap: 10 }}>
              {correct.map((ok, i) => (
                <div
                  key={i}
                  style={{
                    width: 40,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: ok ? COLORS.signal : COLORS.barOff,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: COLORS.accent,
            borderRadius: 28,
            padding: "22px 36px",
          }}
        >
          <div style={{ fontSize: 40, color: "#ffffff" }}>같은 문제로 내 점수 이겨보기</div>
          <div style={{ fontSize: 28, color: "#ffe8e1" }}>catchmeme.com</div>
        </div>
      </div>
    ),
    {
      ...QUIZ_OG_SIZE,
      fonts: [{ name: "QuizSans", data: font, weight: 700, style: "normal" }],
    },
  );
}
