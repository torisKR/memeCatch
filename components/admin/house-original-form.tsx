"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sanitizeStudioText } from "@/components/studio/meme-artifacts";
import { createHouseOriginal } from "@/lib/actions/admin";
import {
  CONTENT_PIPELINE_IMPORT_MAX_BYTES,
  ContentPipelineImportError,
  parseContentPipelineImport,
  type ContentPipelineCard,
} from "@/lib/content-pipeline-import";
import {
  HOUSE_ORIGINAL,
  houseOriginalOperatorPath,
  houseOriginalOriginHint,
  houseOriginalPathNote,
  houseOriginalPathStepAriaCurrent,
  originYearFieldLabel,
} from "@/lib/house-original";
import { CATEGORIES, DIFFICULTY, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import type { MemeConcept, MemeFormat, MemeTone } from "@/lib/meme-studio.server";
import { getMemeCountry, MEME_COUNTRIES, type MemeCountryCode } from "@/lib/meme-country";
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  SAFETY_OPTIONS,
  USAGE_CONTEXT_KEYS,
} from "./constants";
import { SafetySelect } from "./safety-select";

type UsageContextState = Record<(typeof USAGE_CONTEXT_KEYS)[number], SafetyLevel>;

const TONE_OPTIONS: { value: MemeTone; label: string }[] = [
  { value: "wholesome", label: "다정하게" },
  { value: "sarcastic", label: "시니컬하게" },
  { value: "absurd", label: "황당하게" },
  { value: "hype", label: "신나게" },
];

const FORMAT_OPTIONS: { value: MemeFormat; label: string }[] = [
  { value: "image-macro", label: "이미지 문구" },
  { value: "reaction", label: "리액션" },
  { value: "caption", label: "게시물 캡션" },
];

type StudioResult = {
  mode: "ai" | "template";
  provider?: "bedrock";
  concepts: MemeConcept[];
};
type StudioResponse = StudioResult | { error: string };

