import { describe, expect, it } from "vitest";
import { generateHouseMeme, formatHouseMemeAsSql } from "./data-generator";
import { generateHouseMemeCardSvg, generateHouseMemeCardDataUrl } from "./image-generator";
import { buildHouseMemeVideoPlan, generateAssSubtitles, generateVttSubtitles } from "./video-generator";

describe("독립형 자체 밈 데이터 및 미디어 생성 파이프라인", () => {
  const seed = {
    title: "칼퇴 요정",
    coreMeaning: "정시 퇴근 시간이 되자마자 흔적도 없이 사라지는 능력을 유쾌하게 비유한 표현",
    usageContext: "퇴근 직전 메신저나 SNS에서 정시 퇴근을 예고할 때",
    cautionPoint: "야근 중인 상사에게 직접 면전에서 외치기보다는 친한 동료 간에 쓰는 것이 안전합니다.",
  };

  it("외부 SNS 의존 없이 자립 가능한 완성형 밈 데이터를 생성한다", () => {
    const meme = generateHouseMeme(seed);

    expect(meme.title).toBe("칼퇴 요정");
    expect(meme.origin_kind).toBe("house_original");
    expect(meme.summary).toContain("칼퇴 요정");
    expect(meme.description.length).toBeGreaterThan(100);
    expect(meme.origin).toContain("자체 제작");
    expect(meme.safety_level).toBe("green");
    expect(meme.usage_examples.length).toBeGreaterThanOrEqual(1);
    expect(meme.video_scenes).toHaveLength(4);
    expect(meme.quiz.options).toHaveLength(4);
  });

  it("DB Seeding 및 마이그레이션용 SQL 문을 올바르게 포맷팅한다", () => {
    const meme = generateHouseMeme(seed);
    const sql = formatHouseMemeAsSql(meme);

    expect(sql).toContain("INSERT INTO public.memes");
    expect(sql).toContain("house_original");
    expect(sql).toContain("INSERT INTO public.meme_sources");
    expect(sql).toContain("creator_permission");
    expect(sql).toContain("original");
  });

  it("외부 썸네일 없이 순수 SVG 밈 카드와 Data URL을 생성한다", () => {
    const meme = generateHouseMeme(seed);
    const svg = generateHouseMemeCardSvg(meme);

    expect(svg).toContain("<svg");
    expect(svg).toContain("칼퇴 요정");
    expect(svg).toContain("✨ 밈캐치 오리지널");
    expect(svg).toContain("CATCHMEME");

    const dataUrl = generateHouseMemeCardDataUrl(meme);
    expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("숏폼 영상 렌더링용 자막(ASS/VTT) 및 실행 명령어를 생성한다", () => {
    const meme = generateHouseMeme(seed);
    const plan = buildHouseMemeVideoPlan(meme);

    expect(plan.format).toBe("vertical_shorts");
    expect(plan.totalDurationSec).toBe(15);
    expect(plan.subtitlesAss).toContain("[Script Info]");
    expect(plan.subtitlesAss).toContain("Dialogue:");
    expect(plan.subtitlesVtt).toContain("WEBVTT");
    expect(plan.ffmpegCommand).toContain("ffmpeg -y");
  });
});
