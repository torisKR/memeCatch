import { ImageResponse } from "next/og";

export const alt = "밈캐치 — 그 밈, 3초 안에 알려드려요";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 루트(홈·공용) OG 이미지 — 카카오톡/트위터 공유 카드.
 * 상세 페이지는 app/memes/[key]/opengraph-image.tsx가 별도 생성.
 * 색은 globals.css 다크 토큰과 동일 값(ImageResponse는 CSS 변수 미지원).
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #131316 55%, #3a2018 100%)",
          color: "#f0efec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#FF5A1F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 64 64" fill="none">
              <path
                fill="#FFF9F5"
                d="M14 8h36a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10H26L10 60c-3 2.4-6-.2-6-3V18A10 10 0 0 1 14 8Z"
              />
              <circle cx="41" cy="29" r="7.5" fill="#FF5A1F" />
              <path d="M15 29h11" stroke="#FF5A1F" strokeWidth="5.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>밈캐치</div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -2,
          }}
        >
          그 밈, 3초 안에
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -2,
            color: "#ff6b47",
          }}
        >
          알려드려요
        </div>
        <div style={{ marginTop: 32, fontSize: 32, color: "#9c99a3" }}>
          뜻·유래부터 지금 써도 되는지까지 — 한국 밈 실시간 사전
        </div>
      </div>
    ),
    { ...size }
  );
}