export function HouseOriginalForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importedCard, setImportedCard] = useState<ContentPipelineCard | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("yellow");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("phrase");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>("normal");
  const [originYear, setOriginYear] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<MemeTone>("hype");
  const [format, setFormat] = useState<MemeFormat>("caption");
  const [country, setCountry] = useState<MemeCountryCode>("KR");
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioResult, setStudioResult] = useState<StudioResult | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [directSavingConcept, setDirectSavingConcept] = useState<number | null>(null);
  const [usageContext, setUsageContext] = useState<UsageContextState>({
    work: "yellow",
    friends: "green",
    family: "yellow",
    sns: "yellow",
  });

  function resetGeneratedConcepts() {
    setStudioResult(null);
    setSelectedConcept(null);
    setStudioError(null);
  }

  async function importLocalDraft(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setError(null);
    setImportNotice(null);
    if (file.size > CONTENT_PIPELINE_IMPORT_MAX_BYTES) {
      setError("JSON 파일은 100KB 이하여야 합니다.");
      return;
    }

    try {
      const draft = parseContentPipelineImport(await file.text());
      setTitle(draft.title);
      setSummary(draft.summary);
      setDescription(draft.description);
      setOrigin(draft.origin);
      setSafetyLevel(draft.safetyLevel);
      setCategory(draft.category);
      setDifficulty(draft.difficulty);
      setOriginYear(String(draft.originYear));
      setCountry(draft.country);
      setUsageContext(draft.usageContext);
      setImportedCard(draft.card);
      resetGeneratedConcepts();
      setImportNotice("검토를 통과한 로컬 초안을 불러왔습니다. 내용을 확인한 뒤 대기로 저장해 주세요.");
    } catch (cause) {
      setError(
        cause instanceof ContentPipelineImportError
          ? cause.message
          : "JSON 초안을 불러오지 못했습니다. 파일을 확인해 주세요.",
      );
    }
  }

  async function generateConcepts() {
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 2 || studioLoading) return;
    setStudioLoading(true);
    setStudioError(null);
    try {
      const response = await fetch("/api/admin/meme-studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: cleanTopic, tone, format, country }),
      });
      const payload = (await response.json().catch(() => null)) as StudioResponse | null;
      if (!response.ok || !payload || "error" in payload) {
        setStudioError(
          response.status === 429
            ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "초안을 만들지 못했습니다. 입력을 확인하고 다시 시도해 주세요.",
        );
        return;
      }
      setStudioResult(payload);
      setSelectedConcept(null);
    } catch {
      setStudioError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setStudioLoading(false);
    }
  }

  function conceptInput(concept: MemeConcept) {
    const cleanTopic = sanitizeStudioText(topic.trim());
    const conceptCountry = getMemeCountry(concept.country_code) ?? getMemeCountry(country)!;
    return {
      title: sanitizeStudioText(concept.headline).replace(/\s+/g, " ").trim(),
      summary: sanitizeStudioText(concept.caption).replace(/\s+/g, " ").trim(),
      description: `현지 맥락: ${sanitizeStudioText(concept.cultural_anchor).trim()}\n\n비주얼: ${sanitizeStudioText(concept.visual_brief).trim()}\n\n왜 통하나요? ${sanitizeStudioText(concept.why_it_works).trim()}\n\n추천 활용: ${sanitizeStudioText(concept.usage_context).trim()}`,
      origin: `밈캐치가 ${conceptCountry.label}의 "${cleanTopic}" 주제로 문구를 자체 기획해 만든 밈입니다. 외부 SNS 원본이나 제3자 미디어를 사용하지 않았습니다.`,
      country: concept.country_code,
      localTitle: sanitizeStudioText(concept.local_caption).replace(/\s+/g, " ").trim(),
      safetyLevel: "yellow" as const,
      category: format === "caption" ? "phrase" as const : "image" as const,
      difficulty: "normal" as const,
      originYear: new Date().getFullYear(),
      usageContext,
    };
  }

  function applyConcept(concept: MemeConcept, index: number) {
    const input = conceptInput(concept);
    setTitle(input.title);
    setSummary(input.summary);
    setDescription(input.description);
    setOrigin(input.origin);
    setOriginYear(String(input.originYear));
    setCategory(input.category);
    setSelectedConcept(index);
    setError(null);
  }

  function saveConceptDirectly(concept: MemeConcept, index: number) {
    setError(null);
    setDirectSavingConcept(index);
    startTransition(async () => {
      const res = await createHouseOriginal(conceptInput(concept));
      if (!res.ok) {
        setError(res.error);
        setDirectSavingConcept(null);
        return;
      }
      router.push(`/admin/memes/${res.data?.memeId}`);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const year = originYear.trim() ? Number(originYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
      setError("제작 연도는 1980~2100 사이 숫자로 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await createHouseOriginal({
        title,
        summary,
        description,
        origin,
        safetyLevel,
        category,
        difficulty,
        originYear: year,
        usageContext,
        country,
        localTitle: selectedConcept === null
          ? title
          : studioResult?.concepts[selectedConcept]?.local_caption ?? title,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/memes/${res.data?.memeId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <p className="rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed">
        밈캐치가 직접 만든 사전 항목만 등록합니다. 인터넷 밈을 카탈로그로 옮기거나 AI 초안을
        자동 게시하지 않습니다. 저장하면 <strong>대기(pending)</strong>만 만들어지고, 사실 확인과
        권리 확인은 따로 진행합니다.
      </p>
      <ol aria-label="자체 제작 검수 경로" className="grid gap-2 sm:grid-cols-4">
        {houseOriginalOperatorPath("pending").map((step, i) => (
          <li
            key={step.id}
            aria-current={houseOriginalPathStepAriaCurrent(step.state)}
            className={`rounded-lg px-3 py-2 text-sm ${
              step.state === "current"
                ? "bg-safety-yellow-bg text-safety-yellow"
                : "bg-surface-2 text-muted"
            }`}
          >
            <span className="mr-1 tabular-nums">{i + 1}.</span>
            {step.label}
            <span className="ml-1 text-xs">({step.stateLabel})</span>
          </li>
        ))}
      </ol>
      <p className="text-sm leading-relaxed text-muted">{houseOriginalPathNote()}</p>
      <section
        aria-label="로컬 생성 초안 가져오기"
        className="space-y-3 rounded-xl border border-border bg-surface-2 p-4"
      >
        <div>
          <h2 className="text-lg font-bold">OpenCodex 로컬 초안 가져오기</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            로컬에서 생성하고 검토를 통과한 JSON만 항목에 채웁니다. 가져오기만으로 저장하거나
            게시하지 않으며, 아래 내용을 운영자가 확인한 뒤 대기로 저장합니다.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">초안 JSON 파일 (최대 100KB)</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importLocalDraft(event)}
            disabled={pending}
            className="block min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
        {importNotice && (
          <p role="status" className="rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green">
            {importNotice}
          </p>
        )}
        {importedCard && (
          <aside
            aria-label="가져온 카드 문구·아트 방향·제작 설정"
            className="space-y-2 rounded-lg border border-border bg-surface p-3"
          >
            <h3 className="text-sm font-bold">
              카드 문구·아트 방향·제작 설정 (초안 설명에 함께 저장)
            </h3>
            <p className="whitespace-pre-line text-sm font-semibold">{importedCard.caption}</p>
            <p className="text-sm leading-relaxed text-muted">{importedCard.visualBrief}</p>
            <p className="break-all font-mono text-xs leading-relaxed text-muted">
              제작 설정: {JSON.stringify({
                motif: importedCard.motif,
                symbols: importedCard.symbols,
                composition: importedCard.composition,
              })}
            </p>
          </aside>
        )}
      </section>
      <section
        aria-label="자체 밈 초안 생성"
        className="space-y-3 rounded-xl border border-accent bg-accent-soft p-4"
      >
        <div>
          <h2 className="text-lg font-bold">SNS 없이 자체 초안 만들기</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            주제와 국가를 고르면 Bedrock 초안 3개를 만듭니다. 생성 예산을 사용할 수 없거나
            일시 장애가 나면 저장 가능한 초안을 만들지 않으며, 초안을 고르기 전에는 저장하지 않습니다.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">자체 밈 주제</span>
          <input
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              resetGeneratedConcepts();
            }}
            disabled={studioLoading}
            maxLength={120}
            placeholder="예: 회의가 5분 일찍 끝난 날"
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">밈 국가</span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value as MemeCountryCode);
                resetGeneratedConcepts();
              }}
              disabled={studioLoading}
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
            >
              {Object.values(MEME_COUNTRIES).map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">초안 분위기</span>
            <select
              value={tone}
              onChange={(e) => {
                setTone(e.target.value as MemeTone);
                resetGeneratedConcepts();
              }}
              disabled={studioLoading}
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">초안 형식</span>
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as MemeFormat);
                resetGeneratedConcepts();
              }}
              disabled={studioLoading}
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void generateConcepts()}
          disabled={topic.trim().length < 2 || studioLoading}
          className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {studioLoading ? "초안 만드는 중…" : "자체 밈 초안 3개 만들기"}
        </button>
        {studioError && (
          <p role="alert" className="rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red">
            {studioError}
          </p>
        )}
        {studioResult && (
          <div aria-live="polite" className="space-y-3">
            <p className="text-sm font-semibold text-accent-text">
              {studioResult.mode === "ai" && studioResult.provider === "bedrock"
                ? "AWS Bedrock 초안"
                : "$0 기본 템플릿 초안"}
            </p>
            <div className="grid gap-3 lg:grid-cols-3">
              {studioResult.concepts.map((concept, index) => (
                <article
                  key={`${concept.headline}-${index}`}
                  className={`rounded-lg border bg-surface p-3 ${
                    selectedConcept === index ? "border-accent" : "border-border"
                  }`}
                >
                  <h3 className="font-bold">{sanitizeStudioText(concept.headline)}</h3>
                  <p className="mt-1 text-xs font-semibold text-accent-text">
                    {getMemeCountry(concept.country_code)?.label ?? concept.country_code}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                    {sanitizeStudioText(concept.caption)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    <strong>현지 문구:</strong> {sanitizeStudioText(concept.local_caption)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    <strong>현지 맥락:</strong> {sanitizeStudioText(concept.cultural_anchor)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    <strong>비주얼:</strong> {sanitizeStudioText(concept.visual_brief)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {sanitizeStudioText(concept.why_it_works)}
                  </p>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      onClick={() => saveConceptDirectly(concept, index)}
                      disabled={pending}
                      aria-label={`“${sanitizeStudioText(concept.headline)}” 대기로 바로 저장`}
                      className="min-h-11 rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {directSavingConcept === index ? "대기로 저장 중…" : "대기로 바로 저장"}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyConcept(concept, index)}
                      disabled={pending}
                      aria-label={`“${sanitizeStudioText(concept.headline)}” 초안 사용`}
                      className="min-h-11 rounded-lg border border-accent px-3 text-sm font-semibold text-accent-text disabled:opacity-50"
                    >
                      {selectedConcept === index ? "아래 항목에 적용됨" : "수정 후 저장"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="rounded-lg bg-safety-red-bg p-3 text-base text-safety-red">
          {error}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-base font-medium">제목</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">한 줄 요약</span>
        <input
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">설명</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-base font-medium">어떻게 만들었나요?</span>
        <textarea
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          rows={4}
          aria-describedby="house-origin-hint"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
      </label>
      <p id="house-origin-hint" className="-mt-2 text-sm text-muted">
        {houseOriginalOriginHint()}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <SafetySelect
          label="신호등"
          value={safetyLevel}
          options={SAFETY_OPTIONS}
          onChange={setSafetyLevel}
        />
        <label className="block">
          <span className="mb-1 block text-base font-medium">분류</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number])}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].user}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">난이도</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as (typeof DIFFICULTY_OPTIONS)[number])}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY[d].user}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-base font-medium">
          {originYearFieldLabel(HOUSE_ORIGINAL)} (선택)
        </span>
        <input
          inputMode="numeric"
          value={originYear}
          onChange={(e) => setOriginYear(e.target.value)}
          placeholder="2026"
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-base font-medium">상황별 신호등</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {USAGE_CONTEXT_KEYS.map((key) => (
            <SafetySelect
              key={key}
              label={USAGE_CONTEXTS[key]}
              value={usageContext[key]}
              options={SAFETY_OPTIONS}
              onChange={(level) => setUsageContext((prev) => ({ ...prev, [key]: level }))}
            />
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : "대기로 저장"}
      </button>
    </form>
  );
}
