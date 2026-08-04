import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/lib/labels";

/**
 * 신호 트레이스 (리뉴얼 시그니처) — 밈의 생애주기를 파형의 "모양"으로 말한다.
 *
 * 색만 바꾸는 배지와 달리, 파형 자체가 정보다: 급상승은 진폭이 커지고,
 * 유행 중은 크게 유지되고, 식는 중은 잦아들고, 추억 밈은 평평해진다.
 * 색을 못 봐도 모양으로 구분되므로 색약 대응이 형태 차원에서 이뤄진다.
 *
 * 좌표는 모듈 로드 시 한 번만 계산한다(SSR/CSR 동일 — 무작위성 없음).
 */

const WIDTH = 120;
const HEIGHT = 32;
const BASELINE = HEIGHT / 2;
const SAMPLES = 72;

/** 진폭 함수를 사인파로 샘플링해 폴리라인 좌표를 만든다. */
function trace(amplitudeAt: (t: number) => number, cycles: number): string {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const x = t * WIDTH;
    const y = BASELINE - Math.sin(t * cycles * Math.PI * 2) * amplitudeAt(t);
    points.push(`${x.toFixed(1)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

const TRACE: Record<LifecycleStatus, string> = {
  // 급상승 — 왼쪽부터 눈에 보이게 시작해 오른쪽으로 갈수록 커진다.
  // 지수가 크면 초반 진폭이 서브픽셀이라 "평평한 선"으로 읽힌다.
  rising: trace((t) => 2.2 + 9.3 * t ** 1.35, 6),
  // 유행 중 — 큰 진폭을 계속 유지한다.
  active: trace(() => 10.5, 6),
  // 식는 중 — 커졌다가 잦아든다.
  cooling: trace((t) => 10 * (1 - t) ** 1.6 + 0.8, 5),
  // 추억 밈 — 거의 평평하고, 잔류 신호만 남는다.
  archived: trace((t) => 1.1 * (1 - t) ** 3, 4),
};

const STROKE: Record<LifecycleStatus, string> = {
  rising: "text-(--flame-500)",
  active: "text-(--life-active)",
  cooling: "text-(--life-cooling)",
  archived: "text-(--life-archived)",
};

/** 신호가 아직 살아 있는 상태에만 선두 점을 찍는다. */
const LIVE: Record<LifecycleStatus, boolean> = {
  rising: true,
  active: true,
  cooling: false,
  archived: false,
};

export function SignalTrace({
  status,
  className = "",
  showLabel = false,
  size = "sm",
}: {
  status: LifecycleStatus;
  className?: string;
  showLabel?: boolean;
  /** lg는 상세 정답 카드처럼 파형 자체가 주인공인 자리에서 쓴다. */
  size?: "sm" | "lg";
}) {
  const meta = LIFECYCLE_STATUS[status];
  const live = LIVE[status];
  const height = size === "lg" ? "h-14" : "h-5";
  /* lg는 상세 카드처럼 계측 패널 자체가 되는 자리 — 배경에 격자 텍스처를 얹는다. */
  const panel = size === "lg" ? "instrument-grid" : "";

  return (
    /* inline-flex는 내용 크기로 줄어들어 파형이 컨테이너를 못 채운다 —
       트레이스는 항상 주어진 폭을 다 쓰는 계측 눈금이므로 flex+w-full이 기본. */
    <span className={`flex w-full min-w-0 items-center gap-2 ${panel} ${className}`}>
      <svg
        role="img"
        aria-label={`밈 신호: ${meta.user}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className={`w-full min-w-14 shrink ${height} ${STROKE[status]}`}
      >
        {/* 기준선 글로우 — cyan 미세 발광(정적, opacity만). 실시간 신호 어휘를 계측 눈금에 은은히 남긴다. */}
        <line
          x1="0"
          y1={BASELINE}
          x2={WIDTH}
          y2={BASELINE}
          className="text-(--signal-cyan)"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.1"
        />
        {/* 기준선 — 신호가 없을 때의 자리를 보여준다. */}
        <line
          x1="0"
          y1={BASELINE}
          x2={WIDTH}
          y2={BASELINE}
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.22"
        />
        <polyline
          points={TRACE[status]}
          /* 그리기 애니메이션이 경로 길이와 무관하게 같은 속도가 되도록 정규화 */
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={status === "rising" ? "signal-draw" : undefined}
        />
        {live && (
          <circle
            cx={WIDTH}
            cy={BASELINE}
            r="2.2"
            fill="currentColor"
            className="signal-live"
          />
        )}
      </svg>
      {showLabel && (
        <span className={`shrink-0 font-mono text-[11px] font-semibold ${STROKE[status]}`}>
          {meta.user}
        </span>
      )}
    </span>
  );
}
