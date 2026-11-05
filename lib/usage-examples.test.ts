import { describe, expect, it } from "vitest";
import { parseUsageExamples } from "./usage-examples";

describe("parseUsageExamples", () => {
  it("단순 텍스트 형태의 예문을 정상 파싱한다", () => {
    const raw = [
      { situation: "일상 대화", text: "중꺾마 정신으로 끝까지 가보자고!" },
    ];
    const parsed = parseUsageExamples(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].situation).toBe("일상 대화");
    expect(parsed[0].text).toBe("중꺾마 정신으로 끝까지 가보자고!");
    expect(parsed[0].dialogue).toBeUndefined();
  });

  it("대화형 dialogue 배열이 포함된 예문을 정상 파싱하고 text 기본값을 설정한다", () => {
    const raw = [
      {
        situation: "💼 슬랙 / 팀 버그 대응",
        dialogue: [
          { speaker: "동료", line: "치명적 버그가 터졌어요..." },
          { speaker: "나", line: "중꺾마 정신으로 원인 파악부터 해보죠!" },
        ],
      },
    ];
    const parsed = parseUsageExamples(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].situation).toBe("💼 슬랙 / 팀 버그 대응");
    expect(parsed[0].text).toBe("중꺾마 정신으로 원인 파악부터 해보죠!");
    expect(parsed[0].dialogue).toHaveLength(2);
    expect(parsed[0].dialogue?.[0].speaker).toBe("동료");
    expect(parsed[0].dialogue?.[1].speaker).toBe("나");
  });

  it("유효하지 않은 데이터는 필터링한다", () => {
    const raw = [
      null,
      {},
      { situation: "", text: "내용만 있음" },
      { situation: "상황만 있음", text: "" },
      { situation: "정상 상황", text: "정상 텍스트" },
    ];
    const parsed = parseUsageExamples(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].situation).toBe("정상 상황");
  });
});
