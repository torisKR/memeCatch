import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import {
  auditTopSeoMemes,
  summarizeSeoReadiness,
  type SeoAuditMeme,
  type SeoReadinessCheck,
} from "@/lib/growth/seo-readiness";
import {
  parseGrowthPilotDashboard,
  summarizeGrowthPilot,
  type EnglishPilotStatus,
} from "@/lib/growth/pilot";
import {
  GROWTH_KPI_IDS,
  growthKpiAdvisory,
  parseGrowthKpiDashboard,
  type GrowthKpiId,
} from "@/lib/growth/kpi";
import { recordGrowthPilotInterview, saveEnglishPilotSlot } from "./actions";

export const metadata = { title: "성장 운영" };
export const dynamic = "force-dynamic";

type GrowthRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

type RelatedCountRow = { meme_id: string; related_count: number };

const CHECK_LABELS: Record<SeoReadinessCheck, string> = {
  title: "고유 title",
  description: "고유 description",
  canonical: "canonical",
  openGraph: "OG",
  relatedLinks: "관련 링크",
  completeness: "완성도",
};

const STATUS_LABELS: Record<EnglishPilotStatus, string> = {
  open: "비어 있음",
  assigned: "배정",
  ready: "발행 준비",
  published: "발행",
  paused: "보류",
};

