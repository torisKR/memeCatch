import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";

type SubmissionStatus = "pending" | "reviewing" | "approved" | "rejected";

type MyCopy = {
  defaultNickname: string;
  avatarFallback: string;
  ageGroups: Record<"10s" | "20s" | "30s" | "40s" | "50s+", string>;
  onboarding: {
    step: string;
    title: string;
    body: string;
    nicknameLabel: string;
    nicknamePlaceholder: string;
    interestsTitle: string;
    interestsBody: string;
    purposeTitle: string;
    purposeBody: string;
    purposes: Record<"creator" | "brand" | "global", string>;
    platformsTitle: string;
    platformsBody: string;
    platforms: Record<"instagram" | "tiktok" | "x" | "youtube", string>;
    ageTitle: string;
    optional: string;
    ageBody: string;
    notSelected: string;
    skip: string;
    submit: string;
    submitting: string;
  };
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
    library: {
      title: string;
      searchLabel: string;
      searchPlaceholder: string;
      safetyLabel: string;
      allSafety: string;
      apply: string;
      clear: string;
      results: (matches: number, total: number) => string;
      emptyFilteredTitle: string;
      emptyFilteredBody: string;
      upgradeTitle: string;
      upgradeBody: string;
      upgradeAction: string;
      brief: {
        title: string;
        body: string;
        selectLabel: string;
        selectPlaceholder: string;
        download: string;
        empty: string;
        limitNote: string;
      };
      editor: {
        freeHint: string;
        edit: string;
        add: string;
        collectionLabel: string;
        collectionPlaceholder: string;
        noteLabel: string;
        notePlaceholder: string;
        saving: string;
        save: string;
        cancel: string;
        plusRequired: string;
        saveFailed: string;
      };
    };
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
    onboarding: {
      step: "1 / 1 단계",
      title: "밈캐치에 오신 걸 환영해요",
      body: "취향을 알려 주시면 딱 맞는 밈을 먼저 보여드려요. 지금 정하지 않아도 괜찮아요.",
      nicknameLabel: "닉네임",
      nicknamePlaceholder: "2~20자로 지어 주세요",
      interestsTitle: "관심 있는 밈은 무엇인가요?",
      interestsBody: "여러 개 골라도 돼요.",
      purposeTitle: "어디에 밈을 활용하나요?",
      purposeBody: "가장 가까운 목적 하나를 골라 주세요.",
      purposes: { creator: "콘텐츠 크리에이터", brand: "브랜드 팀", global: "글로벌 트렌드 탐색" },
      platformsTitle: "주로 쓰는 플랫폼",
      platformsBody: "여러 개 골라도 돼요.",
      platforms: { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube" },
      ageTitle: "연령대",
      optional: "선택",
      ageBody: "비슷한 또래에게 인기인 밈을 추천하는 데만 써요.",
      notSelected: "선택 안 함",
      skip: "건너뛰기",
      submit: "밈캐치 시작하기",
      submitting: "저장 중…",
    },
    greeting: (age) =>
      age ? `${age} · 반가워요` : "반가워요, 오늘의 밈 찾아볼까요?",
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
      library: {
        title: "내 밈 보관함",
        searchLabel: "저장한 밈 검색",
        searchPlaceholder: "제목이나 뜻으로 다시 찾기",
        safetyLabel: "사용 신호",
        allSafety: "모든 사용 신호",
        apply: "적용",
        clear: "필터 지우기",
        results: (matches, total) =>
          `${matches}개 결과 · 전체 ${total}개 저장됨`,
        emptyFilteredTitle: "조건에 맞는 저장 밈이 없어요.",
        emptyFilteredBody: "검색어를 바꾸거나 사용 신호 필터를 지워 보세요.",
        upgradeTitle: "Plus로 내 밈 보관함을 검색하세요",
        upgradeBody:
          "저장한 밈을 제목·뜻·사용 신호로 빠르게 다시 찾아볼 수 있어요.",
        upgradeAction: "Plus로 보관함 열기",
        brief: {
          title: "컬렉션 브리프 만들기",
          body: "폴더의 밈을 뜻·사용 신호·주의·내 메모가 담긴 비공개 Markdown으로 내려받아요.",
          selectLabel: "컬렉션",
          selectPlaceholder: "내 컬렉션 선택",
          download: "브리프 다운로드",
          empty: "먼저 저장 밈에 폴더를 지정해 주세요.",
          limitNote: "현재 검수된 공개 밈만 최대 100개 포함해요.",
        },
        editor: {
          freeHint: "에서 폴더로 분류하고 메모를 남길 수 있어요.",
          edit: "폴더·메모 수정",
          add: "폴더·메모 추가",
          collectionLabel: "폴더 (최대 40자)",
          collectionPlaceholder: "예: 이번 주 콘텐츠 후보",
          noteLabel: "메모 (최대 500자)",
          notePlaceholder: "어디에 어떻게 쓸지 적어두세요",
          saving: "저장 중…",
          save: "저장",
          cancel: "취소",
          plusRequired: "Plus 구독이 필요해요.",
          saveFailed: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        },
      },
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
    onboarding: {
      step: "Step 1 of 1",
      title: "Welcome to MemeCatch",
      body: "Tell us what you like and we will show relevant memes first. You can decide later, too.",
      nicknameLabel: "Nickname",
      nicknamePlaceholder: "Choose 2–20 characters",
      interestsTitle: "Which memes interest you?",
      interestsBody: "Choose as many as you like.",
      purposeTitle: "How will you use memes?",
      purposeBody: "Choose the option closest to your goal.",
      purposes: { creator: "Content creator", brand: "Brand team", global: "Global trend watcher" },
      platformsTitle: "Preferred platforms",
      platformsBody: "Choose as many as you like.",
      platforms: { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube" },
      ageTitle: "Age group",
      optional: "optional",
      ageBody: "We only use this to recommend memes popular with people around your age.",
      notSelected: "Prefer not to say",
      skip: "Skip for now",
      submit: "Start MemeCatch",
      submitting: "Saving…",
    },
    greeting: (age) =>
      age
        ? `${age} · Welcome back`
        : "Welcome back—ready to find today’s memes?",
    logout: "Log out",
    loadError:
      "We couldn’t load some of your information. Please refresh the page.",
    dateLocale: "en-US",
    nickname: {
      title: "Nickname",
      label: "Nickname",
      save: "Save",
      saved: "Your nickname has been saved.",
      errors: {
        invalidLength: "Use between 2 and 20 characters for your nickname.",
        taken: "That nickname is already in use.",
        saveFailed:
          "We couldn’t save your nickname. Please try again in a moment.",
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
      library: {
        title: "Your meme vault",
        searchLabel: "Search saved memes",
        searchPlaceholder: "Find a title or meaning again",
        safetyLabel: "Use signal",
        allSafety: "All use signals",
        apply: "Apply",
        clear: "Clear filters",
        results: (matches, total) =>
          `${matches} results · ${total} saved in total`,
        emptyFilteredTitle: "No saved memes match these filters.",
        emptyFilteredBody: "Try another search or clear the use-signal filter.",
        upgradeTitle: "Search your meme vault with Plus",
        upgradeBody: "Find saved memes again by title, meaning, or use signal.",
        upgradeAction: "Open the Plus vault",
        brief: {
          title: "Build a collection brief",
          body: "Download a private Markdown brief with meanings, use signals, cautions, and your notes.",
          selectLabel: "Collection",
          selectPlaceholder: "Choose a collection",
          download: "Download brief",
          empty: "Add a folder to a saved meme first.",
          limitNote: "Includes up to 100 currently reviewed public memes.",
        },
        editor: {
          freeHint:
            " lets you organize saved memes into folders and add notes.",
          edit: "Edit folder & note",
          add: "Add folder & note",
          collectionLabel: "Folder (up to 40 characters)",
          collectionPlaceholder: "e.g. This week’s content ideas",
          noteLabel: "Note (up to 500 characters)",
          notePlaceholder: "Write where or how you want to use it",
          saving: "Saving…",
          save: "Save",
          cancel: "Cancel",
          plusRequired: "Plus is required.",
          saveFailed: "We couldn’t save this. Please try again shortly.",
        },
      },
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
      emptyBody:
        "Tell us about a meme you discovered and we’ll review it before publishing.",
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
    onboarding: {
      step: "1 / 1 ステップ",
      title: "MemeCatchへようこそ",
      body: "好みを教えていただければ、あなたに合うミームを先に表示します。今決めなくても大丈夫です。",
      nicknameLabel: "ニックネーム",
      nicknamePlaceholder: "2〜20文字で入力してください",
      interestsTitle: "気になるミームは何ですか？",
      interestsBody: "いくつ選んでも大丈夫です。",
      purposeTitle: "ミームを何に使いますか？",
      purposeBody: "最も近い目的を1つ選んでください。",
      purposes: { creator: "コンテンツクリエイター", brand: "ブランドチーム", global: "海外トレンド調査" },
      platformsTitle: "よく使うプラットフォーム",
      platformsBody: "複数選択できます。",
      platforms: { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube" },
      ageTitle: "年齢層",
      optional: "任意",
      ageBody: "近い年齢層で人気のミームをおすすめするためだけに使います。",
      notSelected: "選択しない",
      skip: "今はスキップ",
      submit: "MemeCatchを始める",
      submitting: "保存中…",
    },
    greeting: (age) =>
      age
        ? `${age} · おかえりなさい`
        : "おかえりなさい。今日のミームを探してみませんか？",
    logout: "ログアウト",
    loadError:
      "一部の情報を読み込めませんでした。ページを再読み込みしてください。",
    dateLocale: "ja-JP",
    nickname: {
      title: "ニックネーム",
      label: "ニックネーム",
      save: "保存",
      saved: "ニックネームを保存しました。",
      errors: {
        invalidLength: "ニックネームは2〜20文字で入力してください。",
        taken: "このニックネームはすでに使用されています。",
        saveFailed:
          "ニックネームを保存できませんでした。しばらくしてからもう一度お試しください。",
      },
    },
    interests: {
      title: "興味のあるカテゴリー",
      edit: "編集",
      set: "設定する",
      empty:
        "興味のあるカテゴリーを設定すると、好みに合うミームを先に表示します。",
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
      saveFailed:
        "保存に失敗しました。しばらくしてからもう一度お試しください。",
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
      library: {
        title: "自分のミーム保管庫",
        searchLabel: "保存したミームを検索",
        searchPlaceholder: "タイトルや意味から探し直す",
        safetyLabel: "使用シグナル",
        allSafety: "すべての使用シグナル",
        apply: "適用",
        clear: "フィルターを解除",
        results: (matches, total) => `${matches}件 · 合計${total}件を保存`,
        emptyFilteredTitle: "条件に合う保存済みミームはありません。",
        emptyFilteredBody:
          "別の検索語にするか、使用シグナルのフィルターを解除してください。",
        upgradeTitle: "Plusで自分のミーム保管庫を検索",
        upgradeBody:
          "保存したミームをタイトル・意味・使用シグナルからすばやく探し直せます。",
        upgradeAction: "Plusの保管庫を開く",
        brief: {
          title: "コレクションブリーフを作成",
          body: "意味・使用シグナル・注意点・自分のメモを含む非公開Markdownをダウンロードできます。",
          selectLabel: "コレクション",
          selectPlaceholder: "コレクションを選択",
          download: "ブリーフをダウンロード",
          empty: "まず保存したミームにフォルダを設定してください。",
          limitNote: "現在確認済みの公開ミームを最大100件収録します。",
        },
        editor: {
          freeHint: "なら、保存したミームをフォルダに整理してメモを残せます。",
          edit: "フォルダ・メモを編集",
          add: "フォルダ・メモを追加",
          collectionLabel: "フォルダ（最大40文字）",
          collectionPlaceholder: "例：今週のコンテンツ候補",
          noteLabel: "メモ（最大500文字）",
          notePlaceholder: "どこでどう使うかを書き留めましょう",
          saving: "保存中…",
          save: "保存",
          cancel: "キャンセル",
          plusRequired: "Plusへの登録が必要です。",
          saveFailed:
            "保存できませんでした。しばらくしてからもう一度お試しください。",
        },
      },
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
    onboarding: {
      step: "第 1 步，共 1 步",
      title: "欢迎来到 MemeCatch",
      body: "告诉我们你的喜好，我们会优先展示相关迷因。现在不决定也没关系。",
      nicknameLabel: "昵称",
      nicknamePlaceholder: "请输入 2–20 个字符",
      interestsTitle: "你对哪些迷因感兴趣？",
      interestsBody: "可以选择多个。",
      purposeTitle: "你会如何使用迷因？",
      purposeBody: "请选择最符合你目标的一项。",
      purposes: { creator: "内容创作者", brand: "品牌团队", global: "全球趋势观察" },
      platformsTitle: "常用平台",
      platformsBody: "可以选择多个。",
      platforms: { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube" },
      ageTitle: "年龄段",
      optional: "可选",
      ageBody: "仅用于推荐同龄人中受欢迎的迷因。",
      notSelected: "暂不选择",
      skip: "暂时跳过",
      submit: "开始使用 MemeCatch",
      submitting: "正在保存…",
    },
    greeting: (age) =>
      age ? `${age} · 欢迎回来` : "欢迎回来，一起看看今天的迷因吧。",
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
      library: {
        title: "我的迷因收藏库",
        searchLabel: "搜索收藏的迷因",
        searchPlaceholder: "按标题或含义重新查找",
        safetyLabel: "使用信号",
        allSafety: "所有使用信号",
        apply: "应用",
        clear: "清除筛选",
        results: (matches, total) => `${matches} 条结果 · 共收藏 ${total} 条`,
        emptyFilteredTitle: "没有符合这些筛选条件的收藏迷因。",
        emptyFilteredBody: "请尝试其他搜索词，或清除使用信号筛选。",
        upgradeTitle: "使用 Plus 搜索你的迷因收藏库",
        upgradeBody: "可按标题、含义或使用信号快速重新找到收藏的迷因。",
        upgradeAction: "打开 Plus 收藏库",
        brief: {
          title: "制作收藏集简报",
          body: "将收藏集中的含义、使用信号、注意事项和个人备注下载为私密 Markdown。",
          selectLabel: "收藏集",
          selectPlaceholder: "选择收藏集",
          download: "下载简报",
          empty: "请先为收藏的迷因设置文件夹。",
          limitNote: "最多包含100条当前已审核的公开迷因。",
        },
        editor: {
          freeHint: "可将收藏的迷因整理到文件夹并添加备注。",
          edit: "编辑文件夹和备注",
          add: "添加文件夹和备注",
          collectionLabel: "文件夹（最多40个字符）",
          collectionPlaceholder: "例如：本周内容候选",
          noteLabel: "备注（最多500个字符）",
          notePlaceholder: "记下在哪里、如何使用",
          saving: "正在保存…",
          save: "保存",
          cancel: "取消",
          plusRequired: "需要订阅 Plus。",
          saveFailed: "无法保存，请稍后重试。",
        },
      },
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

export const MY_COPY: Record<Locale, MyCopy> =
  withLocaleFallback<MyCopy>(MY_COPY_BASE);
