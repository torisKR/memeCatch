"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { CONTRIBUTE_ANCHOR } from "@/lib/meme-contribution-anchor";
import {
  submitMemeContribution,
  type ContributionKind,
} from "@/app/(default)/submit/actions";

export type MemeContributorView = {
  nickname: string;
  sourceCount: number;
  exampleCount: number;
};

function kindFromHash(hash: string): ContributionKind | null | undefined {
  if (hash === `#${CONTRIBUTE_ANCHOR}-source`) return "source";
  if (hash === `#${CONTRIBUTE_ANCHOR}-example`) return "example";
  if (hash === `#${CONTRIBUTE_ANCHOR}`) return null;
  return undefined;
}

function contributionLabel(c: MemeContributorView): string {
  const parts: string[] = [];
  if (c.sourceCount > 0) parts.push(`출처 ${c.sourceCount}`);
  if (c.exampleCount > 0) parts.push(`예문 ${c.exampleCount}`);
  return parts.join("·");
}

/**
 * 밈 상세 인라인 보강 제보 — 이 밈에 출처 링크나 사용 예문을 보탠다.
 *
 * 예전에는 신뢰 신호·정리 중 안내의 CTA가 일반 /submit 폼(새 밈 제보)으로 보내,
 * 사용자가 밈 이름부터 다시 적어야 했고 운영자는 어느 문서에 붙일지 다시 찾아야 했다.
 * 여기서 받은 제보는 이 밈에 묶여 관리자 제보 큐로 가고, 승인되면 바로 문서에 반영된다.
 * 승인된 기여자는 이름 공개에 동의한 경우 닉네임이 「함께 채운 사람」에 올라간다.
 */
export function MemeContribute({
  memeId,
  shortId,
  contributors,
  enabled = true,
}: {
  memeId: string;
  shortId: string;
  contributors: MemeContributorView[];
  /** 제보 접수를 닫았을 때(flags.submissionsOpen=false) 폼을 숨긴다. */
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const formId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContributionKind>("source");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [situation, setSituation] = useState("");
  const [text, setText] = useState("");
  const [creditPublic, setCreditPublic] = useState(true);
  const [notice, setNotice] = useState<
    { kind: "error" | "success"; message: string; loginLink?: boolean } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  // 같은 페이지의 CTA(#contribute…)를 누르면 펼치고 해당 탭을 고른다.
  useEffect(() => {
    function sync() {
      const next = kindFromHash(window.location.hash);
      if (next === undefined) return;
      setOpen(true);
      if (next) setKind(next);
      detailsRef.current?.scrollIntoView?.({ block: "start" });
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const canSubmit =
    !isPending &&
    (kind === "source" ? sourceUrl.trim().length > 0 : situation.trim() && text.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setNotice(null);
    startTransition(async () => {
      const res = await submitMemeContribution(
        kind === "source"
          ? { memeId, kind, sourceUrl, note, creditPublic }
          : { memeId, kind, situation, text, creditPublic },
      );
      if (res.ok) {
        track("meme_contribution_submitted", { short_id: shortId, kind });
        setSourceUrl("");
        setNote("");
        setSituation("");
        setText("");
        setNotice({
          kind: "success",
          message: creditPublic
            ? "고마워요! 검수를 거쳐 반영되면 「함께 채운 사람」에 닉네임이 올라가요."
            : "고마워요! 검수를 거쳐 이 문서에 반영할게요.",
        });
      } else {
        setNotice({
          kind: "error",
          message: res.message,
          loginLink: res.error === "login_required",
        });
      }
    });
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-signal-cyan focus:outline-none focus:ring-4 focus:ring-signal-cyan/20";

  return (
    <div className="space-y-3">
      {contributors.length > 0 && (
        <p className="text-sm text-muted" data-testid="meme-contributors">
          <span className="font-semibold text-foreground">함께 채운 사람</span>{" "}
          {contributors.map((c, i) => (
            <span key={c.nickname}>
              {i > 0 && ", "}
              {c.nickname}
              <span className="text-muted/80"> ({contributionLabel(c)})</span>
            </span>
          ))}
        </p>
      )}

      {enabled && (
        <details
          ref={detailsRef}
          id={CONTRIBUTE_ANCHOR}
          open={open}
          onToggle={(e) => setOpen(e.currentTarget.open)}
          className="scroll-mt-24 rounded-xl border border-border bg-surface-2"
        >
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-base font-semibold">
            이 문서에 출처·예문 보태기
          </summary>
          <form onSubmit={handleSubmit} className="space-y-3 px-4 pb-4" aria-describedby={`${formId}-help`}>
            <p id={`${formId}-help`} className="text-sm text-muted">
              이 밈을 처음 본 곳의 링크나 실제로 써 본 문장을 알려 주세요. 검수를 거쳐 이
              문서에 바로 붙어요.
            </p>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">무엇을 보탤까요</legend>
              {(
                [
                  ["source", "출처 링크"],
                  ["example", "사용 예문"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-base ${
                    kind === value
                      ? "border-signal-cyan bg-surface font-semibold text-foreground"
                      : "border-border text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-kind`}
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {kind === "source" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">링크</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://"
                    maxLength={500}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">어떤 자료인가요? (선택)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="예: 처음 퍼진 유튜브 영상, 관련 기사"
                    maxLength={300}
                    className={inputCls}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">어떤 상황에서 썼나요?</span>
                  <input
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder="예: 친구 단톡방에서 시험이 끝났을 때"
                    maxLength={120}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">실제로 쓴 문장</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className={`${inputCls} resize-y`}
                  />
                </label>
              </>
            )}

            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={creditPublic}
                onChange={(e) => setCreditPublic(e.target.checked)}
                className="size-4"
              />
              반영되면 내 닉네임을 기여자로 표시해 주세요
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "보내는 중…" : "검수 요청 보내기"}
            </button>

            {notice && (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className="text-base"
                style={{
                  color: notice.kind === "error" ? "var(--safety-red)" : "var(--safety-green)",
                }}
              >
                {notice.message}
                {notice.loginLink && (
                  <>
                    {" "}
                    <Link
                      href={`/login?next=${encodeURIComponent(`${pathname}#${CONTRIBUTE_ANCHOR}-${kind}`)}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      로그인하고 이어서 쓰기
                    </Link>
                  </>
                )}
              </p>
            )}
          </form>
        </details>
      )}
    </div>
  );
}
