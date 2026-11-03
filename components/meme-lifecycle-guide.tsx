import { Clock, TrendingUp, Archive, Flame, ShieldAlert } from "lucide-react";
import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/lib/labels";

type Props = {
  lifecycleStatus: LifecycleStatus;
  originYear?: number | null;
  title: string;
};

const LIFECYCLE_DETAILS: Record<
  LifecycleStatus,
  {
    title: string;
    description: string;
    recommendation: string;
    icon: typeof Flame;
    colorClass: string;
    bgClass: string;
  }
> = {
  rising: {
    title: "지금 막 뜨고 있는 최신 유행 밈",
    description: "SNS 릴스, 쇼츠, 커뮤니티에서 급격히 확산 중인 가장 핫한 신조어입니다.",
    recommendation: "친구들과의 대화나 트렌디한 SNS 댓글에 가장 적극적으로 활용할 수 있습니다. 단, 어른들이나 격식 있는 자리에서는 모르는 사람이 많을 수 있습니다.",
    icon: TrendingUp,
    colorClass: "text-accent",
    bgClass: "border-accent/30 bg-accent/10",
  },
  active: {
    title: "일상과 커뮤니티에서 활발히 쓰이는 밈",
    description: "대중적인 인지도를 확보하여 일상 대화와 온라인 소통에서 자연스럽게 통용되는 시기입니다.",
    recommendation: "대다수가 맥락을 이해하므로 편하게 쓰셔도 좋습니다. 직장 내에서는 친밀한 동료와의 슬랙이나 티타임에 유쾌하게 쓸 수 있습니다.",
    icon: Flame,
    colorClass: "text-safety-green",
    bgClass: "border-safety-green/30 bg-safety-green/10",
  },
  cooling: {
    title: "유행 정점을 지나 사용 빈도가 낮아진 밈",
    description: "전성기만큼 자주 쓰이지는 않으며, 무분별하게 남발할 경우 다소 올드하게 느껴질 수 있습니다.",
    recommendation: "무리하게 유행어로 쓰기보다는 가벼운 추억 공유나 특정한 맥락이 맞아떨어질 때 위트 있게 사용하는 것을 권장합니다.",
    icon: Clock,
    colorClass: "text-safety-yellow",
    bgClass: "border-safety-yellow/30 bg-safety-yellow/10",
  },
  archived: {
    title: "시대의 명언·관용구로 안착한 클래식 밈",
    description: "반짝 유행을 넘어 한국 인터넷 문화와 현대 구어의 한 페이지로 완전히 정착한 고전 밈입니다.",
    recommendation: "‘사어’라기보다는 누구나 알고 있는 상징적 표현으로, 적절한 순간에 인용하면 세대를 불문하고 깊은 공감과 유머를 이끌어낼 수 있습니다.",
    icon: Archive,
    colorClass: "text-blue-400",
    bgClass: "border-blue-400/30 bg-blue-400/10",
  },
};

export function MemeLifecycleGuide({ lifecycleStatus, originYear, title }: Props) {
  const detail = LIFECYCLE_DETAILS[lifecycleStatus] ?? LIFECYCLE_DETAILS.active;
  const statusLabel = LIFECYCLE_STATUS[lifecycleStatus]?.user ?? "유행 중";
  const Icon = detail.icon;

  return (
    <section
      aria-labelledby="meme-lifecycle-heading"
      className="rounded-2xl border border-white/10 bg-surface p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="meme-lifecycle-heading" className="text-lg font-bold text-foreground">
          지금도 쓰이나요? · 트렌드 수명 분석
        </h2>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${detail.bgClass} ${detail.colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
          <span>{statusLabel}</span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          {detail.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          {detail.description}
          {originYear && ` (${originYear}년 최초 등장)`}
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-surface-2 p-3.5 text-xs sm:text-sm text-foreground/90 space-y-1">
        <div className="font-bold text-accent-text flex items-center gap-1.5">
          <span>💡</span> 밈캐치 실전 사용 제안
        </div>
        <p className="leading-relaxed text-muted">
          {detail.recommendation}
        </p>
      </div>
    </section>
  );
}
