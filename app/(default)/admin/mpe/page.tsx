import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { MpeUploadForm } from "@/components/admin/mpe-upload-form";

export const metadata = { title: "MPE 검수 큐" };
export const dynamic = "force-dynamic";

type QueueCandidate = {
  id: string;
  ingestion_id: string;
  title: string;
  meme_type: string;
  review_status: string;
  overall_confidence: number | null;
  created_at: string;
  media_ingestions: {
    ingest_mode: string;
    mime_type: string;
    media_sources: { platform: string; title: string | null } | null;
  } | null;
};

type QueueJob = {
  ingestion_id: string;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  FACT_CHECKING: "사실 검수",
  RIGHTS_CHECKING: "권리 검수",
  PUBLISH: "공개 결정",
  APPROVED: "공개 승인",
  LIMITED: "제한 공개",
  REJECTED: "반려",
};

export default async function AdminMpePage() {
  const { supabase } = await requireOperatorPage("/admin/mpe");
  const { data, error } = await supabase
    .from("meme_candidates")
    .select("id, ingestion_id, title, meme_type, review_status, overall_confidence, created_at, media_ingestions(ingest_mode, mime_type, media_sources(platform, title))")
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<QueueCandidate[]>();
  if (error) throw new Error(`MPE 후보를 불러오지 못했어요: ${error.message}`);

  const candidates = data ?? [];
  const ingestionIds = [...new Set(candidates.map((candidate) => candidate.ingestion_id))];
  const jobsByIngestion = new Map<string, Record<string, number>>();
  if (ingestionIds.length) {
    const { data: jobs, error: jobsError } = await supabase
      .from("processing_jobs")
      .select("ingestion_id, status")
      .in("ingestion_id", ingestionIds)
      .returns<QueueJob[]>();
    if (jobsError) throw new Error(`MPE 작업 상태를 불러오지 못했어요: ${jobsError.message}`);
    for (const job of jobs ?? []) {
      const counts = jobsByIngestion.get(job.ingestion_id) ?? {};
      counts[job.status] = (counts[job.status] ?? 0) + 1;
      jobsByIngestion.set(job.ingestion_id, counts);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MPE 검수 큐</h1>
        <p className="mt-1 text-sm text-muted">근거가 연결된 멀티모달 초안을 사실 → 권리 → 공개 순서로 검수합니다.</p>
      </div>

      <MpeUploadForm />

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">검수할 MPE 후보가 없어요.</div>
      ) : (
        <ul className="space-y-3">
          {candidates.map((candidate) => {
            const source = candidate.media_ingestions?.media_sources;
            const jobs = jobsByIngestion.get(candidate.ingestion_id) ?? {};
            return (
              <li key={candidate.id}>
                <Link href={`/admin/mpe/${candidate.id}`} className="block rounded-xl border border-border bg-surface p-5 hover:border-accent">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{candidate.title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {candidate.meme_type} · {source?.platform ?? candidate.media_ingestions?.mime_type ?? "미디어 없음"}
                        {source?.title ? ` · ${source.title}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                      {STATUS_LABEL[candidate.review_status] ?? candidate.review_status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    작업 {Object.entries(jobs).map(([status, count]) => `${status} ${count}`).join(" · ") || "없음"}
                    {candidate.overall_confidence === null ? "" : ` · 자동 분석 참고값 ${Math.round(candidate.overall_confidence * 100)}%`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
