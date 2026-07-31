import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";

type SubmissionStatus = "pending" | "reviewing" | "approved" | "rejected";

type MyCopy = {
  defaultNickname: string;
  avatarFallback: string;
  ageGroups: Record<"10s" | "20s" | "30s" | "40s" | "50s+", string>;
  greeting: (age?: string) => string;
  logout: string;
  loadError: string;
  dateLocale: string;
  nickname: {
    title: string;
    label: string;
    save: string;
    saved: string;
    errors: {
      invalidLength: string;
      taken: string;
      saveFailed: string;
    };
  };
  interests: {
    title: string;
    edit: string;
    set: string;
    empty: string;
  };
  customization: {
    title: string;
    flairLabel: string;
    flairPlaceholder: string;
    flairHint: string;
    accentLabel: string;
    save: string;
    saved: string;
    plusOnly: string;
    saveFailed: string;
  };
  categories: Record<MemeCategory, string>;
  saved: {
    title: string;
    emptyTitle: string;
    emptyBody: string;
    explore: string;
  };
  recent: {
    title: string;
    clearAll: string;
  };
  safety: Record<SafetyLevel, string>;
  submissions: {
    title: string;
    emptyTitle: string;
    emptyBody: string;
    first: string;
    submittedAt: (date: string) => string;
    rejectionReason: string;
    duplicate: string;
    status: Record<SubmissionStatus, { badge: string }>;
    pendingDetail: string;
  };
};

