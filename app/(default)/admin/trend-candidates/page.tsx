import type { Metadata } from "next";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { TrendCandidateReviewForm } from "./review-form";
import { TrendCandidateSignalReviewForm } from "./signal-review-form";
import { TrendCandidateEntryPanel } from "./entry-form";

export const metadata: Metadata = { title: "외부 확산 후보 검수" };
export const dynamic = "force-dynamic";

type CandidateRow = {
  id: string;
  display_name: string;
  aliases: string[];
  candidate_kind: string;
  status: string;
  external_state: string;
  external_score: number | null;
  confidence: number;
  independent_use_count: number;
  comparable_growth: boolean;
  discovery_reason: string;
  first_discovered_at: string;
  content_published_at: string | null;
  last_assessed_at: string | null;
  score_components: unknown;
  ai_draft: unknown;
  source_policy_keys: string[];
  memes: { title: string; short_id: string; slug: string } | null;
  trend_candidate_signals: Array<{
    signal_id: string;
    relationship: string;
    relationship_reviewed: boolean;
    counts_as_independent: boolean;
    external_signals: {
      platform: string;
      connector_key: string;
      canonical_url: string | null;
      creator_key: string | null;
      published_at: string | null;
      observed_at: string;
      availability_status: string;
    } | null;
  }>;
};

type SourcePolicyRow = {
  policy_key: string;
  platform: string;
  collectable_fields: string[];
  derived_analysis_allowed: boolean;
  cross_platform_combination_allowed: boolean;
  retention_days: number;
  approval_basis: string;
  verified_at: string;
  enabled: boolean;
};

type CollectionRunRow = {
  connector_key: string;
  discovery_lane: string;
  status: string;
  attempt_count: number;
  calls_used: number;
  cost_units: number;
  candidate_count: number;
  started_at: string | null;
  finished_at: string | null;
  retry_after: string | null;
  last_error: string | null;
  created_at: string;
};

type MetricSnapshotRow = {
  signal_id: string;
  policy_key: string;
  metric_name: string;
  metric_class: string;
  value: number | null;
  unit: string;
  observation_scope: string;
  missing_reason: string | null;
  observed_at: string;
  collected_at: string;
  retention_until: string;
};

type ReviewHistoryRow = {
  candidate_id: string;
  decision: string;
  note: string | null;
  public_summary: string | null;
  created_at: string;
};

type AdminQueryResult = { data: unknown; error: { message: string } | null };
type AdminQuery = PromiseLike<AdminQueryResult> & {
  select(columns: string): AdminQuery;
  in(column: string, values: string[]): AdminQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): AdminQuery;
  limit(count: number): AdminQuery;
};
type AdminTrendClient = { from(table: string): AdminQuery };

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatted(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return "표시할 수 없음"; }
}

