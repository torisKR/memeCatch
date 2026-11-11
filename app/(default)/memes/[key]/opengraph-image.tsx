import { ImageResponse } from "next/og";
import { MemePosterOg } from "@/components/meme-poster-og";
import { createStaticClient } from "@/lib/supabase/server";
import { shortIdFromParam, type SafetyLevel } from "@/lib/labels";
import { loadMemeArtByShortId, loadReachableMemeArt } from "@/lib/meme-art.server";
import { memeArtAlt, posterBadgeLabel, posterBadgeTone } from "@/lib/meme-poster";

export const alt = "밈캐치 밈 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

let fontCache: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer } | null> | null = null;
function loadFonts() {
  fontCache ??= (async () => {
    try {
      const [bold, regular] = await Promise.all([
        fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf").then((res) => {
          if (!res.ok) throw new Error(`font ${res.status}`);
          return res.arrayBuffer();
        }),
        fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf").then((res) => {
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
    .select("title, summary, safety_level, origin_year")
    .eq("short_id", shortId)
    .maybeSingle();

  const title = truncate(meme?.title ?? "밈캐치", 24);
  const summary = truncate(meme?.summary ?? "그 밈, 3초 안에 알려드려요", 64);
  const safety = (meme?.safety_level ?? "yellow") as SafetyLevel;
  const tone = posterBadgeTone(safety);
  const artPath = await loadMemeArtByShortId(shortId);
  const artSrc = await loadReachableMemeArt(artPath);
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <MemePosterOg
        title={title}
        summary={summary}
        badgeLabel={posterBadgeLabel(safety, "ko")}
        badgeBackground={tone.background}
        badgeForeground={tone.foreground}
        year={meme?.origin_year}
        artSrc={artSrc}
        artAlt={memeArtAlt(meme?.title ?? "밈캐치")}
      />
    ),
    {
      ...size,
      fonts: fonts
        ? [
            { name: "Pretendard", data: fonts.bold, style: "normal" as const, weight: 700 as const },
            { name: "Pretendard", data: fonts.regular, style: "normal" as const, weight: 400 as const },
          ]
        : undefined,
    },
  );
}
