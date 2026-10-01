"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  checkCatalogMemeDuplicates,
  registerCatalogMeme,
  type CatalogDuplicateResult,
} from "@/lib/actions/admin-catalog";
import {
  CATALOG_SOURCE_PLATFORMS,
  type CatalogRegistrationInput,
} from "@/lib/catalog-registration";
import {
  RIGHTS_BASIS,
  RIGHTS_BASIS_LABELS,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  type RightsBasis,
  type SourceRole,
} from "@/lib/sources/review";
import { CATEGORIES, DIFFICULTY, USAGE_CONTEXTS, type SafetyLevel } from "@/lib/labels";
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  SAFETY_OPTIONS,
  SENTIMENT_ADMIN_LABELS,
  SENTIMENT_OPTIONS,
  USAGE_CONTEXT_KEYS,
} from "./constants";
import { SafetySelect } from "./safety-select";

type SourceDraft = {
  url: string;
  platform: (typeof CATALOG_SOURCE_PLATFORMS)[number];
  sourceRole: SourceRole;
  rightsBasis: RightsBasis;
  title: string;
  creatorName: string;
  reviewNote: string;
};

const PLATFORM_LABELS: Record<(typeof CATALOG_SOURCE_PLATFORMS)[number], string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
  broadcast_archive: "방송 아카이브",
  public_archive: "공공 아카이브",
  web: "웹",
};

const inputClass = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base";
const textareaClass = `${inputClass} py-2.5`;

function newRequestId() {
  return globalThis.crypto.randomUUID();
}

