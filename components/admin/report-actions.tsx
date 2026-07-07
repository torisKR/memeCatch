"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { handleReport, setDiscussionVisibility } from "@/lib/actions/admin";

export function ReportActions({
  reportId,
  discussion,
}: {
  reportId: string;
  discussion: { id: string; status: "visible" | "hidden" | "deleted" } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(action: "resolved" | "dismissed") {
    setError(null);
    startTransition(async () => {
      const res = await handleReport({ reportId, action });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function setVisibility(status: "visible" | "hidden") {
    setError(null);
    startTransition(async () => {
      const res = await setDiscussionVisibility({ discussionId: discussion!.id, status });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-lg bg-safety-red-bg p-3 text-base text-safety-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve("resolved")}
          className="min-h-11 rounded-lg bg-accent px-4 text-base font-semibold text-background disabled:opacity-50"
        >
          처리 완료 (resolve)
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve("dismissed")}
          className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:opacity-50"
        >
          기각 (dismiss)
        </button>
        {discussion && discussion.status !== "deleted" && (
          discussion.status === "hidden" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setVisibility("visible")}
              className="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-4 text-base font-semibold text-safety-green disabled:opacity-50"
            >
              댓글 숨김 해제
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setVisibility("hidden")}
              className="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-base font-semibold text-safety-yellow disabled:opacity-50"
            >
              댓글 숨기기
            </button>
          )
        )}
      </div>
    </div>
  );
}
