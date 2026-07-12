import { getOEmbed, OEmbedError } from "@/lib/oembed";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url).searchParams.get("url") ?? "";
    const result = await getOEmbed(url);
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    if (error instanceof OEmbedError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "플랫폼 응답 시간이 초과되었습니다."
        : "콘텐츠 정보를 불러오는 중 오류가 발생했습니다.";
    return Response.json(
      { error: message, code: "UPSTREAM_ERROR" },
      { status: 502 }
    );
  }
}
