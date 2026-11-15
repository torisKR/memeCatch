import { MessageSquareQuote, MessagesSquare } from "lucide-react";
import { parseUsageExamples, type UsageExample } from "@/lib/usage-examples";
import { CopyTextButton } from "@/components/copy-text-button";

export type { UsageExample } from "@/lib/usage-examples";

export function UsageExamples({
  examples,
  heading = true,
}: {
  examples?: unknown;
  heading?: boolean;
}) {
  const rows = parseUsageExamples(examples);
  if (rows.length === 0) return null;

  const Wrapper = heading ? "section" : "div";

  return (
    <Wrapper
      {...(heading ? { "aria-labelledby": "usage-examples-title" } : {})}
      className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-xs"
    >
      {heading ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <MessagesSquare className="size-4" />
              </span>
              <h2 id="usage-examples-title" className="text-lg font-bold text-foreground sm:text-xl [word-break:keep-all]">
                이렇게 써요
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              메신저와 일상 대화에서 어색하지 않게 사용하는 모범 용례입니다.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {rows.map((ex, exIdx) => {
          const hasDialogue = Array.isArray(ex.dialogue) && ex.dialogue.length > 0;

          return (
            <div
              key={`${ex.situation}:${exIdx}`}
              className="rounded-xl border border-border/80 bg-surface-2/60 p-4 transition-all hover:border-border sm:p-5"
            >
              {/* 상황 라벨 태그 */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/50">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-semibold text-foreground">
                  <span className="size-1.5 rounded-full bg-accent" />
                  {ex.situation}
                </span>
                <span className="text-[11px] text-muted">메신저 시뮬레이션</span>
              </div>

              {/* 메신저 말풍선 컨테이너 */}
              <div className="mt-3.5 space-y-3">
                {hasDialogue ? (
                  ex.dialogue!.map((item, dIdx) => {
                    const isUser = item.speaker === "나" || item.speaker.includes("사용자");

                    return (
                      <div
                        key={dIdx}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <span className="mb-1 text-[11px] font-semibold text-muted px-1">
                          {item.speaker}
                        </span>
                        <div
                          className={`group relative flex items-center gap-2 max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm sm:text-base leading-relaxed shadow-xs ${
                            isUser
                              ? "rounded-tr-xs bg-accent/15 border border-accent/40 text-foreground font-medium"
                              : "rounded-tl-xs bg-surface border border-border text-foreground"
                          }`}
                        >
                          <p className="flex-1 break-words">{item.line}</p>
                          {isUser && (
                            <CopyTextButton
                              text={item.line}
                              ariaLabel="밈 답변 복사"
                              variant="mini"
                              className="shrink-0 opacity-80 group-hover:opacity-100"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* 단순 텍스트 단일 버블 폴백 */
                  <div className="flex flex-col items-start">
                    <span className="mb-1 text-[11px] font-semibold text-muted px-1">
                      추천 활용 예시
                    </span>
                    <div className="group relative flex w-full items-center justify-between gap-3 rounded-2xl rounded-tl-xs border border-border bg-surface p-3.5 text-sm sm:text-base leading-relaxed text-foreground shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-accent" />
                        <p className="break-words font-medium">{ex.text}</p>
                      </div>
                      <CopyTextButton
                        text={ex.text}
                        ariaLabel="예문 복사"
                        variant="mini"
                        className="shrink-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Wrapper>
  );
}
