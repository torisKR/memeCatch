"use client";

import { useEffect, useRef, useState } from "react";
import { memePathFrom } from "@/lib/labels";

type ReferenceItem = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
};

type ReferenceResult = {
  mode: "hybrid" | "keyword";
  reason?: "disabled" | "model_unavailable" | "index_empty" | "rpc_unavailable";
  items: ReferenceItem[];
};

type SearchState =
  | { status: "idle" | "pending" | "cancelled" | "error" }
  | { status: "ready"; result: ReferenceResult };

const FALLBACK_MESSAGE = "의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.";
const RIGHTS_MESSAGE = "참고 자료이며 재사용 권한은 별도로 확인해 주세요.";
const REASONS = new Set(["disabled", "model_unavailable", "index_empty", "rpc_unavailable"]);

function readResult(value: unknown): ReferenceResult {
  if (!value || typeof value !== "object") throw new Error("invalid_response");
  const record = value as Record<string, unknown>;
  if ((record.mode !== "hybrid" && record.mode !== "keyword")
    || !Array.isArray(record.items) || record.items.length > 12
    || (record.reason !== undefined && (typeof record.reason !== "string" || !REASONS.has(record.reason)))) {
    throw new Error("invalid_response");
  }
  const items = record.items.map((value: unknown): ReferenceItem => {
    if (!value || typeof value !== "object") throw new Error("invalid_item");
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id.trim()
      || typeof row.short_id !== "string" || !/^[a-zA-Z0-9]{1,32}$/.test(row.short_id)
      || typeof row.slug !== "string" || !row.slug.trim()
      || typeof row.title !== "string" || !row.title.trim()
      || typeof row.summary !== "string") {
      throw new Error("invalid_item");
    }
    // Also rejects malformed Unicode that cannot form a safely encoded path.
    memePathFrom(row.short_id, row.slug);
    return { id: row.id, short_id: row.short_id, slug: row.slug, title: row.title, summary: row.summary };
  });
  return {
    mode: record.mode,
    reason: record.reason as ReferenceResult["reason"],
    items,
  };
}

export function MemeReferenceSearch({
  query,
  variant = "search",
}: {
  query: string;
  variant?: "search" | "studio";
}) {
  const trimmed = query.trim();
  // A new query owns a fresh result and request lifetime; typing never fetches.
  return <ReferenceSearch key={trimmed} query={trimmed} variant={variant} />;
}

function ReferenceSearch({ query, variant }: { query: string; variant: "search" | "studio" }) {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const requestRef = useRef<AbortController | null>(null);
  const validQuery = query.length >= 2 && query.length <= 120;
  const pending = state.status === "pending";
  const actionLabel = variant === "studio" ? "제작 참고 밈 찾기" : "상황·의미로 찾기";

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  async function search() {
    if (requestRef.current) {
      requestRef.current.abort();
      requestRef.current = null;
      setState({ status: "cancelled" });
      return;
    }
    if (!validQuery) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ status: "pending" });
    try {
      const response = await fetch("/api/memes/semantic-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, limit: 12 }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("request_failed");
      const value: unknown = await response.json();
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setState({ status: "ready", result: readResult(value) });
    } catch {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setState({ status: "error" });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  return (
    <section aria-label={variant === "studio" ? "제작 참고 밈" : "상황에 맞는 밈"}
      className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <button type="button" onClick={() => { void search(); }} disabled={!validQuery}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "검색 취소" : actionLabel}
      </button>
      <p className="mt-2 text-xs text-muted">{RIGHTS_MESSAGE}</p>
      <div role="status" aria-live="polite" className="mt-3 text-sm text-muted">
        {pending && <p>참고할 밈을 찾고 있어요.</p>}
        {state.status === "cancelled" && <p>검색을 취소했어요.</p>}
        {state.status === "ready" && state.result.mode === "keyword" && <p>{FALLBACK_MESSAGE}</p>}
        {state.status === "ready" && state.result.items.length === 0 && (
          <p>{state.result.reason === "index_empty"
            ? "아직 참고 자료가 준비되지 않았어요. 다른 검색어로 찾아보세요."
            : "참고할 밈을 찾지 못했어요. 다른 검색어로 찾아보세요."}</p>
        )}
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-muted">밈을 찾지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}
      {state.status === "ready" && state.result.items.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {state.result.items.map((item) => (
            <li key={item.id}>
              <a href={memePathFrom(item.short_id, item.slug)}
                className="block rounded-xl border border-border p-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent">
                <span className="block font-semibold">{item.title}</span>
                <span className="mt-1 block text-sm text-muted">{item.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