export function CatalogRegistrationForm() {
  const router = useRouter();
  const registrationKey = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Extract<CatalogDuplicateResult, { ok: true }>["data"]["matches"]>([]);
  const [checkedFingerprint, setCheckedFingerprint] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [sourceWorkYear, setSourceWorkYear] = useState("");
  const [memeFirstSeenYear, setMemeFirstSeenYear] = useState("");
  const [koreaViralYear, setKoreaViralYear] = useState("");
  const [yearPrecision, setYearPrecision] = useState<CatalogRegistrationInput["yearPrecision"]>("year");
  const [tags, setTags] = useState("");
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>("yellow");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("image");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]>("normal");
  const [sentiment, setSentiment] = useState<(typeof SENTIMENT_OPTIONS)[number]>("funny");
  const [usageContext, setUsageContext] = useState<Record<(typeof USAGE_CONTEXT_KEYS)[number], SafetyLevel>>({
    work: "yellow", friends: "green", family: "yellow", sns: "yellow",
  });
  const [sources, setSources] = useState<SourceDraft[]>([
    { url: "", platform: "web", sourceRole: "earliest_known", rightsBasis: "unknown", title: "", creatorName: "", reviewNote: "" },
    { url: "", platform: "web", sourceRole: "secondary_reference", rightsBasis: "link_only", title: "", creatorName: "", reviewNote: "" },
  ]);

  const fingerprint = useMemo(
    () => JSON.stringify([title.trim(), ...sources.map((source) => source.url.trim())]),
    [sources, title],
  );

  function changed() {
    setCheckedFingerprint(null);
    setDuplicates([]);
    setMessage(null);
    registrationKey.current = null;
  }

  function updateSource(index: number, patch: Partial<SourceDraft>) {
    changed();
    setSources((current) => current.map((source, i) => i === index ? { ...source, ...patch } : source));
  }

  function addSource() {
    if (sources.length >= 8) return;
    changed();
    setSources((current) => [...current, {
      url: "",
      platform: "web",
      sourceRole: "usage_example",
      rightsBasis: "unknown",
      title: "",
      creatorName: "",
      reviewNote: "",
    }]);
  }

  function removeSource(index: number) {
    if (index < 2) return;
    changed();
    setSources((current) => current.filter((_, i) => i !== index));
  }

  async function checkDuplicates() {
    setMessage(null);
    setDuplicates([]);
    const result = await checkCatalogMemeDuplicates({
      title,
      sourceUrls: sources.map((source) => source.url),
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return false;
    }
    setCheckedFingerprint(fingerprint);
    setDuplicates(result.data.matches);
    if (result.data.matches.length > 0) {
      setMessage("기존 항목과 겹칠 가능성이 있어요. 기존 밈을 확인한 뒤 등록 여부를 다시 판단해 주세요.");
      return false;
    }
    setMessage("중복 후보가 없어요. 이제 대기 상태로 등록할 수 있어요.");
    return true;
  }

  function yearValue(value: string) {
    return value.trim() ? Number(value) : null;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      if (checkedFingerprint !== fingerprint && !(await checkDuplicates())) return;
      if (duplicates.length > 0) return;
      registrationKey.current ??= newRequestId();
      const result = await registerCatalogMeme({
        registrationKey: registrationKey.current,
        title,
        aliases: aliases.split(",").map((value) => value.trim()).filter(Boolean),
        summary,
        description,
        origin,
        sourceWorkYear: yearValue(sourceWorkYear),
        memeFirstSeenYear: yearValue(memeFirstSeenYear),
        koreaViralYear: yearValue(koreaViralYear),
        yearPrecision,
        tags: tags.split(",").map((value) => value.trim()).filter(Boolean),
        safetyLevel,
        category,
        difficulty,
        sentiment,
        usageContext,
        sources,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      if (result.data.status === "duplicate") {
        setDuplicates(result.data.matches);
        setMessage("저장 직전에 중복 항목이 확인되어 등록하지 않았어요.");
        return;
      }
      router.push(`/admin/memes/${result.data.memeId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">외부 밈 카탈로그 등록</h2>
        <p className="mt-2 rounded-lg bg-safety-yellow-bg p-3 text-sm leading-relaxed text-safety-yellow">
          자체 제작으로 표시하지 않습니다. 저장은 비공개 <strong>대기</strong> 상태만 만들며,
          출처는 별도 검수 큐에서 사실·권리를 확인한 뒤 기존 수동 게시 절차를 따릅니다.
        </p>
      </section>

      {message && <p role="status" className="rounded-lg border border-border bg-surface-2 p-3 text-sm">{message}</p>}
      {duplicates.length > 0 && (
        <ul aria-label="중복 후보" className="space-y-2 rounded-xl border border-safety-yellow bg-safety-yellow-bg p-4">
          {duplicates.map((match) => (
            <li key={`${match.reason}:${match.memeId}`} className="text-sm">
              <Link href={`/admin/memes/${match.memeId}`} className="font-semibold underline">
                {match.title}
              </Link>{" "}
              · {match.reason === "title" ? "제목 일치" : "출처 URL 일치"}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">사전 본문</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label>제목<input aria-label="제목" required value={title} onChange={(e) => { changed(); setTitle(e.target.value); }} className={inputClass} /></label>
          <label>별칭 (쉼표로 구분)<input value={aliases} onChange={(e) => { changed(); setAliases(e.target.value); }} className={inputClass} /></label>
        </div>
        <label className="block">한 줄 요약<input aria-label="한 줄 요약" required value={summary} onChange={(e) => { changed(); setSummary(e.target.value); }} className={inputClass} /></label>
        <label className="block">설명<textarea aria-label="설명" required rows={5} value={description} onChange={(e) => { changed(); setDescription(e.target.value); }} className={textareaClass} /></label>
        <label className="block">기원·확산 설명<textarea aria-label="기원·확산 설명" required rows={4} value={origin} onChange={(e) => { changed(); setOrigin(e.target.value); }} className={textareaClass} /></label>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">연도·분류·태그</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["원작 연도", sourceWorkYear, setSourceWorkYear],
            ["최초 밈 사용 연도", memeFirstSeenYear, setMemeFirstSeenYear],
            ["한국 유행 연도", koreaViralYear, setKoreaViralYear],
          ].map(([label, value, setter]) => (
            <label key={label as string}>{label as string}<input aria-label={label as string} inputMode="numeric" value={value as string} onChange={(e) => { changed(); (setter as (value: string) => void)(e.target.value); }} className={inputClass} /></label>
          ))}
          <label>연도 정확도<select value={yearPrecision} onChange={(e) => { changed(); setYearPrecision(e.target.value as typeof yearPrecision); }} className={inputClass}>
            <option value="exact">정확한 날짜 근거</option><option value="year">연도 근거</option><option value="approximate">대략</option><option value="decade">10년 단위</option><option value="unknown">미확인</option>
          </select></label>
        </div>
        <label className="block">태그 (쉼표로 구분)<input aria-label="태그 (쉼표로 구분)" required value={tags} onChange={(e) => { changed(); setTags(e.target.value); }} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>카테고리<select value={category} onChange={(e) => { changed(); setCategory(e.target.value as typeof category); }} className={inputClass}>{CATEGORY_OPTIONS.map((value) => <option key={value} value={value}>{CATEGORIES[value].user}</option>)}</select></label>
          <label>난이도<select value={difficulty} onChange={(e) => { changed(); setDifficulty(e.target.value as typeof difficulty); }} className={inputClass}>{DIFFICULTY_OPTIONS.map((value) => <option key={value} value={value}>{DIFFICULTY[value].user}</option>)}</select></label>
          <label>감정 결<select value={sentiment} onChange={(e) => { changed(); setSentiment(e.target.value as typeof sentiment); }} className={inputClass}>{SENTIMENT_OPTIONS.map((value) => <option key={value} value={value}>{SENTIMENT_ADMIN_LABELS[value]}</option>)}</select></label>
          <SafetySelect label="사용 안전 신호등" value={safetyLevel} options={SAFETY_OPTIONS} onChange={(value) => { changed(); setSafetyLevel(value); }} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div><h2 className="text-lg font-semibold">원문·검증 출처</h2><p className="text-sm text-muted">최종 HTTPS 공개 URL만 저장하며, 링크와 검수 메모는 HTML로 렌더하지 않습니다.</p></div>
        {sources.map((source, index) => (
          <fieldset key={index} className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 font-semibold">{index === 0 ? "원문 또는 최초 확인 출처" : index === 1 ? "독립 검증 출처" : `추가 출처 ${index - 1}`}</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">출처 URL<input aria-label={`${index === 0 ? "원문" : "검증"} 출처 URL`} type="url" required value={source.url} onChange={(e) => updateSource(index, { url: e.target.value })} className={inputClass} /></label>
              <label>플랫폼<select value={source.platform} onChange={(e) => updateSource(index, { platform: e.target.value as SourceDraft["platform"] })} className={inputClass}>{CATALOG_SOURCE_PLATFORMS.map((value) => <option key={value} value={value}>{PLATFORM_LABELS[value]}</option>)}</select></label>
              <label>출처 역할<select value={source.sourceRole} onChange={(e) => updateSource(index, { sourceRole: e.target.value as SourceRole })} className={inputClass}>
                {(index === 0 ? ["original", "earliest_known"] as const : index === 1 ? ["secondary_reference", "official_reupload"] as const : SOURCE_ROLES).map((value) => <option key={value} value={value}>{SOURCE_ROLE_LABELS[value]}</option>)}
              </select></label>
              <label>권리 상태<select value={source.rightsBasis} onChange={(e) => updateSource(index, { rightsBasis: e.target.value as RightsBasis })} className={inputClass}>{RIGHTS_BASIS.map((value) => <option key={value} value={value}>{RIGHTS_BASIS_LABELS[value]}</option>)}</select></label>
              <label>출처 제목<input value={source.title} onChange={(e) => updateSource(index, { title: e.target.value })} className={inputClass} /></label>
              <label>제작자·채널<input value={source.creatorName} onChange={(e) => updateSource(index, { creatorName: e.target.value })} className={inputClass} /></label>
              <label>검수 메모<input aria-label={`${index === 0 ? "원문" : "검증"} 검수 메모`} value={source.reviewNote} onChange={(e) => updateSource(index, { reviewNote: e.target.value })} maxLength={500} className={inputClass} /></label>
            </div>
            {index >= 2 && (
              <button type="button" onClick={() => removeSource(index)} className="min-h-11 rounded-lg border border-border px-3 text-sm text-muted">
                이 출처 제거
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          disabled={sources.length >= 8}
          onClick={addSource}
          className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold disabled:opacity-50"
        >
          출처 추가 ({sources.length}/8)
        </button>
      </section>

      <fieldset className="rounded-xl border border-border bg-surface p-5">
        <legend className="px-1 text-lg font-semibold">사용 맥락별 신호등</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{USAGE_CONTEXT_KEYS.map((key) => <SafetySelect key={key} label={USAGE_CONTEXTS[key]} value={usageContext[key]} options={SAFETY_OPTIONS} onChange={(value) => { changed(); setUsageContext((current) => ({ ...current, [key]: value })); }} />)}</div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={() => startTransition(async () => { await checkDuplicates(); })} className="min-h-11 rounded-lg border border-border bg-surface px-5 font-semibold disabled:opacity-50">중복 검사</button>
        <button type="submit" disabled={pending || duplicates.length > 0} className="min-h-11 rounded-lg bg-accent-strong px-5 font-semibold text-white disabled:opacity-50">{pending ? "확인 중…" : "대기 상태로 등록"}</button>
        <Link href="/admin/memes" className="inline-flex min-h-11 items-center rounded-lg px-4 text-muted underline">취소</Link>
      </div>
    </form>
  );
}
