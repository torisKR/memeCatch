"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { memePathFrom, SUBMISSION_STATUS } from "@/lib/labels";
import { submitMeme, type SubmitState } from "@/lib/actions/submit";
import { SubmissionStatusBadge } from "@/components/submission-status";

const DRAFT_KEY = "memecatch:submit-draft:v1";

type DraftFields = {
  name: string;
  seenAt: string;
  sourceUrl: string;
  description: string;
  guessReason: string;
  tags: string;
};

const EMPTY_FIELDS: DraftFields = {
  name: "",
  seenAt: "",
  sourceUrl: "",
  description: "",
  guessReason: "",
  tags: "",
};

type DupHit = { id: string; short_id: string; slug: string; title: string; summary: string };

const initialState: SubmitState = { status: "idle" };

export function SubmitForm({ defaultName = "" }: { defaultName?: string }) {
  const [state, formAction, pending] = useActionState(submitMeme, initialState);
  const [fields, setFields] = useState<DraftFields>({
    ...EMPTY_FIELDS,
    name: defaultName,
  });
  const [restored, setRestored] = useState(false);
  const [dups, setDups] = useState<DupHit[]>([]);
  const [dupLoading, setDupLoading] = useState(false);
  const searchSeq = useRef(0);
  const ids = {
    name: useId(),
    seenAt: useId(),
    sourceUrl: useId(),
    description: useId(),
    guessReason: useId(),
    tags: useId(),
  };

  // 임시저장 복원 (마운트 시 1회) — ?name= 프리필이 있으면 이름은 프리필 우선
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<DraftFields>;
        setFields((prev) => ({
          ...EMPTY_FIELDS,
          ...draft,
          name: defaultName || draft.name || "",
        }));
        if (Object.values(draft).some((v) => typeof v === "string" && v.trim())) {
          setRestored(true);
        }
      }
    } catch {
      // 저장소 접근 실패는 무시 (시크릿 모드 등)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 임시저장 (입력 디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const hasContent = Object.values(fields).some((v) => v.trim() !== "");
        if (hasContent) {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
        }
      } catch {
        // 무시
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fields]);

  // 성공 시 임시저장 삭제
  useEffect(() => {
    if (state.status === "success") {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // 무시
      }
    }
  }, [state.status]);

  // 실시간 중복 검사 — 이름 입력 디바운스 후 search_memes
  useEffect(() => {
    const query = fields.name.trim();
    if (query.length < 2) {
      setDups([]);
      setDupLoading(false);
      return;
    }
    setDupLoading(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_memes", {
        p_query: query,
        p_limit: 3,
      });
      if (seq !== searchSeq.current) return; // 최신 검색만 반영
      setDupLoading(false);
      if (error || !data) {
        setDups([]);
        return;
      }
      setDups(
        data.map((m) => ({
          id: m.id,
          short_id: m.short_id,
          slug: m.slug,
          title: m.title,
          summary: m.summary,
        }))
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [fields.name]);

  const update = useCallback(
    (key: keyof DraftFields) =>
      (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => {
        const value = e.target.value;
        setFields((prev) => ({ ...prev, [key]: value }));
      },
    []
  );

  if (state.status === "success") {
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border border-border bg-surface p-6"
      >
        <SubmissionStatusBadge status="pending" />
        <h2 className="mt-3 text-xl font-bold">
          {SUBMISSION_STATUS.pending.user}
        </h2>
        <p className="mt-2 text-muted">
          제보해 주셔서 고마워요. 검토가 끝나면 MY에서 결과를 알려드려요.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/my"
            className="flex h-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-white"
          >
            MY에서 제보 상태 보기
          </Link>
          <a
            href="/submit"
            className="flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold"
          >
            다른 밈 제보하기
          </a>
        </div>
      </section>
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {restored && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-muted" role="status">
          작성하던 내용을 불러왔어요.
        </p>
      )}
      {formError && (
        <p role="alert" className="rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red">
          {formError}
        </p>
      )}

      <div>
        <label htmlFor={ids.name} className="mb-1.5 block font-medium">
          밈 이름 <span className="text-safety-red" aria-hidden>*</span>
          <span className="sr-only">(필수)</span>
        </label>
        <input
          id={ids.name}
          name="name"
          type="text"
          required
          maxLength={100}
          value={fields.name}
          onChange={update("name")}
          placeholder="예: 우당탕탕"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? `${ids.name}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.name && (
          <p id={`${ids.name}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.name}
          </p>
        )}

        {/* 중복 검사 결과 */}
        {dupLoading && (
          <p className="mt-2 text-sm text-muted" role="status">
            비슷한 밈이 있는지 확인하는 중…
          </p>
        )}
        {!dupLoading && dups.length > 0 && (
          <div className="mt-2 rounded-xl bg-safety-yellow-bg px-4 py-3" role="status">
            <p className="font-medium text-safety-yellow">
              이미 등록된 밈 아닌가요?
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {dups.map((m) => (
                <li key={m.id}>
                  <Link
                    href={memePathFrom(m.short_id, m.slug)}
                    className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
                  >
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm text-muted">
              같은 밈이면 제보 대신 그 페이지에서 반응을 남겨 주세요.
            </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={ids.seenAt} className="mb-1.5 block font-medium">
          어디서 봤나요?
        </label>
        <input
          id={ids.seenAt}
          name="seenAt"
          type="text"
          maxLength={200}
          value={fields.seenAt}
          onChange={update("seenAt")}
          placeholder="예: 인스타 릴스, 회사 단톡방"
          aria-invalid={!!fieldErrors.seenAt}
          aria-describedby={fieldErrors.seenAt ? `${ids.seenAt}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.seenAt && (
          <p id={`${ids.seenAt}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.seenAt}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.sourceUrl} className="mb-1.5 block font-medium">
          원본 링크
        </label>
        <input
          id={ids.sourceUrl}
          name="sourceUrl"
          type="url"
          inputMode="url"
          maxLength={500}
          value={fields.sourceUrl}
          onChange={update("sourceUrl")}
          placeholder="https:// 로 시작하는 링크"
          aria-invalid={!!fieldErrors.sourceUrl}
          aria-describedby={fieldErrors.sourceUrl ? `${ids.sourceUrl}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.sourceUrl && (
          <p id={`${ids.sourceUrl}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.sourceUrl}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.description} className="mb-1.5 block font-medium">
          설명
        </label>
        <textarea
          id={ids.description}
          name="description"
          rows={4}
          maxLength={2000}
          value={fields.description}
          onChange={update("description")}
          placeholder="무슨 뜻인지, 어떻게 쓰이는지 아는 만큼 적어 주세요"
          aria-invalid={!!fieldErrors.description}
          aria-describedby={fieldErrors.description ? `${ids.description}-error` : undefined}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base placeholder:text-muted"
        />
        {fieldErrors.description && (
          <p id={`${ids.description}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.guessReason} className="mb-1.5 block font-medium">
          왜 유행하는 것 같나요?
        </label>
        <textarea
          id={ids.guessReason}
          name="guessReason"
          rows={3}
          maxLength={1000}
          value={fields.guessReason}
          onChange={update("guessReason")}
          placeholder="추측이어도 좋아요. 검토에 큰 도움이 돼요"
          aria-invalid={!!fieldErrors.guessReason}
          aria-describedby={fieldErrors.guessReason ? `${ids.guessReason}-error` : undefined}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base placeholder:text-muted"
        />
        {fieldErrors.guessReason && (
          <p id={`${ids.guessReason}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.guessReason}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.tags} className="mb-1.5 block font-medium">
          태그
        </label>
        <input
          id={ids.tags}
          name="tags"
          type="text"
          maxLength={300}
          value={fields.tags}
          onChange={update("tags")}
          placeholder="콤마로 구분 (예: 직장인, 유행어)"
          aria-invalid={!!fieldErrors.tags}
          aria-describedby={fieldErrors.tags ? `${ids.tags}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.tags && (
          <p id={`${ids.tags}-error`} role="alert" className="mt-1.5 text-sm text-safety-red">
            {fieldErrors.tags}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-white disabled:opacity-60"
      >
        {pending && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {pending ? "제보 보내는 중…" : "제보 보내기"}
      </button>
      <p className="text-center text-sm text-muted">
        작성 중인 내용은 이 기기에 자동으로 임시저장돼요.
      </p>
    </form>
  );
}
