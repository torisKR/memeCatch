"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type HarvestResponse = {
  ok: boolean;
  error?: string;
  summary: { total: number; created: number; skipped: number; nextOffset: number | null };
  results: Array<{ title: string; year: number; status: string }>;
};

export function MemeHarvestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [result, setResult] = useState<{
    summary: { total: number; created: number; skipped: number };
    results: Array<{ title: string; year: number; status: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleHarvest = async () => {
    if (!confirm("중복 검사를 거쳐 최대 1,000개 후보를 검수 대기 상태로 저장할까요? 사실·출처·권리 확인 후 별도로 게시해야 합니다.")) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    let currentOffset: number | null = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalPool = 0;
    const accumulatedResults: Array<{ title: string; year: number; status: string }> = [];

    try {
      while (currentOffset !== null) {
        setProgressText(`수집 진행 중... (${totalCreated}건 생성됨 / 오프셋 ${currentOffset})`);
        const res: Response = await fetch("/api/admin/harvest-memes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: currentOffset, limit: 100 }),
        });
        const data: HarvestResponse = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "적재 중 오류가 발생했습니다.");
        }

        totalCreated += data.summary.created;
        totalSkipped += data.summary.skipped;
        totalPool = data.summary.total;
        if (Array.isArray(data.results)) {
          accumulatedResults.push(...data.results);
        }

        currentOffset = data.summary.nextOffset;
      }

      setResult({
        summary: { total: totalPool, created: totalCreated, skipped: totalSkipped },
        results: accumulatedResults,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgressText("");
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleHarvest}
        disabled={loading}
        className="inline-flex min-h-11 items-center rounded-lg border border-accent bg-accent/10 px-4 text-base font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
      >
        {loading ? (progressText || "수집 및 중복 검사 중...") : "시대별 밈 대량 자동 수집·적재 (최대 1,000건)"}
      </button>

      {result && (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-foreground shadow-lg">
          <p className="font-semibold text-accent">
            후보 저장 완료: 검수 대기 {result.summary.created}건 / 중복 건너뜀 {result.summary.skipped}건 (총 {result.summary.total}건)
          </p>
          <div className="mt-2 max-h-48 overflow-y-auto text-xs text-muted-foreground">
            {result.results.map((r, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>[{r.year}년] {r.title}</span>
                <span className={r.status === "created" ? "font-bold text-accent" : "text-muted-foreground"}>
                  {r.status === "created" ? "검수 대기" : r.status === "error" ? "저장 실패" : "중복(제외)"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
