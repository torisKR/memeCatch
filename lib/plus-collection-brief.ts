import type { Locale } from "@/lib/i18n";
import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";
import { buildMemeUseKit, type MemeUseKitLabels } from "@/lib/meme-use-kit";

export type PlusCollectionBriefItem = {
  title: string;
  summary: string;
  origin: string;
  usageNote: string | null;
  caution: string | null;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  privateNote: string | null;
  detailUrl: string;
  isLocalized: boolean;
};

export type PlusCollectionBriefInput = {
  collection: string;
  locale: Locale;
  items: readonly PlusCollectionBriefItem[];
  generatedAt?: string;
  truncated?: boolean;
};

type BriefCopy = {
  documentTitle: string;
  countLabel: string;
  generatedLabel: string;
  privateNotice: string;
  languageLabel: string;
  reviewedTranslation: string;
  koreanFallback: string;
  detailLabel: string;
  meaningLabel: string;
  originLabel: string;
  safetyLabel: string;
  trendLabel: string;
  privateNoteLabel: string;
  useKitTitle: string;
  truncatedNotice: string;
  emptyNotice: string;
  labels: MemeUseKitLabels;
};

const COPY: Record<"ko" | "en" | "ja" | "zh" | "zh-tw", BriefCopy> = {
  ko: {
    documentTitle: "밈캐치 Plus 컬렉션 브리프",
    countLabel: "포함된 밈",
    generatedLabel: "생성 시각",
    privateNotice: "이 파일은 내 저장 밈과 개인 메모를 포함한 비공개 자료입니다.",
    languageLabel: "콘텐츠 언어",
    reviewedTranslation: "현재 검수된 번역",
    koreanFallback: "한국어 원문 fallback (이 언어의 검수본이 아직 없음)",
    detailLabel: "상세 페이지",
    meaningLabel: "뜻",
    originLabel: "유래",
    safetyLabel: "사용 신호",
    trendLabel: "유행 상태",
    privateNoteLabel: "내 메모",
    useKitTitle: "바로 쓰는 Use Kit",
    truncatedNotice: "저장한 밈이 100개를 넘어 최신 100개만 포함했습니다.",
    emptyNotice: "이 컬렉션에는 현재 공개 가능한 밈이 없습니다.",
    labels: {
      explainTitle: "설명",
      captionTitle: "게시 문구",
      safetyTitle: "안전 체크",
      safetyLabel: "안전",
      usageLabel: "사용 상황",
      cautionLabel: "주의",
      trendLabel: "유행",
      noGuidance: "추가 사용 안내가 기록되지 않았어요.",
      safety: {
        green: "써도 됨",
        yellow: "맥락 주의",
        gray: "이미 늦음",
        red: "쓰면 위험",
      },
      lifecycle: {
        rising: "급상승",
        active: "유행 중",
        cooling: "식는 중",
        archived: "추억 밈",
      },
    },
  },
  en: {
    documentTitle: "MemeCatch Plus collection brief",
    countLabel: "Memes included",
    generatedLabel: "Generated",
    privateNotice: "Private export containing your saved memes and personal notes.",
    languageLabel: "Content language",
    reviewedTranslation: "Current reviewed translation",
    koreanFallback: "Korean source fallback (this locale is not reviewed yet)",
    detailLabel: "Detail page",
    meaningLabel: "Meaning",
    originLabel: "Origin",
    safetyLabel: "Use signal",
    trendLabel: "Trend",
    privateNoteLabel: "My note",
    useKitTitle: "Ready-to-use kit",
    truncatedNotice: "This collection has more than 100 saved memes; the newest 100 are included.",
    emptyNotice: "There are no currently public memes in this collection.",
    labels: {
      explainTitle: "Explain",
      captionTitle: "Caption",
      safetyTitle: "Safety check",
      safetyLabel: "Safety",
      usageLabel: "Usage",
      cautionLabel: "Caution",
      trendLabel: "Trend",
      noGuidance: "No extra usage guidance is recorded.",
      safety: {
        green: "Safe to use",
        yellow: "Context needed",
        gray: "Past its prime",
        red: "Risky to use",
      },
      lifecycle: {
        rising: "Rising",
        active: "Active",
        cooling: "Cooling",
        archived: "Archived",
      },
    },
  },
  ja: {
    documentTitle: "MemeCatch Plus コレクションブリーフ",
    countLabel: "収録ミーム",
    generatedLabel: "作成日時",
    privateNotice: "保存したミームと個人メモを含む非公開エクスポートです。",
    languageLabel: "コンテンツの言語",
    reviewedTranslation: "現在の確認済み翻訳",
    koreanFallback: "韓国語原文 fallback（この言語の確認済み翻訳は未提供）",
    detailLabel: "詳細ページ",
    meaningLabel: "意味",
    originLabel: "由来",
    safetyLabel: "使用シグナル",
    trendLabel: "流行状態",
    privateNoteLabel: "自分のメモ",
    useKitTitle: "すぐ使える Use Kit",
    truncatedNotice: "100件を超えるため、最新100件のみ収録しています。",
    emptyNotice: "現在公開できるミームはこのコレクションにありません。",
    labels: {
      explainTitle: "説明",
      captionTitle: "投稿文",
      safetyTitle: "安全チェック",
      safetyLabel: "安全性",
      usageLabel: "使用場面",
      cautionLabel: "注意",
      trendLabel: "流行",
      noGuidance: "追加の使用案内は記録されていません。",
      safety: {
        green: "使ってOK",
        yellow: "文脈に注意",
        gray: "旬を過ぎた",
        red: "使用注意",
      },
      lifecycle: {
        rising: "急上昇",
        active: "流行中",
        cooling: "落ち着き中",
        archived: "懐かしミーム",
      },
    },
  },
  zh: {
    documentTitle: "MemeCatch Plus 收藏集简报",
    countLabel: "收录迷因",
    generatedLabel: "生成时间",
    privateNotice: "这是包含你收藏的迷因和个人备注的私密导出文件。",
    languageLabel: "内容语言",
    reviewedTranslation: "当前已审核翻译",
    koreanFallback: "韩语原文 fallback（该语言尚无审核译文）",
    detailLabel: "详情页",
    meaningLabel: "含义",
    originLabel: "来源",
    safetyLabel: "使用信号",
    trendLabel: "流行状态",
    privateNoteLabel: "我的备注",
    useKitTitle: "可直接使用的 Use Kit",
    truncatedNotice: "收藏超过100条，仅包含最新的100条。",
    emptyNotice: "该收藏集目前没有可公开的迷因。",
    labels: {
      explainTitle: "解释",
      captionTitle: "发布文案",
      safetyTitle: "安全检查",
      safetyLabel: "安全",
      usageLabel: "使用场景",
      cautionLabel: "注意",
      trendLabel: "流行",
      noGuidance: "没有记录额外的使用说明。",
      safety: {
        green: "可以使用",
        yellow: "注意语境",
        gray: "已经过时",
        red: "谨慎使用",
      },
      lifecycle: {
        rising: "上升中",
        active: "流行中",
        cooling: "降温中",
        archived: "怀旧迷因",
      },
    },
  },
  "zh-tw": {
    documentTitle: "MemeCatch Plus 收藏集簡報",
    countLabel: "收錄迷因",
    generatedLabel: "產生時間",
    privateNotice: "這是包含你收藏的迷因和個人備註的私密匯出檔案。",
    languageLabel: "內容語言",
    reviewedTranslation: "目前已審核翻譯",
    koreanFallback: "韓語原文 fallback（該語言尚無審核譯文）",
    detailLabel: "詳細頁",
    meaningLabel: "含義",
    originLabel: "來源",
    safetyLabel: "使用訊號",
    trendLabel: "流行狀態",
    privateNoteLabel: "我的備註",
    useKitTitle: "可直接使用的 Use Kit",
    truncatedNotice: "收藏超過100則，僅包含最新的100則。",
    emptyNotice: "此收藏集目前沒有可公開的迷因。",
    labels: {
      explainTitle: "解釋",
      captionTitle: "發布文案",
      safetyTitle: "安全檢查",
      safetyLabel: "安全",
      usageLabel: "使用情境",
      cautionLabel: "注意",
      trendLabel: "流行",
      noGuidance: "沒有記錄額外的使用說明。",
      safety: {
        green: "可以使用",
        yellow: "注意語境",
        gray: "已經過時",
        red: "謹慎使用",
      },
      lifecycle: {
        rising: "上升中",
        active: "流行中",
        cooling: "降溫中",
        archived: "懷舊迷因",
      },
    },
  },
};

