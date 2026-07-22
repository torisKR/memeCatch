import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 (레인 E)
 * - /manifest.webmanifest 로 서빙 (app/layout.tsx의 metadata.manifest와 일치)
 * - background_color는 매니페스트 스펙상 단일 값만 허용 → 라이트 토큰 사용
 *   (다크 대응은 layout.tsx의 viewport.themeColor media 쿼리가 담당)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    short_name: "밈캐치",
    description:
      "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 알려드려요.",
    lang: "ko",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#ff5c38",
    background_color: "#0f0f12", // 전 사이트 다크(잉크) 통일 — 스플래시도 잉크 톤
    categories: ["entertainment", "education", "social"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