const KPI_LABELS: Record<GrowthKpiId, string> = {
  activation: "활성화",
  account: "계정 전환",
  conversion: "Paywall → Checkout",
  payment: "Checkout → 결제",
  renewal: "30일 재구매",
  usage: "유료 사용자 월 복사",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export default async function AdminGrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireOperatorPage("/admin/growth");
  const { data: campaign, error: campaignError } = await supabase
    .from("seo_campaigns")
    .select("id")
    .in("state", ["ready", "in_progress", "measurement_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (campaignError) throw new Error(`SEO 캠페인을 확인하지 못했어요: ${campaignError.message}`);

  const { data: campaignItems, error: campaignItemsError } = campaign
    ? await supabase
        .from("seo_campaign_items")
        .select("meme_id, batch, created_at, id")
        .eq("campaign_id", campaign.id)
        .eq("bucket", "target")
        .order("batch", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(100)
    : { data: null, error: null };
  if (campaignItemsError) {
    throw new Error(`SEO 캠페인 대상을 불러오지 못했어요: ${campaignItemsError.message}`);
  }
  const targetIds = campaignItems?.map((item) => item.meme_id) ?? [];

  let memeQuery = supabase
    .from("memes")
    .select(
      "id, short_id, slug, title, summary, description, origin, origin_year, usage_note, caution, usage_examples, category, trend_score, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
    )
    .in("moderation_status", ["approved", "limited"]);
  memeQuery = campaign
    ? targetIds.length > 0
      ? memeQuery.in("id", targetIds)
      : memeQuery.eq("id", "00000000-0000-0000-0000-000000000000")
    : memeQuery
        .order("trend_score", { ascending: false })
        .order("id", { ascending: true })
        .limit(100);

  const [{ data: memeRows, error: memeError }, dashboardResult, kpiResult, notice] = await Promise.all([
    memeQuery,
    (supabase.rpc as unknown as GrowthRpc)("get_growth_pilot_dashboard"),
    (supabase.rpc as unknown as GrowthRpc)("get_growth_kpi_dashboard"),
    searchParams,
  ]);

  if (memeError) throw new Error(`Top-100 SEO 데이터를 불러오지 못했어요: ${memeError.message}`);
  if (dashboardResult.error) {
    throw new Error(`영문 파일럿 데이터를 불러오지 못했어요: ${dashboardResult.error.message}`);
  }
  if (kpiResult.error) {
    throw new Error(`성장 KPI를 불러오지 못했어요: ${kpiResult.error.message}`);
  }

  const relatedResult = await (supabase.rpc as unknown as GrowthRpc)(
    "get_growth_seo_related_counts",
    { p_meme_ids: (memeRows ?? []).map((row) => row.id) },
  );
  if (relatedResult.error) {
    throw new Error(`SEO 관련 링크를 검사하지 못했어요: ${relatedResult.error.message}`);
  }
  const relatedCounts = new Map(
    (relatedResult.data as RelatedCountRow[]).map((row) => [row.meme_id, Number(row.related_count)]),
  );
  const seoRows = auditTopSeoMemes((memeRows ?? []) as SeoAuditMeme[], {
    targetIds: campaign ? targetIds : undefined,
    relatedCounts,
  });
  const seoSummary = summarizeSeoReadiness(seoRows);
  const dashboard = parseGrowthPilotDashboard(dashboardResult.data);
  const pilotSummary = summarizeGrowthPilot(dashboard);
  const kpiDashboard = parseGrowthKpiDashboard(kpiResult.data);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold">성장 운영</h1>
        <p className="mt-1 text-sm text-muted">
          Top-100 검색 랜딩 준비도와 영어 Plus 파일럿의 실제 진행 상태를 한곳에서 확인합니다.
        </p>
      </header>

      {notice.error && (
        <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">
          {notice.error}
        </p>
      )}
      {notice.saved && (
        <p role="status" className="rounded-xl border border-border bg-surface p-3 text-sm">
          {notice.saved}
        </p>
      )}

      <section className="space-y-4" aria-labelledby="growth-kpi-heading">
        <div>
          <h2 id="growth-kpi-heading" className="text-xl font-bold">성장 KPI 판단판</h2>
          <p className="mt-1 text-sm text-muted">
            최신 내구성 baseline과 이벤트 원장만 사용합니다. 아래 상태는 기획서 임계값에 따른
            운영 참고이며 제품·가격·유입을 자동으로 변경하지 않습니다.
          </p>
          {kpiDashboard.periodStart && kpiDashboard.periodEnd && (
            <p className="mt-1 text-xs text-muted">
              집계 기간 {dateFormatter.format(new Date(kpiDashboard.periodStart))} ~{" "}
              {dateFormatter.format(new Date(kpiDashboard.periodEnd))}
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GROWTH_KPI_IDS.map((id) => {
            const metric = kpiDashboard.metrics[id];
            const advisory = growthKpiAdvisory(id, metric);
            return (
              <article key={id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{KPI_LABELS[id]}</h3>
                  <span className="text-xs text-muted">목표 {advisory.target}</span>
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums">
                  {metric.available && metric.value !== null
                    ? `${metric.value}${id === "usage" ? "회" : "%"}`
                    : "insufficient data"}
                </div>
                {metric.available && (
                  <p className="mt-1 text-xs text-muted">
                    {metric.numerator} / {metric.denominator}
                  </p>
                )}
                <p
                  className={`mt-3 text-sm ${
                    advisory.state === "action" || advisory.state === "below"
                      ? "text-danger"
                      : "text-muted"
                  }`}
                >
                  {advisory.message}
                </p>
              </article>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          계정 전환은 저장 의도와 동일 세션의 후속 인증 이벤트가 모두 확인된 경우만 집계합니다.
          재구매·월 복사는 장기 커버리지와 적격 유료 코호트가 없으면 계산하지 않습니다.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="seo-audit-heading">
        <div>
          <h2 id="seo-audit-heading" className="text-xl font-bold">Top-100 SEO 준비도</h2>
          <p className="mt-1 text-sm text-muted">
            {campaign
              ? `${campaign.id} 캠페인의 대상 URL을 캠페인 순서로 감사합니다.`
              : "활성 SEO 캠페인이 없어 트렌드 점수 상위 URL을 감사합니다."}{" "}
            title, description, canonical, OG, 전체 공개 코퍼스의 관련 링크, 콘텐츠 완성도를
            동일한 규칙으로 다시 계산합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="감사 대상" value={`${seoSummary.audited}/100`} />
          <Metric label="준비 완료" value={String(seoSummary.ready)} />
          <Metric label="보완 필요" value={String(seoSummary.blocked)} />
          <Metric label="완료율" value={`${seoSummary.completionPercentage}%`} />
        </div>
        {seoSummary.coverageGap > 0 && (
          <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">
            Top-100 감사 대상이 {seoSummary.coverageGap}개 부족합니다. 콘텐츠 또는 SEO 캠페인
            대상 데이터를 채우기 전에는 완료로 볼 수 없습니다.
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2">순위</th>
                <th className="px-3 py-2">밈</th>
                <th className="px-3 py-2">준비도</th>
                <th className="px-3 py-2">완성도</th>
                <th className="px-3 py-2">점검</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {seoRows.map((row) => (
                <tr key={row.memeId}>
                  <td className="px-3 py-3 tabular-nums">{row.rank}</td>
                  <td className="px-3 py-3">
                    <Link href={row.path} className="font-medium text-accent-text underline">
                      {row.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted">관련 후보 {row.relatedLinkCount}개</div>
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{row.readinessScore}%</td>
                  <td className="px-3 py-3 tabular-nums">{row.completenessScore}%</td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-72 flex-wrap gap-1.5">
                      {(Object.keys(CHECK_LABELS) as SeoReadinessCheck[]).map((check) => (
                        <span
                          key={check}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            row.checks[check]
                              ? "bg-surface-2 text-foreground"
                              : "border border-danger text-danger"
                          }`}
                        >
                          {CHECK_LABELS[check]}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="english-pilot-heading">
        <div>
          <h2 id="english-pilot-heading" className="text-xl font-bold">영어 Plus 파일럿</h2>
          <p className="mt-1 text-sm text-muted">
            최신 원문 기준으로 검수 완료된 영어 번역만 배정할 수 있습니다. 슬롯 생성은 운영
            준비 상태이며 실제 인터뷰나 사용자 반응을 뜻하지 않습니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric label="랜딩 슬롯" value={`${pilotSummary.assigned}/20`} />
          <Metric label="발행 준비" value={String(pilotSummary.ready)} />
          <Metric label="발행" value={`${pilotSummary.published}/20`} />
          <Metric label="실제 인터뷰" value={`${pilotSummary.interviews}/10`} />
          <Metric label="파일럿 완료" value={pilotSummary.complete ? "완료" : "미완료"} />
        </div>
        {pilotSummary.stale > 0 && (
          <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">
            원문 변경 또는 필수 영문 본문 누락으로 무효화된 슬롯이 {pilotSummary.stale}개 있습니다.
          </p>
        )}
        <p
          role="status"
          className={`rounded-xl border p-4 text-sm font-medium ${
            pilotSummary.interviewGateMet
              ? "border-border bg-surface"
              : "border-danger text-danger"
          }`}
        >
          외부 검증 게이트: 실제 해외 사용자 인터뷰 10건이 필요합니다. 현재 {pilotSummary.interviews}건이며,
          기록이 없는 인터뷰는 완료로 계산하지 않습니다.
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.slots.map((slot) => (
            <form
              key={slot.slot}
              action={saveEnglishPilotSlot}
              className="space-y-3 rounded-xl border border-border bg-surface p-4"
            >
              <input type="hidden" name="slot" value={slot.slot} />
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">슬롯 {slot.slot}</h3>
                {slot.landingPath && (
                  <Link href={slot.landingPath} className="text-sm text-accent-text underline">
                    랜딩 보기
                  </Link>
                )}
              </div>
              {slot.memeId && !slot.translationCurrent && (
                <p role="alert" className="text-sm text-danger">
                  이 슬롯의 영문 랜딩은 현재 공개 요건을 충족하지 않습니다.
                </p>
              )}
              <label className="block text-sm font-medium">
                영문 랜딩
                <select
                  name="memeId"
                  defaultValue={slot.memeId ?? ""}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
                >
                  <option value="">선택 안 함</option>
                  {dashboard.candidates.map((candidate) => (
                    <option key={candidate.memeId} value={candidate.memeId}>
                      {candidate.englishTitle} · {candidate.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                상태
                <select
                  name="status"
                  defaultValue={slot.status}
                  className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
                >
                  {(Object.keys(STATUS_LABELS) as EnglishPilotStatus[]).map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                운영 메모
                <textarea
                  name="operatorNote"
                  defaultValue={slot.operatorNote}
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
              <button className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white">
                슬롯 저장
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="interview-ledger-heading">
        <div>
          <h2 id="interview-ledger-heading" className="text-xl font-bold">실제 인터뷰 원장</h2>
          <p className="mt-1 text-sm text-muted">
            실제로 진행한 인터뷰만 익명 참가자 참조값과 근거를 남겨 기록합니다. 초기 데이터는 없습니다.
          </p>
        </div>
        <form action={recordGrowthPilotInterview} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <Field label="참가자 참조값" name="participantReference" placeholder="예: interview-2026-001" />
          <Field label="인터뷰 시각" name="interviewedAt" type="datetime-local" />
          <Field label="시장" name="market" placeholder="예: United States" />
          <Field label="사용자군" name="segment" placeholder="예: K-content creator" />
          <label className="block text-sm font-medium sm:col-span-2">
            확인한 내용
            <textarea
              name="summary"
              required
              minLength={20}
              maxLength={4000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="사용자가 실제로 말한 문제, 현재 대안, 결제 의향을 사실대로 기록하세요."
            />
          </label>
          <Field label="근거 URL (선택)" name="evidenceUrl" type="url" placeholder="https://…" />
          <div className="flex items-end">
            <button className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white">
              실제 인터뷰 기록
            </button>
          </div>
        </form>

        {dashboard.interviews.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            기록된 실제 인터뷰가 없습니다.
          </p>
        ) : (
          <ol className="space-y-3">
            {dashboard.interviews.map((interview) => (
              <li key={interview.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>{interview.participantReference}</strong>
                  <time dateTime={interview.interviewedAt}>{dateFormatter.format(new Date(interview.interviewedAt))}</time>
                </div>
                <p className="mt-1 text-sm text-muted">{interview.market} · {interview.segment}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm">{interview.summary}</p>
                {interview.evidenceUrl && (
                  <a href={interview.evidenceUrl} className="mt-2 inline-block text-sm text-accent-text underline">
                    인터뷰 근거 열기
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={name !== "evidenceUrl"}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
      />
    </label>
  );
}
