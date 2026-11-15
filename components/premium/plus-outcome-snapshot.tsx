import type { PlusGlobalActionInboxCompletion } from "@/lib/plus-global-action-inbox";
import type { PlusOutcomeLedgerCopy } from "@/lib/plus-outcome-copy";
import type { Locale } from "@/lib/i18n";
import type {
  PlusOutcomeRatingRow,
  PlusOutcomeHistoryStatus,
  PlusOutcomeSummary,
  PlusOutcomeWinningReplay,
} from "@/lib/plus-outcome-ledger";
import { isPlusOutcomeLocale } from "@/lib/plus-outcome-ledger";

export type PlusOutcomeSnapshotCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  today: (count: number, streak: number) => string;
  ratings: (count: number) => string;
  savedResults: (count: number) => string;
  ratingsEmpty: string;
  mostUsed: string;
  openActions: string;
  openSavedResults: string;
  empty: string;
  unavailable: string;
  winningReplay: {
    eyebrow: string;
    title: string;
    description: string;
    basis: string;
    cta: string;
  };
};

export const PLUS_OUTCOME_SNAPSHOT_COPY: Record<
  "ko" | "en" | "ja" | "zh" | "zh-tw",
  PlusOutcomeSnapshotCopy
> = {
  ko: {
    eyebrow: "PLUS VALUE",
    title: "내가 실제로 만든 결과",
    intro: "추천을 넘어서, 최근 활용 기록과 다음 행동을 한눈에 확인해요.",
    today: (count, streak) => `오늘 ${count}회 활용 · ${streak}일 연속`,
    ratings: (count) => `최근 평가 ${count}건`,
    savedResults: (count) => `저장된 결과 ${count}건`,
    ratingsEmpty: "아직 평가 없음",
    mostUsed: "가장 많이 사용한 흐름",
    openActions: "오늘의 Action Inbox 열기",
    openSavedResults: "저장된 결과 보기",
    empty: "아직 활용 기록이 없어요. 오늘의 Action Inbox에서 첫 밈을 골라 보세요.",
    unavailable: "활용 성과를 불러오지 못했어요. 오늘의 Action Inbox는 계속 사용할 수 있어요.",
    winningReplay: {
      eyebrow: "다시 쓰기",
      title: "좋았던 활용을 오늘 다시 만들기",
      description: "최근 7일 동안 내가 ‘좋았어요’로 평가한 활용을 안전하게 다시 실행해요.",
      basis: "객관적 성과가 아니라 내 평가를 기준으로 골랐어요.",
      cta: "다시 만들기",
    },
  },
  en: {
    eyebrow: "PLUS VALUE",
    title: "What you actually created",
    intro: "See the value you used, recorded, and can act on next.",
    today: (count, streak) => `${count} used today · ${streak}-day streak`,
    ratings: (count) => `${count} recent ratings`,
    savedResults: (count) => `${count} saved results`,
    ratingsEmpty: "No ratings yet",
    mostUsed: "Most-used workflow",
    openActions: "Open today’s Action Inbox",
    openSavedResults: "Open saved results",
    empty: "No use recorded yet. Pick your first meme from today’s Action Inbox.",
    unavailable: "Your outcome snapshot is unavailable. Today’s Action Inbox is still available.",
    winningReplay: {
      eyebrow: "REUSE",
      title: "Recreate a use you marked as working",
      description: "Safely reopen one use you marked as working in the last 7 days.",
      basis: "This is based on your rating, not verified public performance.",
      cta: "Recreate this use",
    },
  },
  ja: {
    eyebrow: "PLUS VALUE",
    title: "実際に生み出した結果",
    intro: "使った記録と、次にできる行動をひと目で確認できます。",
    today: (count, streak) => `今日 ${count}件 · ${streak}日連続`,
    ratings: (count) => `最近の評価 ${count}件`,
    savedResults: (count) => `保存した結果 ${count}件`,
    ratingsEmpty: "評価はまだありません",
    mostUsed: "よく使う流れ",
    openActions: "今日のAction Inboxを開く",
    openSavedResults: "保存した結果を見る",
    empty: "まだ活用記録がありません。今日のAction Inboxから最初のミームを選びましょう。",
    unavailable: "活用結果を読み込めませんでした。今日のAction Inboxは利用できます。",
    winningReplay: {
      eyebrow: "再利用",
      title: "うまくいったと評価した活用をもう一度",
      description: "過去7日間に自分で「うまくいった」と評価した活用を安全に開き直せます。",
      basis: "公開成果の検証ではなく、あなたの評価を基準にしています。",
      cta: "この活用をもう一度作る",
    },
  },
  zh: {
    eyebrow: "PLUS VALUE",
    title: "你实际创造的成果",
    intro: "一眼查看已使用的内容、留下的记录，以及下一步行动。",
    today: (count, streak) => `今天使用 ${count} 次 · 连续 ${streak} 天`,
    ratings: (count) => `最近评价 ${count} 次`,
    savedResults: (count) => `已保存结果 ${count} 条`,
    ratingsEmpty: "还没有评价",
    mostUsed: "最常使用的流程",
    openActions: "打开今天的 Action Inbox",
    openSavedResults: "查看已保存结果",
    empty: "还没有使用记录。先从今天的 Action Inbox 选择一个迷因吧。",
    unavailable: "暂时无法加载成果摘要。今天的 Action Inbox 仍可使用。",
    winningReplay: {
      eyebrow: "再次使用",
      title: "再次制作你评价为有效的使用",
      description: "安全打开你在最近 7 天评价为有效的一次使用记录。",
      basis: "依据是你的评价，不是已验证的公开表现。",
      cta: "再次制作这次使用",
    },
  },
  "zh-tw": {
    eyebrow: "PLUS VALUE",
    title: "你實際創造的成果",
    intro: "一眼查看已使用的內容、留下的紀錄，以及下一步行動。",
    today: (count, streak) => `今天使用 ${count} 次 · 連續 ${streak} 天`,
    ratings: (count) => `最近評價 ${count} 次`,
    savedResults: (count) => `已儲存結果 ${count} 筆`,
    ratingsEmpty: "尚無評價",
    mostUsed: "最常使用的流程",
    openActions: "開啟今天的 Action Inbox",
    openSavedResults: "查看已儲存結果",
    empty: "尚無使用紀錄。先從今天的 Action Inbox 選一個迷因吧。",
    unavailable: "暫時無法載入成果摘要。今天的 Action Inbox 仍可使用。",
    winningReplay: {
      eyebrow: "再次使用",
      title: "再次製作你評價為有效的使用",
      description: "安全開啟你在最近 7 天評價為有效的一次使用紀錄。",
      basis: "依據是你的評價，不是已驗證的公開表現。",
      cta: "再次製作這次使用",
    },
  },
};

