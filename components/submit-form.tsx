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
import { memePathFrom } from "@/lib/labels";
import { useLocale } from "@/lib/i18n-client";
import { SUBMIT_COPY } from "@/lib/i18n-submit";
import {
  submitMemeWithAttachment,
  type SubmitState,
} from "@/app/(default)/submit/actions";
import {
  MAX_UPLOAD_BYTES,
  uploadMemeImage,
  validateUploadFile,
  UPLOAD_ACCEPT,
} from "@/lib/upload";
import { SubmissionStatusBadge } from "@/components/submission-status";
import { ContentUrlPreview } from "@/components/content-url-preview";

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

type DupHit = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
};

const initialState: SubmitState = { status: "idle" };

export function SubmitForm({ defaultName = "" }: { defaultName?: string }) {
  const { locale } = useLocale();
  const copy = SUBMIT_COPY[locale];
  const [state, formAction, pending] = useActionState(
    submitMemeWithAttachment,
    initialState,
  );
  const [fields, setFields] = useState<DraftFields>({
    ...EMPTY_FIELDS,
    name: defaultName,
  });
  const [restored, setRestored] = useState(false);
  const [dups, setDups] = useState<DupHit[]>([]);
  const [dupLoading, setDupLoading] = useState(false);
  const searchSeq = useRef(0);
  // 첨부 이미지 상태
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 같은 파일 재제출 시 중복 업로드 방지 캐시
  const uploadedRef = useRef<{ file: File; path: string } | null>(null);
  const ids = {
    name: useId(),
    seenAt: useId(),
    sourceUrl: useId(),
    description: useId(),
    guessReason: useId(),
    tags: useId(),
    attachment: useId(),
  };

  // 임시저장 복원 (마운트 시 1회) — ?name= 프리필이 있으면 이름은 프리필 우선
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<DraftFields>;
        // 외부 스토어(localStorage) 초안 복원은 마운트 후 1회 동기화 — effect가 정석
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFields({
          ...EMPTY_FIELDS,
          ...draft,
          name: defaultName || draft.name || "",
        });
        if (
          Object.values(draft).some((v) => typeof v === "string" && v.trim())
        ) {
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
    // 사용자 입력(fields.name)에 반응하는 디바운스 검색 — 입력 동기화 effect(정석)
    /* eslint-disable react-hooks/set-state-in-effect */
    if (query.length < 2) {
      setDups([]);
      setDupLoading(false);
      return;
    }
    setDupLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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
        })),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [fields.name]);

  // 미리보기 object URL 정리
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setUploadError(null);
      if (!file) return;
      const invalid = validateUploadFile(file);
      if (invalid) {
        setUploadError(
          file.size > MAX_UPLOAD_BYTES
            ? copy.errors.imageTooLarge
            : copy.errors.imageType,
        );
        e.target.value = "";
        return;
      }
      setAttachFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [copy.errors],
  );

  const removeFile = useCallback(() => {
    setAttachFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // 제출 래퍼: 첨부가 있으면 먼저 업로드하고 경로를 formData에 담아 서버 액션 호출.
  // 업로드 실패 시 제출을 중단하고 에러 + 재시도 안내(파일은 유지).
  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setUploadError(null);
      if (attachFile) {
        let path: string;
        if (uploadedRef.current?.file === attachFile) {
          path = uploadedRef.current.path; // 이미 업로드된 동일 파일 재사용
        } else {
          setUploading(true);
          try {
            const result = await uploadMemeImage(attachFile);
            if (!result.ok) {
              setUploadError(
                result.code === "login_required"
                  ? copy.errors.loginRequired
                  : result.code === "rate_limited"
                    ? copy.errors.rateLimited
                    : copy.errors.imageUploadFailed,
              );
              return;
            }
            uploadedRef.current = { file: attachFile, path: result.path };
            path = result.path;
          } finally {
            setUploading(false);
          }
        }
        formData.set("attachmentPath", path);
      }
      formAction(formData);
    },
    [attachFile, copy.errors, formAction],
  );

  const update = useCallback(
    (key: keyof DraftFields) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFields((prev) => ({ ...prev, [key]: value }));
      },
    [],
  );

  if (state.status === "success") {
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border border-border bg-surface p-6"
      >
        <SubmissionStatusBadge
          status="pending"
          label={copy.form.successBadge}
        />
        <h2 className="mt-3 text-xl font-bold">{copy.form.successTitle}</h2>
        <p className="mt-2 text-muted">{copy.form.successBody}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/my"
            className="flex h-12 items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white"
          >
            {copy.form.viewMy}
          </Link>
          <Link
            href="/submit"
            className="flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold"
          >
            {copy.form.submitAnother}
          </Link>
        </div>
      </section>
    );
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form action={handleSubmit} className="flex flex-col gap-5" noValidate>
      {restored && (
        <p
          className="rounded-xl bg-surface-2 px-4 py-3 text-muted"
          role="status"
        >
          {copy.form.restored}
        </p>
      )}
      {formError && (
        <p
          role="alert"
          className="rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red"
        >
          {formError}
        </p>
      )}

      <div>
        <label htmlFor={ids.name} className="mb-1.5 block font-medium">
          {copy.form.nameLabel}{" "}
          <span className="text-safety-red" aria-hidden>
            *
          </span>
          <span className="sr-only">({copy.form.required})</span>
        </label>
        <input
          id={ids.name}
          name="name"
          type="text"
          required
          maxLength={100}
          value={fields.name}
          onChange={update("name")}
          placeholder={copy.form.namePlaceholder}
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? `${ids.name}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.name && (
          <p
            id={`${ids.name}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.name}
          </p>
        )}

        {/* 중복 검사 결과 */}
        {dupLoading && (
          <p
            className="mt-2 flex items-center gap-1.5 text-sm text-muted"
            role="status"
          >
            <span
              aria-hidden
              className="signal-live size-1.5 shrink-0 rounded-full bg-(--signal-cyan)"
            />
            {copy.form.duplicateLoading}
          </p>
        )}
        {!dupLoading && dups.length > 0 && (
          <div
            className="mt-2 rounded-xl bg-safety-yellow-bg px-4 py-3"
            role="status"
          >
            <p className="font-medium text-safety-yellow">
              {copy.form.duplicateTitle}
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
            <p className="mt-1 text-sm text-muted">{copy.form.duplicateBody}</p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={ids.seenAt} className="mb-1.5 block font-medium">
          {copy.form.seenAtLabel}
        </label>
        <input
          id={ids.seenAt}
          name="seenAt"
          type="text"
          maxLength={200}
          value={fields.seenAt}
          onChange={update("seenAt")}
          placeholder={copy.form.seenAtPlaceholder}
          aria-invalid={!!fieldErrors.seenAt}
          aria-describedby={
            fieldErrors.seenAt ? `${ids.seenAt}-error` : undefined
          }
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.seenAt && (
          <p
            id={`${ids.seenAt}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.seenAt}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.sourceUrl} className="mb-1.5 block font-medium">
          {copy.form.sourceUrlLabel}
        </label>
        <input
          id={ids.sourceUrl}
          name="sourceUrl"
          type="url"
          inputMode="url"
          maxLength={500}
          value={fields.sourceUrl}
          onChange={update("sourceUrl")}
          placeholder={copy.form.sourceUrlPlaceholder}
          aria-invalid={!!fieldErrors.sourceUrl}
          aria-describedby={
            fieldErrors.sourceUrl ? `${ids.sourceUrl}-error` : undefined
          }
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.sourceUrl && (
          <p
            id={`${ids.sourceUrl}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.sourceUrl}
          </p>
        )}
        <ContentUrlPreview url={fields.sourceUrl} copy={copy.preview} />
      </div>

      <div>
        <label htmlFor={ids.description} className="mb-1.5 block font-medium">
          {copy.form.descriptionLabel}
        </label>
        <textarea
          id={ids.description}
          name="description"
          rows={4}
          maxLength={2000}
          value={fields.description}
          onChange={update("description")}
          placeholder={copy.form.descriptionPlaceholder}
          aria-invalid={!!fieldErrors.description}
          aria-describedby={
            fieldErrors.description ? `${ids.description}-error` : undefined
          }
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base placeholder:text-muted"
        />
        {fieldErrors.description && (
          <p
            id={`${ids.description}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.guessReason} className="mb-1.5 block font-medium">
          {copy.form.guessLabel}
        </label>
        <textarea
          id={ids.guessReason}
          name="guessReason"
          rows={3}
          maxLength={1000}
          value={fields.guessReason}
          onChange={update("guessReason")}
          placeholder={copy.form.guessPlaceholder}
          aria-invalid={!!fieldErrors.guessReason}
          aria-describedby={
            fieldErrors.guessReason ? `${ids.guessReason}-error` : undefined
          }
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base placeholder:text-muted"
        />
        {fieldErrors.guessReason && (
          <p
            id={`${ids.guessReason}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.guessReason}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.tags} className="mb-1.5 block font-medium">
          {copy.form.tagsLabel}
        </label>
        <input
          id={ids.tags}
          name="tags"
          type="text"
          maxLength={300}
          value={fields.tags}
          onChange={update("tags")}
          placeholder={copy.form.tagsPlaceholder}
          aria-invalid={!!fieldErrors.tags}
          aria-describedby={fieldErrors.tags ? `${ids.tags}-error` : undefined}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base placeholder:text-muted"
        />
        {fieldErrors.tags && (
          <p
            id={`${ids.tags}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {fieldErrors.tags}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.attachment} className="mb-1.5 block font-medium">
          {copy.form.attachmentLabel}
        </label>
        <input
          ref={fileInputRef}
          id={ids.attachment}
          type="file"
          accept={UPLOAD_ACCEPT}
          onChange={onFileChange}
          aria-invalid={!!uploadError || !!fieldErrors.attachment}
          aria-describedby={
            uploadError || fieldErrors.attachment
              ? `${ids.attachment}-error`
              : `${ids.attachment}-hint`
          }
          className="w-full cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-base text-muted file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:text-sm file:font-semibold file:text-foreground"
        />
        <p id={`${ids.attachment}-hint`} className="mt-1.5 text-sm text-muted">
          {copy.form.attachmentHint}
        </p>
        {(uploadError || fieldErrors.attachment) && (
          <p
            id={`${ids.attachment}-error`}
            role="alert"
            className="mt-1.5 text-sm text-safety-red"
          >
            {uploadError ?? fieldErrors.attachment} —{" "}
            {copy.form.attachmentRetry}
          </p>
        )}
        {attachFile && previewUrl && (
          <div className="mt-3 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={copy.form.attachmentPreview}
              className="max-h-48 w-auto max-w-full rounded-xl border border-border object-contain"
            />
            <button
              type="button"
              onClick={removeFile}
              className="flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold"
            >
              {copy.form.removeAttachment}
            </button>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || uploading}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white disabled:opacity-60"
      >
        {(pending || uploading) && (
          <span
            aria-hidden
            className={
              uploading
                ? "signal-live size-2.5 rounded-full bg-(--signal-cyan)"
                : "h-4 w-4 animate-spin rounded-full border-2 border-flame-200/40 border-t-white"
            }
          />
        )}
        {uploading
          ? copy.form.uploading
          : pending
            ? copy.form.submitting
            : copy.form.submit}
      </button>
      <p className="text-center text-sm text-muted">{copy.form.draftHint}</p>
    </form>
  );
}