const MY_COPY_BASE = {
  ko: {
    defaultNickname: "밈캐치 유저",
    avatarFallback: "밈",
    ageGroups: {
      "10s": "10대",
      "20s": "20대",
      "30s": "30대",
      "40s": "40대",
      "50s+": "50대 이상",
    },
    greeting: (age) => age ? `${age} · 반가워요` : "반가워요, 오늘의 밈 찾아볼까요?",
    logout: "로그아웃",
    loadError: "일부 정보를 불러오지 못했어요. 새로고침해 주세요.",
    dateLocale: "ko-KR",
    nickname: {
      title: "닉네임",
      label: "닉네임",
      save: "저장",
      saved: "닉네임을 저장했어요.",
      errors: {
        invalidLength: "닉네임은 2~20자로 지어 주세요",
        taken: "이미 사용 중인 닉네임이에요",
        saveFailed: "닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요",
      },
    },
    interests: {
      title: "관심 카테고리",
      edit: "수정",
      set: "설정하기",
      empty: "관심 카테고리를 설정하면 취향에 맞는 밈을 먼저 보여드려요.",
    },
    customization: {
      title: "프로필 꾸미기",
      flairLabel: "플레어",
      flairPlaceholder: "예: 밈 수집가",
      flairHint: "닉네임 옆에 붙는 짧은 문구예요 (최대 24자).",
      accentLabel: "강조 색상",
      save: "저장",
      saved: "프로필 꾸미기를 저장했어요.",
      plusOnly: "Plus 전용 기능이에요.",
      saveFailed: "저장에 실패했어요. 잠시 후 다시 시도해 주세요.",
    },
    categories: {
      phrase: "밈 용어(유행어)",
      dance: "챌린지 댄스",
      song: "노래",
      image: "밈 영상",
      comment: "드라마 장면",
      challenge: "챌린지 댄스",
    },
    saved: {
      title: "저장한 밈",
      emptyTitle: "아직 저장한 밈이 없어요.",
      emptyBody: "궁금한 밈을 저장해 두면 여기서 다시 볼 수 있어요.",
      explore: "탐색하러 가기",
    },
    recent: {
      title: "최근 본 밈",
      clearAll: "전체 지우기",
    },
    safety: {
      green: "써도 됨",
      yellow: "맥락 주의",
      gray: "이미 늦음",
      red: "쓰면 위험",
    },
    submissions: {
      title: "내 제보",
      emptyTitle: "아직 제보한 밈이 없어요.",
      emptyBody: "처음 본 밈을 알려 주시면 검토 후 등록해 드려요.",
      first: "첫 밈 제보하기",
      submittedAt: (date) => `${date} 제보`,
      rejectionReason: "반려 사유",
      duplicate: "이미 등록된 밈이에요",
      status: {
        pending: { badge: "접수됨" },
        reviewing: { badge: "검수 중" },
        approved: { badge: "등록 완료!" },
        rejected: { badge: "반려됨" },
      },
      pendingDetail: "접수됨 — 24~48시간 내 검토돼요",
    },
  },
  en: {
    defaultNickname: "MemeCatch user",
    avatarFallback: "M",
    ageGroups: {
      "10s": "Teens",
      "20s": "20s",
      "30s": "30s",
      "40s": "40s",
      "50s+": "50 and over",
    },
    greeting: (age) => age ? `${age} · Welcome back` : "Welcome back—ready to find today’s memes?",
    logout: "Log out",
    loadError: "We couldn’t load some of your information. Please refresh the page.",
    dateLocale: "en-US",
    nickname: {
      title: "Nickname",
      label: "Nickname",
      save: "Save",
      saved: "Your nickname has been saved.",
      errors: {
        invalidLength: "Use between 2 and 20 characters for your nickname.",
        taken: "That nickname is already in use.",
        saveFailed: "We couldn’t save your nickname. Please try again in a moment.",
      },
    },
    interests: {
      title: "Interests",
      edit: "Edit",
      set: "Set interests",
      empty: "Set your interests to see relevant memes first.",
    },
    customization: {
      title: "Profile flair",
      flairLabel: "Flair",
      flairPlaceholder: "e.g. Meme curator",
      flairHint: "A short tag shown next to your nickname (max 24 chars).",
      accentLabel: "Accent color",
      save: "Save",
      saved: "Your profile flair has been saved.",
      plusOnly: "This is a Plus-only feature.",
      saveFailed: "Couldn't save. Please try again in a moment.",
    },
    categories: {
      phrase: "Meme terms",
      dance: "Challenge dances",
      song: "Songs",
      image: "Meme videos",
      comment: "Drama scenes",
      challenge: "Challenge dances",
    },
    saved: {
      title: "Saved memes",
      emptyTitle: "You haven’t saved any memes yet.",
      emptyBody: "Save memes you want to revisit and they’ll appear here.",
      explore: "Explore memes",
    },
    recent: {
      title: "Recently viewed",
      clearAll: "Clear all",
    },
    safety: {
      green: "Safe to use",
      yellow: "Context needed",
      gray: "Past its prime",
      red: "Risky to use",
    },
    submissions: {
      title: "My submissions",
      emptyTitle: "You haven’t submitted a meme yet.",
      emptyBody: "Tell us about a meme you discovered and we’ll review it before publishing.",
      first: "Submit your first meme",
      submittedAt: (date) => `Submitted ${date}`,
      rejectionReason: "Reason",
      duplicate: "This meme is already listed",
      status: {
        pending: { badge: "Received" },
        reviewing: { badge: "In review" },
        approved: { badge: "Published" },
        rejected: { badge: "Declined" },
      },
      pendingDetail: "Received — we’ll review it within 24–48 hours.",
    },
  },
  ja: {
    defaultNickname: "MemeCatchユーザー",
    avatarFallback: "M",
    ageGroups: {
      "10s": "10代",
      "20s": "20代",
      "30s": "30代",
      "40s": "40代",
      "50s+": "50代以上",
    },
    greeting: (age) => age ? `${age} · おかえりなさい` : "おかえりなさい。今日のミームを探してみませんか？",
    logout: "ログアウト",
    loadError: "一部の情報を読み込めませんでした。ページを再読み込みしてください。",
    dateLocale: "ja-JP",
    nickname: {
      title: "ニックネーム",
      label: "ニックネーム",
      save: "保存",
      saved: "ニックネームを保存しました。",
      errors: {
        invalidLength: "ニックネームは2〜20文字で入力してください。",
        taken: "このニックネームはすでに使用されています。",
        saveFailed: "ニックネームを保存できませんでした。しばらくしてからもう一度お試しください。",
      },
    },
    interests: {
      title: "興味のあるカテゴリー",
      edit: "編集",
      set: "設定する",
      empty: "興味のあるカテゴリーを設定すると、好みに合うミームを先に表示します。",
    },
    customization: {
      title: "プロフィール装飾",
      flairLabel: "フレア",
      flairPlaceholder: "例：ミームコレクター",
      flairHint: "ニックネームの横に表示される短いタグです（最大24文字）。",
      accentLabel: "アクセントカラー",
      save: "保存",
      saved: "プロフィール装飾を保存しました。",
      plusOnly: "これは Plus 専用機能です。",
      saveFailed: "保存に失敗しました。しばらくしてからもう一度お試しください。",
    },
    categories: {
      phrase: "ミーム用語",
      dance: "チャレンジダンス",
      song: "楽曲",
      image: "ミーム動画",
      comment: "ドラマシーン",
      challenge: "チャレンジダンス",
    },
    saved: {
      title: "保存したミーム",
      emptyTitle: "保存したミームはまだありません。",
      emptyBody: "気になるミームを保存すると、ここからいつでも見返せます。",
      explore: "ミームを探す",
    },
    recent: {
      title: "最近見たミーム",
      clearAll: "すべて消去",
    },
    safety: {
      green: "使ってOK",
      yellow: "文脈に注意",
      gray: "旬を過ぎた",
      red: "使用注意",
    },
    submissions: {
      title: "自分の投稿",
      emptyTitle: "投稿したミームはまだありません。",
      emptyBody: "見つけたミームを教えてください。確認後に掲載します。",
      first: "最初のミームを投稿",
      submittedAt: (date) => `${date}に投稿`,
      rejectionReason: "見送り理由",
      duplicate: "このミームはすでに登録されています",
      status: {
        pending: { badge: "受付済み" },
        reviewing: { badge: "確認中" },
        approved: { badge: "掲載済み" },
        rejected: { badge: "見送り" },
      },
      pendingDetail: "受付済み — 24〜48時間以内に確認します。",
    },
  },
  zh: {
    defaultNickname: "MemeCatch用户",
    avatarFallback: "M",
    ageGroups: {
      "10s": "10多岁",
      "20s": "20多岁",
      "30s": "30多岁",
      "40s": "40多岁",
      "50s+": "50岁以上",
    },
    greeting: (age) => age ? `${age} · 欢迎回来` : "欢迎回来，一起看看今天的迷因吧。",
    logout: "退出登录",
    loadError: "部分信息加载失败，请刷新页面。",
    dateLocale: "zh-CN",
    nickname: {
      title: "昵称",
      label: "昵称",
      save: "保存",
      saved: "昵称已保存。",
      errors: {
        invalidLength: "昵称请输入2至20个字符。",
        taken: "该昵称已被使用。",
        saveFailed: "昵称保存失败，请稍后重试。",
      },
    },
    interests: {
      title: "兴趣分类",
      edit: "编辑",
      set: "设置兴趣",
      empty: "设置兴趣分类后，我们会优先显示符合你喜好的迷因。",
    },
    customization: {
      title: "个人资料装饰",
      flairLabel: "标签",
      flairPlaceholder: "例：迷因收藏家",
      flairHint: "显示在昵称旁边的简短标签（最多24个字符）。",
      accentLabel: "强调色",
      save: "保存",
      saved: "已保存个人资料装饰。",
      plusOnly: "这是 Plus 专属功能。",
      saveFailed: "保存失败，请稍后再试。",
    },
    categories: {
      phrase: "梗语",
      dance: "舞蹈挑战",
      song: "歌曲",
      image: "梗视频",
      comment: "电视剧场景",
      challenge: "舞蹈挑战",
    },
    saved: {
      title: "收藏的迷因",
      emptyTitle: "还没有收藏迷因。",
      emptyBody: "收藏感兴趣的迷因后，就可以在这里随时查看。",
      explore: "发现迷因",
    },
    recent: {
      title: "最近浏览",
      clearAll: "全部清除",
    },
    safety: {
      green: "可以使用",
      yellow: "注意语境",
      gray: "已经过时",
      red: "谨慎使用",
    },
    submissions: {
      title: "我的投稿",
      emptyTitle: "还没有投稿迷因。",
      emptyBody: "告诉我们你发现的迷因，审核后我们会将其收录。",
      first: "投稿第一个迷因",
      submittedAt: (date) => `投稿于 ${date}`,
      rejectionReason: "未通过原因",
      duplicate: "该迷因已被收录",
      status: {
        pending: { badge: "已收到" },
        reviewing: { badge: "审核中" },
        approved: { badge: "已收录" },
        rejected: { badge: "未通过" },
      },
      pendingDetail: "已收到 — 我们会在24至48小时内完成审核。",
    },
  },
} satisfies Record<"ko" | "en" | "ja" | "zh", MyCopy>;

export const MY_COPY: Record<Locale, MyCopy> = withLocaleFallback<MyCopy>(MY_COPY_BASE);
