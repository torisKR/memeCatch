import { POSTER_CREAM, POSTER_ORANGE } from "@/lib/meme-poster";

/** Shared poster layers for next/og. Text stays in this markup, never in the art. */
export function MemePosterOg({
  title,
  summary,
  badgeLabel,
  badgeBackground,
  badgeForeground,
  year,
  artSrc,
  artAlt,
}: {
  title: string;
  summary: string;
  badgeLabel: string;
  badgeBackground: string;
  badgeForeground: string;
  year?: number | null;
  artSrc?: string | null;
  artAlt: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#141414",
        fontFamily: "Pretendard",
      }}
    >
      {artSrc ? (
        // next/og paints this with satori, which only accepts an img element.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artSrc}
          alt={artAlt}
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 48,
            right: 64,
            width: 420,
            height: 280,
            backgroundColor: POSTER_ORANGE,
            borderRadius: 64,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 340,
          backgroundImage: "linear-gradient(to top, rgba(20,20,20,0.85), rgba(20,20,20,0))",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: 48,
          right: 48,
          bottom: 40,
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              backgroundColor: badgeBackground,
              color: badgeForeground,
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {badgeLabel}
          </div>
          {typeof year === "number" ? (
            <div
              style={{
                display: "flex",
                color: POSTER_CREAM,
                backgroundColor: "rgba(255,255,255,0.16)",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {String(year)}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            color: POSTER_CREAM,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", color: POSTER_CREAM, fontSize: 28, lineHeight: 1.35 }}>
          {summary}
        </div>
      </div>
    </div>
  );
}
