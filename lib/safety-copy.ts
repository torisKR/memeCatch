import {
  DEFAULT_LOCALE,
  withLocaleFallback,
  type Locale,
} from "@/lib/i18n";
import type { SafetyLevel } from "@/lib/labels";

export const SAFETY_SIGNAL_LEVELS = ["green", "yellow", "gray", "red"] as const satisfies readonly SafetyLevel[];

export type SafetySignalCopy = {
  eyebrow: string;
  title: string;
  description: string;
  disclaimer: string;
  badgeTitle: string;
  levels: Record<
    SafetyLevel,
    {
      label: string;
      summary: string;
      detail: string;
    }
  >;
};

const BASE_COPY = {
  ko: {
    eyebrow: "사용 전 맥락 확인",
    title: "사용 신호는 이렇게 읽어요",
    description: "각 모양은 검토된 용례의 맥락과 유행 시점을 함께 요약해요.",
    disclaimer:
      "이 신호는 검토된 용례를 바탕으로 한 편집 안내이며, 모든 상황의 안전이나 허용을 보장하지 않아요.",
    badgeTitle: "사용 안전 신호",
    levels: {
      green: {
        label: "써도 됨",
        summary: "일상적인 맥락에서 대체로 잘 통해요",
        detail:
          "검토한 용례에서는 큰 오해 없이 쓰였어요. 그래도 상대와 장소에 맞는지는 한 번 더 살펴보세요.",
      },
      yellow: {
        label: "맥락 주의",
        summary: "상대와 장소에 따라 뜻이 달라질 수 있어요",
        detail:
          "관계와 상황에 따라 오해하거나 불쾌하게 받아들일 수 있어요. 쓰기 전에 실제 용례와 주의점을 확인하세요.",
      },
      gray: {
        label: "이미 늦음",
        summary: "유행의 타이밍이 지난 표현이에요",
        detail:
          "지금 쓰면 뒤늦거나 어색하게 들릴 수 있어요. 뜻은 통하더라도 현재 분위기와 맞는지 확인하세요.",
      },
      red: {
        label: "쓰면 위험",
        summary: "해롭거나 논쟁적인 맥락과 연결돼요",
        detail:
          "비하·혐오·강한 논란과 연결된 용례가 있어 사용을 권하지 않아요.",
      },
    },
  },
  en: {
    eyebrow: "Check the context first",
    title: "How to read the usage signals",
    description:
      "Each shape summarizes the context and timing found in reviewed examples.",
    disclaimer:
      "These signals are editorial guidance based on reviewed examples. They do not guarantee that every use is safe, permitted, or well received.",
    badgeTitle: "Usage signal",
    levels: {
      green: {
        label: "Safe to use",
        summary: "Usually lands in everyday contexts",
        detail:
          "Reviewed examples generally land without harmful meaning. Still consider your audience and setting before using it.",
      },
      yellow: {
        label: "Check the context",
        summary: "Audience and setting can change the meaning",
        detail:
          "The phrase can be misunderstood or feel offensive depending on the relationship and setting. Check the examples and cautions first.",
      },
      gray: {
        label: "Past its moment",
        summary: "The trend has likely moved on",
        detail:
          "Using it now may feel late or awkward. It can still be understood, but check whether it fits the current conversation.",
      },
      red: {
        label: "Risky to use",
        summary: "Linked to harmful or contentious use",
        detail:
          "Reviewed examples include derogatory, hateful, or highly contentious contexts, so we do not recommend using it.",
      },
    },
  },
  ja: {
    eyebrow: "投稿前に文脈を確認",
    title: "使用シグナルの見方",
    description: "各シンボルは、確認済みの用例から読み取った文脈と流行時期の目安です。",
    disclaimer:
      "このシグナルは確認済みの用例に基づく編集上の案内です。すべての場面で安全・許可・好意的な反応を保証するものではありません。",
    badgeTitle: "使用シグナル",
    levels: {
      green: {
        label: "使ってOK",
        summary: "日常的な場面で伝わりやすい",
        detail:
          "確認した用例では大きな誤解なく使われています。それでも相手や場所に合わせて判断してください。",
      },
      yellow: {
        label: "文脈に注意",
        summary: "相手や場所で意味が変わる",
        detail:
          "関係性や場面によって、誤解や不快感につながることがあります。用例と注意点を先に確認してください。",
      },
      gray: {
        label: "旬を過ぎた",
        summary: "流行のタイミングは過ぎている",
        detail:
          "今使うと古く感じられたり、反応が伝わりにくかったりします。現在の会話に合うか確認してください。",
      },
      red: {
        label: "使用は危険",
        summary: "有害・論争的な文脈と結びついている",
        detail:
          "侮蔑・憎悪・強い論争につながる用例があり、使用は勧めません。",
      },
    },
  },
  zh: {
    eyebrow: "发布前确认语境",
    title: "如何看懂使用提示",
    description: "每个图形概括了已审核用例中的语境和流行时机。",
    disclaimer:
      "这些提示是基于已审核用例的编辑建议，不保证在所有场合都安全、获准或被接受。",
    badgeTitle: "使用提示",
    levels: {
      green: {
        label: "可以使用",
        summary: "在日常语境中通常容易理解",
        detail: "已审核用例通常不会造成明显误解，但使用前仍应考虑对象和场合。",
      },
      yellow: {
        label: "注意语境",
        summary: "对象和场合可能改变含义",
        detail: "根据关系和场合，这个表达可能引起误解或不适。请先查看实际用例和注意事项。",
      },
      gray: {
        label: "已经过时",
        summary: "流行时机很可能已经过去",
        detail: "现在使用可能显得迟或不自然。即使别人能听懂，也请确认是否适合当前对话。",
      },
      red: {
        label: "使用有风险",
        summary: "与有害或争议语境有关",
        detail: "已审核用例涉及贬损、仇恨或强烈争议，因此不建议使用。",
      },
    },
  },
  "zh-tw": {
    eyebrow: "發布前確認語境",
    title: "如何看懂使用提示",
    description: "每個圖形概括已審核用例中的語境與流行時機。",
    disclaimer:
      "這些提示是根據已審核用例提供的編輯建議，不保證在所有情境中都安全、獲准或被接受。",
    badgeTitle: "使用提示",
    levels: {
      green: {
        label: "可以使用",
        summary: "在日常語境中通常容易理解",
        detail: "已審核用例通常不會造成明顯誤解，但使用前仍應考量對象與場合。",
      },
      yellow: {
        label: "留意語境",
        summary: "對象與場合可能改變含義",
        detail: "依照關係和場合，這個說法可能造成誤解或不適。請先查看實際用例與注意事項。",
      },
      gray: {
        label: "已經過時",
        summary: "流行時機很可能已經過去",
        detail: "現在使用可能顯得太晚或不自然。即使別人聽得懂，也請確認是否適合目前的對話。",
      },
      red: {
        label: "使用有風險",
        summary: "與有害或爭議語境有關",
        detail: "已審核用例涉及貶抑、仇恨或強烈爭議，因此不建議使用。",
      },
    },
  },
} satisfies Record<"ko" | "en" | "ja" | "zh" | "zh-tw", SafetySignalCopy>;

export const SAFETY_SIGNAL_COPY: Record<Locale, SafetySignalCopy> =
  withLocaleFallback<SafetySignalCopy>(BASE_COPY);

export function getSafetySignalCopy(
  locale: Locale = DEFAULT_LOCALE,
): SafetySignalCopy {
  return SAFETY_SIGNAL_COPY[locale];
}