export function getPlusOutcomeSnapshotCopy(locale: Locale): PlusOutcomeSnapshotCopy {
  return isPlusOutcomeLocale(locale) ? PLUS_OUTCOME_SNAPSHOT_COPY[locale] : PLUS_OUTCOME_SNAPSHOT_COPY.en;
}

type SnapshotStatus = "ready" | "empty" | "unavailable";

export type PlusOutcomeResultEvidence = {
  status: PlusOutcomeHistoryStatus;
  count: number;
};

export function PlusOutcomeSnapshot({
  summary,
  completion,
  ratings,
  resultEvidence,
  ratingsStatus,
  copy,
  outcomeCopy,
  winningReplay = null,
}: {
  summary: PlusOutcomeSummary;
  completion: PlusGlobalActionInboxCompletion;
  ratings: readonly PlusOutcomeRatingRow[];
  resultEvidence: PlusOutcomeResultEvidence;
  ratingsStatus: "empty" | "ready" | "unavailable";
  copy: PlusOutcomeSnapshotCopy;
  outcomeCopy: PlusOutcomeLedgerCopy;
  winningReplay?: PlusOutcomeWinningReplay | null;
}) {
  const status = resolveSnapshotStatus(
    summary,
    completion,
    ratingsStatus,
    ratings,
    resultEvidence.status,
  );

  if (status === "unavailable") {
    return (
      <section
        data-plus-outcome-snapshot="unavailable"
        className="mb-6 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="plus-outcome-snapshot-title"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          {copy.eyebrow}
        </p>
        <h2 id="plus-outcome-snapshot-title" className="mt-1 text-lg font-black tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-safety-yellow" role="status">
          {copy.unavailable}
        </p>
      </section>
    );
  }

  if (status === "empty") {
    return (
      <section
        data-plus-outcome-snapshot="empty"
        className="mb-6 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="plus-outcome-snapshot-title"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          {copy.eyebrow}
        </p>
        <h2 id="plus-outcome-snapshot-title" className="mt-1 text-lg font-black tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.empty}</p>
        <a
          href="#plus-global-action-inbox-title"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-accent px-3 text-sm font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.openActions}
        </a>
      </section>
    );
  }

  const topChannel = topBreakdown(summary.status === "ready" ? summary.byChannel : []);
  const topLocale = topBreakdown(summary.status === "ready" ? summary.byLocale : []);
  const topArtifact = topBreakdown(summary.status === "ready" ? summary.byArtifactKind : []);

  return (
    <section
      data-plus-outcome-snapshot="ready"
      className="mb-6 rounded-2xl border border-accent/35 bg-accent-soft/20 p-5 sm:p-6"
      aria-labelledby="plus-outcome-snapshot-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            {copy.eyebrow}
          </p>
          <h2 id="plus-outcome-snapshot-title" className="mt-1 text-xl font-black tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="#plus-global-action-inbox-title"
            className="inline-flex min-h-11 items-center rounded-lg border border-accent px-3 text-sm font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copy.openActions}
          </a>
          {resultEvidence.status === "ready" && resultEvidence.count > 0 && (
            <a
              href="#plus-outcome-history-title"
              className="inline-flex min-h-11 items-center rounded-lg bg-surface px-3 text-sm font-bold text-accent-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.openSavedResults}
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Metric
          label={copy.today(completion.completedTodayCount, completion.currentStreak)}
          value={completion.completedTodayCount}
        />
        <Metric
          label={summary.status === "ready" ? outcomeCopy.summary.total(summary.totalReceipts) : copy.title}
          value={summary.status === "ready" ? summary.totalReceipts : completion.completedTodayCount}
        />
        <Metric
          label={summary.status === "ready" ? outcomeCopy.summary.pendingPerformance(summary.awaitingPerformanceCount) : copy.mostUsed}
          value={summary.status === "ready" ? summary.awaitingPerformanceCount : 0}
        />
        <Metric
          label={ratingsStatus === "ready" ? copy.ratings(ratings.length) : copy.ratingsEmpty}
          value={ratingsStatus === "ready" ? ratings.length : 0}
        />
        <Metric label={copy.savedResults(resultEvidence.count)} value={resultEvidence.count} />
      </div>

      {winningReplay && (
        <section
          data-plus-outcome-winning-replay
          aria-labelledby="plus-outcome-winning-replay-title"
          className="mt-4 rounded-xl border border-accent/40 bg-surface p-4"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">
            {copy.winningReplay.eyebrow}
          </p>
          <h3 id="plus-outcome-winning-replay-title" className="mt-1 text-base font-black text-accent-text">
            {copy.winningReplay.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.winningReplay.description}</p>
          <p className="mt-3 text-sm font-bold text-foreground">{winningReplay.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-accent-text">
            <span className="rounded-full bg-surface-2 px-2.5 py-1">{winningReplay.completionDate}</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1">
              {outcomeCopy.receipt.channelOptions[winningReplay.channel]}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1">
              {outcomeCopy.summary.localeNames[winningReplay.locale]}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1">
              {outcomeCopy.receipt.artifactOptions[winningReplay.artifactKind]}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{copy.winningReplay.basis}</p>
          <a
            href={winningReplay.href}
            data-plus-outcome-winning-replay-action
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.winningReplay.cta}
            <span aria-hidden className="ml-1">→</span>
          </a>
        </section>
      )}

      {(topChannel || topLocale || topArtifact) && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-bold text-muted">{copy.mostUsed}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-accent-text">
            {topChannel && <span className="rounded-full bg-surface px-2.5 py-1">{outcomeCopy.summary.channels}: {outcomeCopy.receipt.channelOptions[topChannel.key]}</span>}
            {topLocale && <span className="rounded-full bg-surface px-2.5 py-1">{outcomeCopy.summary.locales}: {outcomeCopy.summary.localeNames[topLocale.key]}</span>}
            {topArtifact && <span className="rounded-full bg-surface px-2.5 py-1">{outcomeCopy.summary.artifacts}: {outcomeCopy.receipt.artifactOptions[topArtifact.key]}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function resolveSnapshotStatus(
  summary: PlusOutcomeSummary,
  completion: PlusGlobalActionInboxCompletion,
  ratingsStatus: "empty" | "ready" | "unavailable",
  ratings: readonly PlusOutcomeRatingRow[],
  resultEvidenceStatus: PlusOutcomeHistoryStatus,
): SnapshotStatus {
  if (
    summary.status === "unavailable" ||
    completion.status === "unavailable" ||
    ratingsStatus === "unavailable" ||
    resultEvidenceStatus === "locked" ||
    resultEvidenceStatus === "unavailable"
  ) {
    return "unavailable";
  }
  if (
    summary.status === "ready" ||
    completion.completedTodayCount > 0 ||
    completion.currentStreak > 0 ||
    ratings.length > 0 ||
    resultEvidenceStatus === "ready"
  ) {
    return "ready";
  }
  return "empty";
}

function topBreakdown<Key extends string>(
  items: readonly { key: Key; count: number }[],
): { key: Key; count: number } | null {
  return [...items].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))[0] ?? null;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <p className="text-xs leading-relaxed text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-foreground">{value}</p>
    </div>
  );
}
