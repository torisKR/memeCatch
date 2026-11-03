export type DialogueLine = {
  speaker: string;
  line: string;
};

export type UsageExample = {
  situation: string;
  text: string;
  dialogue?: DialogueLine[];
};

export const MAX_USAGE_EXAMPLES = 3;
export const MAX_USAGE_EXAMPLE_SITUATION_LENGTH = 120;
export const MAX_USAGE_EXAMPLE_TEXT_LENGTH = 500;

export function parseUsageExamples(value: unknown): UsageExample[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): UsageExample[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const object = item as Record<string, unknown>;
      const situation = object.situation;

      if (
        typeof situation !== "string" ||
        situation.trim().length === 0 ||
        situation.length > MAX_USAGE_EXAMPLE_SITUATION_LENGTH
      ) {
        return [];
      }

      // 1. 대화형 dialogue 배열 검증
      let dialogue: DialogueLine[] | undefined;
      if (Array.isArray(object.dialogue) && object.dialogue.length > 0) {
        const parsedLines: DialogueLine[] = [];
        for (const lineItem of object.dialogue) {
          if (
            lineItem &&
            typeof lineItem === "object" &&
            !Array.isArray(lineItem)
          ) {
            const lineObj = lineItem as Record<string, unknown>;
            const speaker = typeof lineObj.speaker === "string" ? lineObj.speaker.trim() : "";
            const line = typeof lineObj.line === "string" ? lineObj.line.trim() : "";
            if (speaker && line && line.length <= MAX_USAGE_EXAMPLE_TEXT_LENGTH) {
              parsedLines.push({ speaker, line });
            }
          }
        }
        if (parsedLines.length > 0) {
          dialogue = parsedLines;
        }
      }

      // 2. 단일 텍스트 또는 dialogue 대표 문장 추출
      let text = typeof object.text === "string" ? object.text.trim() : "";
      if (!text && dialogue && dialogue.length > 0) {
        // dialogue 중 '나' 또는 마지막 발화자의 대사를 text 기본값으로 채택
        const userLine = dialogue.find((d) => d.speaker === "나" || d.speaker.includes("사용자"));
        text = userLine?.line ?? dialogue[dialogue.length - 1].line;
      }

      if (!text || text.length > MAX_USAGE_EXAMPLE_TEXT_LENGTH) {
        return [];
      }

      return [{ situation: situation.trim(), text, dialogue }];
    })
    .slice(0, MAX_USAGE_EXAMPLES);
}