function getCopy(locale: Locale): BriefCopy {
  if (locale in COPY) return COPY[locale as keyof typeof COPY];
  return COPY.en;
}

function inlineMarkdown(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_#[\]()>])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();
}

function multilineMarkdown(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => inlineMarkdown(line))
    .join("\n  ");
}

function quoteMarkdown(value: string): string {
  return multilineMarkdown(value)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function itemLanguage(copy: BriefCopy, item: PlusCollectionBriefItem): string {
  return item.isLocalized ? copy.reviewedTranslation : copy.koreanFallback;
}

export function buildPlusCollectionBrief({
  collection,
  locale,
  items,
  generatedAt,
  truncated = false,
}: PlusCollectionBriefInput): string {
  const copy = getCopy(locale);
  const limitedItems = items.slice(0, 100);
  const lines = [
    `# ${inlineMarkdown(collection)}`,
    "",
    `> ${copy.documentTitle}`,
    `> ${copy.privateNotice}`,
    "",
    `- **${copy.countLabel}:** ${limitedItems.length}`,
    generatedAt ? `- **${copy.generatedLabel}:** ${inlineMarkdown(generatedAt)}` : "",
    truncated || items.length > limitedItems.length ? `- **${copy.truncatedNotice}**` : "",
  ].filter(Boolean);

  if (limitedItems.length === 0) {
    lines.push("", copy.emptyNotice);
    return `${lines.join("\n")}\n`;
  }

  limitedItems.forEach((item, index) => {
    const kit = buildMemeUseKit(
      {
        title: item.title,
        summary: item.summary,
        usageNote: item.usageNote,
        caution: item.caution,
        safetyLevel: item.safetyLevel,
        lifecycleStatus: item.lifecycleStatus,
      },
      copy.labels,
    );

    lines.push(
      "",
      `## ${String(index + 1).padStart(2, "0")}. ${inlineMarkdown(item.title)}`,
      `- **${copy.languageLabel}:** ${itemLanguage(copy, item)}`,
      `- **${copy.detailLabel}:** [MemeCatch](${item.detailUrl})`,
      `- **${copy.meaningLabel}:** ${inlineMarkdown(item.summary)}`,
      `- **${copy.originLabel}:** ${inlineMarkdown(item.origin)}`,
      `- **${copy.safetyLabel}:** ${copy.labels.safety[item.safetyLevel]}`,
      `- **${copy.trendLabel}:** ${copy.labels.lifecycle[item.lifecycleStatus]}`,
      `### ${copy.useKitTitle}`,
      ...kit.map(
        (part) => `- **${inlineMarkdown(part.title)}:** ${multilineMarkdown(part.body)}`,
      ),
    );

    if (item.privateNote?.trim()) {
      lines.push(
        `- **${copy.privateNoteLabel}:**`,
        quoteMarkdown(item.privateNote.trim()),
      );
    }
  });

  return `${lines.join("\n")}\n`;
}