export default async function TrendCandidatesPage() {
  const { supabase } = await requireOperatorPage("/admin/trend-candidates");
  const { data, error } = await supabase
    .from("trend_candidates")
    .select("id, display_name, aliases, candidate_kind, status, external_state, external_score, confidence, independent_use_count, comparable_growth, discovery_reason, first_discovered_at, content_published_at, last_assessed_at, score_components, ai_draft, source_policy_keys, memes(title, short_id, slug), trend_candidate_signals(signal_id, relationship, relationship_reviewed, counts_as_independent, external_signals(platform, connector_key, canonical_url, creator_key, published_at, observed_at, availability_status))")
    .in("status", ["discovered", "evidence_review", "held"])
    .order("last_assessed_at", { ascending: false, nullsFirst: false })
    .order("first_discovered_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as CandidateRow[];
  const candidateIds = rows.map((row) => row.id);
  const signalIds = rows.flatMap((row) => row.trend_candidate_signals.map((link) => link.signal_id));
  const adminDb = supabase as unknown as AdminTrendClient;
  const [policyResult, runResult, snapshotResult, reviewResult] = await Promise.all([
    adminDb.from("radar_source_policies")
      .select("policy_key, platform, collectable_fields, derived_analysis_allowed, cross_platform_combination_allowed, retention_days, approval_basis, verified_at, enabled")
      .order("platform", { ascending: true }),
    adminDb.from("radar_collection_runs")
      .select("connector_key, discovery_lane, status, attempt_count, calls_used, cost_units, candidate_count, started_at, finished_at, retry_after, last_error, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    signalIds.length > 0
      ? adminDb.from("radar_metric_snapshots")
        .select("signal_id, policy_key, metric_name, metric_class, value, unit, observation_scope, missing_reason, observed_at, collected_at, retention_until")
        .in("signal_id", signalIds)
        .order("observed_at", { ascending: false })
        .limit(300)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length > 0
      ? adminDb.from("trend_candidate_reviews")
        .select("candidate_id, decision, note, public_summary, created_at")
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false })
        .limit(300)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const policies = (policyResult.data ?? []) as SourcePolicyRow[];
  const runs = (runResult.data ?? []) as CollectionRunRow[];
  const snapshots = (snapshotResult.data ?? []) as MetricSnapshotRow[];
  const reviews = (reviewResult.data ?? []) as ReviewHistoryRow[];
  const snapshotsBySignal = Map.groupBy(snapshots, (snapshot) => snapshot.signal_id);
  const reviewsByCandidate = Map.groupBy(reviews, (review) => review.candidate_id);
  const integrationReadError = policyResult.error || runResult.error || snapshotResult.error || reviewResult.error;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">외부 확산 후보 검수</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          후보 발견과 유행 판정을 분리합니다. AI 초안은 비신뢰 참고 자료이며, 독립 사용례·성장 근거·정책 허용 범위를 확인한 뒤에만 기존 밈 상세에 공개합니다.
        </p>
      </div>
      <TrendCandidateEntryPanel />
      <section aria-labelledby="trend-integration-title" className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 id="trend-integration-title" className="text-lg font-bold">수집 연동 상태</h2>
          <p className="mt-1 text-xs text-muted">저장된 정책과 최근 실행 기록입니다. 키나 인증정보는 표시하지 않습니다.</p>
        </div>
        {integrationReadError ? <p role="alert" className="text-sm text-danger">연동 상태 일부를 불러오지 못했어요. 마이그레이션 적용 여부를 확인해 주세요.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {policies.length === 0 ? <p className="text-sm text-muted">등록된 수집 정책이 없습니다.</p> : policies.map((policy) => (
            <article key={policy.policy_key} className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{policy.platform} · {policy.policy_key}</h3>
                <span className={policy.enabled ? "text-accent" : "text-muted"}>{policy.enabled ? "활성" : "비활성"}</span>
              </div>
              <p className="mt-2 text-muted">수집 필드: {policy.collectable_fields.join(", ") || "없음"}</p>
              <p className="text-muted">파생 분석 {policy.derived_analysis_allowed ? "허용" : "미허용"} · 플랫폼 결합 {policy.cross_platform_combination_allowed ? "허용" : "미허용"} · 보존 {policy.retention_days}일</p>
              <p className="mt-1 text-muted">승인 근거: {policy.approval_basis}</p>
              <p className="text-muted">확인: {dateFormatter.format(new Date(policy.verified_at))}</p>
            </article>
          ))}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">최근 수집 실행 {runs.length}건</summary>
          {runs.length === 0 ? <p className="mt-2 text-xs text-muted">실행 기록이 없습니다.</p> : (
            <ul className="mt-2 space-y-2">
              {runs.map((run, index) => (
                <li key={`${run.connector_key}:${run.created_at}:${index}`} className="rounded-xl border border-border bg-background p-3 text-xs">
                  <p className="font-semibold">{run.connector_key} · {run.discovery_lane} · {run.status}</p>
                  <p className="mt-1 text-muted">호출 {run.calls_used} · 비용 단위 {run.cost_units} · 후보 {run.candidate_count} · 시도 {run.attempt_count}</p>
                  <p className="text-muted">생성 {dateFormatter.format(new Date(run.created_at))}{run.finished_at ? ` · 종료 ${dateFormatter.format(new Date(run.finished_at))}` : ""}</p>
                  {run.retry_after ? <p className="text-muted">재시도 예정 {dateFormatter.format(new Date(run.retry_after))}</p> : null}
                  {run.last_error ? <p className="mt-1 break-words text-danger">마지막 오류: {run.last_error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger p-4 text-sm text-danger">후보 큐를 불러오지 못했어요. 로컬 DB 마이그레이션 적용 여부를 확인해 주세요.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">검수 대기 후보가 없어요. 예시 데이터로 빈자리를 채우지 않습니다.</p>
      ) : (
        <ul className="space-y-5">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{row.display_name}</h2>
                  <p className="mt-1 text-sm text-muted">{row.memes ? `기존 밈 연결: ${row.memes.title}` : "기존 밈 연결 대기"} · {row.candidate_kind} · {row.external_state}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>독립 사용례 {row.independent_use_count}건</p>
                  <p>비교 성장 {row.comparable_growth ? "확인" : "미확인"}</p>
                  <p>근거 충실도 {Math.round(row.confidence * 100)}%</p>
                </div>
              </div>
              <p className="mt-4 text-sm">{row.discovery_reason}</p>
              <dl className="mt-4 grid gap-3 text-xs text-muted sm:grid-cols-3">
                <div><dt>원문 게시</dt><dd>{row.content_published_at ? dateFormatter.format(new Date(row.content_published_at)) : "미확인"}</dd></div>
                <div><dt>최초 발견</dt><dd>{dateFormatter.format(new Date(row.first_discovered_at))}</dd></div>
                <div><dt>마지막 측정</dt><dd>{row.last_assessed_at ? dateFormatter.format(new Date(row.last_assessed_at)) : "미측정"}</dd></div>
              </dl>
              <details className="mt-4 rounded-xl bg-background p-3">
                <summary className="cursor-pointer text-sm font-semibold">점수 구성·AI 초안 보기</summary>
                <p className="mt-2 text-xs text-muted">허용 정책: {row.source_policy_keys.join(", ") || "미확인"}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted">{formatted({ scoreComponents: row.score_components, aiDraft: row.ai_draft })}</pre>
              </details>
              <section className="mt-4" aria-label="후보 사용례 분류">
                <h3 className="text-sm font-bold">수집된 사용례</h3>
                <p className="mt-1 text-xs text-muted">다른 작성자의 독립 변형인지, 재업로드·크로스포스팅·재전재인지 원문을 열어 분류해 주세요.</p>
                <ul className="mt-3 space-y-3">
                  {row.trend_candidate_signals.map((link) => (
                    <li key={link.signal_id} className="rounded-xl border border-border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{link.external_signals?.platform ?? "출처 미확인"}</span>
                        <span>{link.external_signals?.connector_key ?? "수집기 미확인"}</span>
                        <span>{link.external_signals?.creator_key ? "작성자 식별 가능" : "작성자 식별 불가"}</span>
                        <span>{link.external_signals?.availability_status ?? "상태 미확인"}</span>
                        {link.relationship_reviewed ? <span className="text-accent">검수됨</span> : null}
                      </div>
                      {link.external_signals?.canonical_url ? (
                        <a href={link.external_signals.canonical_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">원문 열기 ↗</a>
                      ) : <p className="mt-2 text-xs text-muted">원문 URL 없음</p>}
                      {(snapshotsBySignal.get(link.signal_id) ?? []).length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-semibold">원시 측정 기록</summary>
                          <ul className="mt-2 space-y-1 text-xs text-muted">
                            {(snapshotsBySignal.get(link.signal_id) ?? []).map((snapshot) => (
                              <li key={`${snapshot.metric_name}:${snapshot.observed_at}`} className="rounded-lg border border-border p-2">
                                <span className="font-semibold text-foreground">{snapshot.metric_name}</span>{" "}
                                {snapshot.value === null ? `결측 · ${snapshot.missing_reason ?? "사유 미기록"}` : `${snapshot.value} ${snapshot.unit}`}
                                {` · ${snapshot.metric_class} · ${snapshot.observation_scope} · ${dateFormatter.format(new Date(snapshot.observed_at))}`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : <p className="mt-2 text-xs text-muted">측정 기록 없음</p>}
                      <TrendCandidateSignalReviewForm candidateId={row.id} signalId={link.signal_id} currentRelationship={link.relationship} />
                    </li>
                  ))}
                </ul>
              </section>
              {(reviewsByCandidate.get(row.id) ?? []).length > 0 ? (
                <details className="mt-4 rounded-xl bg-background p-3">
                  <summary className="cursor-pointer text-sm font-semibold">검수 이력 {(reviewsByCandidate.get(row.id) ?? []).length}건</summary>
                  <ol className="mt-2 space-y-2 text-xs text-muted">
                    {(reviewsByCandidate.get(row.id) ?? []).map((review, index) => (
                      <li key={`${review.created_at}:${index}`}>
                        <span className="font-semibold text-foreground">{review.decision}</span> · {dateFormatter.format(new Date(review.created_at))}
                        {review.note ? <p className="whitespace-pre-wrap">{review.note}</p> : null}
                        {review.public_summary ? <p className="whitespace-pre-wrap">공개 설명: {review.public_summary}</p> : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
              <TrendCandidateReviewForm
                candidateId={row.id}
                evidenceLinks={row.trend_candidate_signals.flatMap((link, index) =>
                  link.relationship === "independent" && link.relationship_reviewed && link.counts_as_independent &&
                  link.external_signals?.availability_status === "available" && link.external_signals.canonical_url
                    ? [{ label: `${link.external_signals.platform} 독립 사용례 ${index + 1}`, url: link.external_signals.canonical_url }]
                    : [],
                )}
                signals={row.trend_candidate_signals.map((link) => ({
                  id: link.signal_id,
                  label: `${link.external_signals?.platform ?? "출처 미확인"} · ${link.external_signals?.canonical_url ?? link.signal_id}`,
                }))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
