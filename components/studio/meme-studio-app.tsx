"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ArtifactStudio } from "@/components/studio/artifact-studio";
import { sanitizeStudioText } from "@/components/studio/meme-artifacts";
import type { MemeConcept, MemeFormat, MemeTone } from "@/lib/meme-studio.server";
import { MemeReferenceSearch } from "@/components/meme-reference-search";

const TONE_OPTIONS: { value: MemeTone; label: string; hint: string }[] = [
  { value: "wholesome", label: "다정하게", hint: "따뜻함 · 응원" },
  { value: "sarcastic", label: "시니컬하게", hint: "건조함 · 빈정거림" },
  { value: "absurd", label: "황당하게", hint: "엉뚱함 · 혼돈" },
  { value: "hype", label: "신나게", hint: "과장 · 주인공 느낌" },
];

const FORMAT_OPTIONS: { value: MemeFormat; label: string }[] = [
  { value: "image-macro", label: "이미지 문구" },
  { value: "reaction", label: "리액션" },
  { value: "caption", label: "게시물 캡션" },
];

type StudioResponse =
  | { mode: "ai" | "template"; concepts: MemeConcept[] }
  | { error: string };

type Workspace = "ideas" | "artifacts";

const WORKSPACES: { value: Workspace; label: string; hint: string }[] = [
  { value: "ideas", label: "아이디어 생성", hint: "토픽에 맞는 문구 3개 만들기" },
  { value: "artifacts", label: "내 콘텐츠 출력", hint: "이미지와 사전 카드를 PNG로 만들기" },
];

function studioErrorMessage(status: number) {
  if (status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (status === 400) return "토픽과 선택 항목을 확인해 주세요.";
  return "아이디어를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function MemeStudioApp({ aiEnabled }: { aiEnabled: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace>("ideas");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<MemeTone>("hype");
  const [format, setFormat] = useState<MemeFormat>("caption");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<StudioResponse, { concepts: MemeConcept[] }> | null>(null);
  const [copyState, setCopyState] = useState<{ index: number; ok: boolean } | null>(null);
  const reducedMotion = useReducedMotion();

  const canSubmit = topic.trim().length >= 2 && !loading;

  async function generate() {
    if (!canSubmit) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/meme-studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), tone, format }),
      });
      const payload = (await response.json().catch(() => null)) as StudioResponse | null;
      if (!response.ok || !payload || "error" in payload) {
        setErrorMsg(studioErrorMessage(response.status));
        return;
      }
      setResult(payload);
      setCopyState(null);
    } catch {
      setErrorMsg("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(index: number, text: string) {
    const ok = await copyText(text);
    setCopyState({ index, ok });
    window.setTimeout(
      () => setCopyState((current) => (current?.index === index ? null : current)),
      2000,
    );
  }

  return (
    <div className="mt-8">
      <div className="rounded-2xl border border-border bg-surface-2 p-2">
        <div role="group" aria-label="스튜디오 작업 공간" className="grid gap-2 sm:grid-cols-2">
          {WORKSPACES.map((option) => {
            const active = option.value === workspace;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                aria-controls={`studio-workspace-${option.value}`}
                onClick={() => setWorkspace(option.value)}
                className={`min-h-11 rounded-xl border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
                  active
                    ? "border-accent bg-accent-strong text-white"
                    : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
                }`}
              >
                <span className="block text-base font-bold sm:text-sm">{option.label}</span>
                <span className={`block text-xs ${active ? "text-white/85" : "text-muted"}`}>
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="studio-workspace-ideas"
        hidden={workspace !== "ideas"}
        className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start"
      >
      <section aria-label="밈 아이디어 입력" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <label htmlFor="studio-topic" className="block text-sm font-bold">
          어떤 내용인가요?
        </label>
        <input
          id="studio-topic"
          name="topic"
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) void generate();
          }}
          maxLength={120}
          placeholder="예: 내 의자를 뺏은 고양이"
          className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:text-sm"
        />

        <fieldset className="mt-5">
          <legend className="text-sm font-bold">분위기</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((option) => {
              const active = option.value === tone;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTone(option.value)}
                  className={`min-h-11 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
                    active
                      ? "border-accent bg-accent-strong text-white"
                      : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className={`block text-xs ${active ? "text-white/80" : ""}`}>{option.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold">형식</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((option) => {
              const active = option.value === format;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormat(option.value)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    active
                      ? "border-accent bg-accent-strong text-white"
                      : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!canSubmit}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,opacity,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:active:scale-100 motion-reduce:transition-none"
        >
          {loading ? "아이디어를 만드는 중입니다" : "밈 아이디어 만들기"}
        </button>

        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed text-muted">
          {aiEnabled
            ? "Ox Alpha 아이디어 생성이 준비되어 있습니다."
            : "기본 템플릿으로 아이디어를 만듭니다."}
        </p>
        <MemeReferenceSearch query={topic} variant="studio" />
      </section>

      <section aria-label="생성된 밈 아이디어" aria-live="polite" aria-busy={loading} className="min-w-0">
        {errorMsg && (
          <p role="alert" className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent-text">
            {errorMsg}
          </p>
        )}

        {loading &&
          [0, 1, 2].map((index) => (
            <div
              key={index}
              aria-hidden
              className="mt-3 h-40 animate-pulse rounded-xl border border-border bg-surface-2 motion-reduce:animate-none"
            />
          ))}

        {!loading && result && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold tracking-tight">
                “{sanitizeStudioText(topic.trim())}” 게시물 아이디어 {result.concepts.length}개
              </h2>
              <span className="shrink-0 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">
                {result.mode === "ai" ? "Ox Alpha 생성" : "기본 템플릿"}
              </span>
            </div>
            <AnimatePresence initial={false}>
              {result.concepts.map((concept, index) => (
                <motion.article
                  key={`${concept.headline}-${index}`}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={
                    reducedMotion ? { duration: 0 } : { delay: index * 0.06, duration: 0.28, ease: "easeOut" }
                  }
                  className="mt-4 overflow-hidden rounded-xl border border-border bg-surface p-5"
                >
                  <p className="text-sm font-bold text-accent">
                    {sanitizeStudioText(concept.headline)}
                  </p>
                  <blockquote className="mt-2 rounded-xl bg-accent-soft px-4 py-3 text-base font-extrabold leading-relaxed text-foreground">
                    “{sanitizeStudioText(concept.caption)}”
                  </blockquote>
                  <dl className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-bold text-foreground">포인트:</dt>
                      <dd>{sanitizeStudioText(concept.why_it_works)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-bold text-foreground">활용:</dt>
                      <dd>{sanitizeStudioText(concept.usage_context)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void handleCopy(index, sanitizeStudioText(concept.caption))}
                    aria-live="polite"
                    className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
                  >
                    {copyState?.index === index
                      ? copyState.ok ? "문구를 복사했어요" : "복사 실패, 다시 시도"
                      : "문구 복사"}
                  </button>
                </motion.article>
              ))}
            </AnimatePresence>
          </>
        )}

        {!loading && !result && !errorMsg && (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-lg font-extrabold">아직 만든 아이디어가 없습니다</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              토픽과 분위기, 형식을 고른 뒤 아이디어 만들기를 눌러 주세요.
            </p>
          </div>
        )}
      </section>
      </div>

      <div id="studio-workspace-artifacts" hidden={workspace !== "artifacts"} className="mt-6">
        <ArtifactStudio />
      </div>
    </div>
  );
}
