import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { PlusNextMoveCopy, PlusNextMoveSignal } from "@/lib/plus-next-move";

const BASE_COPY: {
  ko: PlusNextMoveCopy;
  en: PlusNextMoveCopy;
  ja: PlusNextMoveCopy;
  zh: PlusNextMoveCopy;
} = {
  ko: {
    eyebrow: "PLUS NEXT MOVE",
    title: "다음엔 이 밈부터 써보세요",
    description: "최근 활용 결과를 다음 추천에 반영해, 나에게 맞는 밈을 먼저 보여드려요.",
    confidence: {
      learning: (count) => `아직 ${count}건을 배웠어요. 몇 번 더 기록하면 추천이 더 정확해져요.`,
      ready: (count) => `최근 ${count}건의 활용 결과를 반영한 개인 추천이에요.`,
    },
    signal: {
      hit: "전에 반응이 좋았던 방향과 비슷해요",
      neutral: "기록한 결과를 바탕으로 다시 시험해볼 만해요",
      miss: "아직 반응이 약했던 방향은 뒤로 미뤘어요",
      new: "아직 평가하지 않은 새 후보예요",
      saved: "저장해 둔 밈 중 지금 다시 써볼 후보예요",
    },
    open: "이 밈 열기",
    activate: "이 밈으로 One-Cut 시작",
    activated: "다음 밈을 One-Cut 첫 카드로 옮겼어요.",
    empty: {
      title: "다음 추천을 준비 중이에요",
      body: "오늘의 Action Inbox를 한 번 사용하면 다음 방문부터 추천이 생겨요.",
    },
    unavailable: {
      title: "개인 추천을 잠시 불러오지 못했어요",
      body: "오늘의 Action Inbox는 그대로 사용할 수 있어요. 다음 방문에 다시 시도합니다.",
    },
  },
  en: {
    eyebrow: "PLUS NEXT MOVE",
    title: "Start with this one next",
    description: "Your recent results shape the next recommendation, so the queue gets more personal over time.",
    confidence: {
      learning: (count) => `Still learning from ${count} result${count === 1 ? "" : "s"}. Add a few more to sharpen it.`,
      ready: (count) => `Personalized from your latest ${count} results.`,
    },
    signal: {
      hit: "Similar to a direction that worked for you",
      neutral: "Worth another test based on what you recorded",
      miss: "Directions with weaker results are pushed back",
      new: "A new candidate you have not rated yet",
      saved: "A saved meme worth putting back to work",
    },
    open: "Open this meme",
    activate: "Use this for One-Cut",
    activated: "Next Move is now your first One-Cut card.",
    empty: {
      title: "Your next recommendation is warming up",
      body: "Use one item from today’s Action Inbox and a recommendation will appear next time.",
    },
    unavailable: {
      title: "Personal recommendation is temporarily unavailable",
      body: "Today’s Action Inbox still works. We’ll try the learning loop again next visit.",
    },
  },
  ja: {
    eyebrow: "PLUS NEXT MOVE",
    title: "次はこのミームから",
    description: "最近の活用結果を次のおすすめに反映し、使うほど自分向けになります。",
    confidence: {
      learning: (count) => `まだ${count}件から学習中です。もう少し記録すると精度が上がります。`,
      ready: (count) => `最近${count}件の活用結果を反映したおすすめです。`,
    },
    signal: {
      hit: "以前反応がよかった方向に近い候補です",
      neutral: "記録した結果をもとにもう一度試す候補です",
      miss: "反応が弱かった方向は後回しにしています",
      new: "まだ評価していない新しい候補です",
      saved: "保存したミームから、今もう一度使える候補です",
    },
    open: "このミームを開く",
    activate: "このミームでOne-Cutを始める",
    activated: "次のミームをOne-Cutの先頭に移しました。",
    empty: {
      title: "次のおすすめを準備中です",
      body: "今日のAction Inboxを1件使うと、次回からおすすめが表示されます。",
    },
    unavailable: {
      title: "個人おすすめを読み込めませんでした",
      body: "今日のAction Inboxは引き続き使えます。次回もう一度試します。",
    },
  },
  zh: {
    eyebrow: "PLUS NEXT MOVE",
    title: "下一个先用这个",
    description: "把最近的使用结果加入下一次推荐，让队列越来越适合你。",
    confidence: {
      learning: (count) => `目前只从 ${count} 条结果学习，再记录几次会更准确。`,
      ready: (count) => `已根据最近 ${count} 条使用结果生成个人推荐。`,
    },
    signal: {
      hit: "和之前对你反应不错的方向相似",
      neutral: "根据你记录的结果，值得再试一次",
      miss: "反应较弱的方向已经往后排了",
      new: "你还没有评价过的新候选",
      saved: "这是收藏中现在值得再用一次的候选",
    },
    open: "打开这个迷因",
    activate: "用这个开始 One-Cut",
    activated: "已将下一条迷因移到 One-Cut 首位。",
    empty: {
      title: "正在准备你的下一条推荐",
      body: "先使用今天 Action Inbox 中的一项，下次访问就会出现推荐。",
    },
    unavailable: {
      title: "暂时无法加载个人推荐",
      body: "今天的 Action Inbox 仍可使用，下次访问会再次尝试学习循环。",
    },
  },
};

export const PLUS_NEXT_MOVE_COPY: Record<Locale, PlusNextMoveCopy> =
  withLocaleFallback(BASE_COPY);

export function plusNextMoveSignalLabel(
  copy: PlusNextMoveCopy,
  signal: PlusNextMoveSignal,
): string {
  return copy.signal[signal];
}
