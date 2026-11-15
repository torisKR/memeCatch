import type { GlobalDailyLocale } from "@/lib/global-daily-challenge";

export type GlobalDailyCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  dateLabel: string;
  reviewedLabel: string;
  contentLanguageLabel: string;
  currentLabel: string;
  safetyLabel: string;
  signedOutTitle: string;
  signedOutBody: string;
  signIn: string;
  lockedTitle: string;
  lockedBody: string;
  upgrade: string;
  unavailableTitle: string;
  unavailableBody: string;
 completedTitle: string;
 completedBody: (streak: number) => string;
  continueTitle: string;
  continueBody: string;
  continueAction: string;
  reviewShelfTitle: string;
  reviewShelfBody: string;
  reviewShelfMeaningLabel: string;
  reviewShelfSafetyLabel: string;
  reviewShelfOpen: string;
  reviewShelfOneCut: string;
  start: string;
  next: string;
  finish: string;
  selected: string;
  correct: string;
  incorrect: (answer: number) => string;
  openMeme: string;
  submitting: string;
  retry: string;
  score: (correct: number, total: number) => string;
  questionProgress: (current: number, total: number) => string;
  streak: (count: number) => string;
  safety: Record<"green" | "yellow" | "gray" | "red", string>;
};

export const GLOBAL_DAILY_COPY: Record<GlobalDailyLocale, GlobalDailyCopy> = {
  ko: {
    eyebrow: "GLOBAL MEME DAILY",
    title: "오늘의 글로벌 밈 3문제",
    intro: "한국어 원문과 검수된 4개 언어 번역을 같은 밈으로 묶어, 오늘 하나를 제대로 익혀요.",
    dateLabel: "오늘의 기준일",
    reviewedLabel: "5개 언어 검수 완료",
    contentLanguageLabel: "콘텐츠 언어",
    currentLabel: "원문 revision 일치",
    safetyLabel: "사용 안전 신호",
    signedOutTitle: "오늘의 밈을 시작하려면 로그인하세요",
    signedOutBody: "로그인 후 Plus에서 매일 같은 글로벌 밈을 3문제로 풀 수 있어요.",
    signIn: "로그인하고 시작하기",
    lockedTitle: "매일 3문제는 Plus 전용이에요",
    lockedBody: "무료 계정은 사전과 퀴즈를 둘러보고, Plus에서 오늘의 글로벌 문제와 연속 기록을 열 수 있어요.",
    upgrade: "Plus로 오늘의 밈 열기",
    unavailableTitle: "오늘의 글로벌 밈을 준비 중이에요",
    unavailableBody: "다섯 언어의 최신 검수가 모두 끝난 밈이 12개 모이면 공개합니다. 불완전한 번역으로 대신 보여주지 않아요.",
   completedTitle: "오늘의 글로벌 밈을 완료했어요",
   completedBody: (streak) => `${streak}일 연속 기록이에요. 내일 새 문제를 준비할게요.`,
    continueTitle: "이제 바로 써 보세요",
    continueBody: "오늘 배운 밈 하나를 검수된 활용 팩에서 바로 열어 보세요.",
    continueAction: "이 밈 활용하기",
    reviewShelfTitle: "오늘 배운 3개 복습",
    reviewShelfBody: "정답의 뜻과 사용 신호를 다시 확인하고, 필요한 밈의 Use Kit을 바로 열어 보세요.",
    reviewShelfMeaningLabel: "뜻",
    reviewShelfSafetyLabel: "사용 신호",
    reviewShelfOpen: "Use Kit 열기",
    reviewShelfOneCut: "One-Cut 준비",
    start: "첫 문제 시작",
    next: "다음 문제",
    finish: "완료하고 기록하기",
    selected: "선택됨",
    correct: "정답이에요.",
    incorrect: (answer) => `정답은 ${answer}번이에요.`,
    openMeme: "이 밈 자세히 보기",
    submitting: "완료 기록 중…",
    retry: "완료 기록을 다시 시도",
    score: (correct, total) => `${total}문제 중 ${correct}개 정답`,
    questionProgress: (current, total) => `${current} / ${total} 문제`,
    streak: (count) => `${count}일 연속`,
    safety: { green: "대체로 사용 가능", yellow: "맥락 확인", gray: "대체로 지난 밈", red: "주의해서 사용" },
  },
  en: {
    eyebrow: "GLOBAL MEME DAILY",
    title: "Three global memes for today",
    intro: "Learn one shared meme through the Korean source and four current, reviewed translations.",
    dateLabel: "Challenge date",
    reviewedLabel: "Reviewed in five locales",
    contentLanguageLabel: "Content language",
    currentLabel: "Matches source revision",
    safetyLabel: "Usage safety signal",
    signedOutTitle: "Sign in to start today’s meme",
    signedOutBody: "Sign in, then use Plus to solve the same global meme challenge in three questions every day.",
    signIn: "Sign in to start",
    lockedTitle: "Three daily questions are a Plus feature",
    lockedBody: "The dictionary and public quiz stay free. Plus opens today’s reviewed global challenge and your streak.",
    upgrade: "Open today’s meme with Plus",
    unavailableTitle: "Today’s global meme is being prepared",
    unavailableBody: "We publish only when 12 memes have complete, current review in all five locales. We will not fill the gap with stale translation.",
   completedTitle: "You completed today’s global meme",
   completedBody: (streak) => `${streak}-day streak. Come back tomorrow for a new challenge.`,
    continueTitle: "Put today’s meme to use",
    continueBody: "Open the reviewed detail and jump straight into its Use Kit.",
    continueAction: "Use this meme now",
    reviewShelfTitle: "Review all three memes",
    reviewShelfBody: "Recheck each meaning and safety signal, then open its reviewed Use Kit when you are ready to act.",
    reviewShelfMeaningLabel: "Meaning",
    reviewShelfSafetyLabel: "Safety signal",
    reviewShelfOpen: "Open the Use Kit",
    reviewShelfOneCut: "Prepare One-Cut",
    start: "Start the first question",
    next: "Next question",
    finish: "Finish and save streak",
    selected: "Selected",
    correct: "Correct.",
    incorrect: (answer) => `The answer is option ${answer}.`,
    openMeme: "Open this meme",
    submitting: "Saving completion…",
    retry: "Retry completion",
    score: (correct, total) => `${correct} of ${total} correct`,
    questionProgress: (current, total) => `Question ${current} of ${total}`,
    streak: (count) => `${count}-day streak`,
    safety: { green: "Generally usable", yellow: "Check context", gray: "Mostly dated", red: "Use with care" },
  },
  ja: {
    eyebrow: "GLOBAL MEME DAILY",
    title: "今日のグローバルミーム3問",
    intro: "韓国語の原文と、確認済みの4言語訳を同じミームで学びます。",
    dateLabel: "チャレンジ日",
    reviewedLabel: "5言語で確認済み",
    contentLanguageLabel: "コンテンツ言語",
    currentLabel: "原文revision一致",
    safetyLabel: "使用安全シグナル",
    signedOutTitle: "ログインして今日のミームを始める",
    signedOutBody: "ログイン後、Plusで毎日同じグローバルミームを3問で学べます。",
    signIn: "ログインして始める",
    lockedTitle: "毎日3問はPlus限定です",
    lockedBody: "辞典と公開クイズは無料です。Plusでは今日の確認済みグローバルチャレンジと連続記録が開きます。",
    upgrade: "Plusで今日のミームを開く",
    unavailableTitle: "今日のグローバルミームを準備中です",
    unavailableBody: "5言語すべてで完全かつ最新の確認が済んだ12件だけを公開します。不完全な翻訳で代用しません。",
   completedTitle: "今日のグローバルミームを完了しました",
   completedBody: (streak) => `${streak}日連続です。明日、新しい問題を用意します。`,
    continueTitle: "ここから実際に使う",
    continueBody: "確認済みの詳細を開いて、すぐに活用キットへ進めます。",
    continueAction: "このミームを使う",
    reviewShelfTitle: "今日の3つを復習",
    reviewShelfBody: "意味と使用シグナルをもう一度確認し、使いたいミームの活用キットを開きましょう。",
    reviewShelfMeaningLabel: "意味",
    reviewShelfSafetyLabel: "使用シグナル",
    reviewShelfOpen: "活用キットを開く",
    reviewShelfOneCut: "One-Cutを準備",
    start: "最初の問題を始める",
    next: "次の問題",
    finish: "完了して記録する",
    selected: "選択済み",
    correct: "正解です。",
    incorrect: (answer) => `正解は${answer}番です。`,
    openMeme: "このミームを見る",
    submitting: "完了を記録中…",
    retry: "完了記録を再試行",
    score: (correct, total) => `${total}問中${correct}問正解`,
    questionProgress: (current, total) => `${current} / ${total}問`,
    streak: (count) => `${count}日連続`,
    safety: { green: "通常は使用可", yellow: "文脈を確認", gray: "主に過去のミーム", red: "注意して使用" },
  },
  zh: {
    eyebrow: "GLOBAL MEME DAILY",
    title: "今天的全球迷因：3道题",
    intro: "通过韩文原文和四种最新审核译文，真正掌握一个共同的全球迷因。",
    dateLabel: "挑战日期",
    reviewedLabel: "五种语言均已审核",
    contentLanguageLabel: "内容语言",
    currentLabel: "与原文版本一致",
    safetyLabel: "使用安全信号",
    signedOutTitle: "登录后开始今天的迷因",
    signedOutBody: "登录后，Plus每天用三道题带你学习同一个全球迷因。",
    signIn: "登录并开始",
    lockedTitle: "每日三题是 Plus 专属功能",
    lockedBody: "词典和公开测验免费开放。Plus会解锁今天的全球审核挑战和连续记录。",
    upgrade: "用 Plus 解锁今天的迷因",
    unavailableTitle: "今天的全球迷因正在准备",
    unavailableBody: "只有五种语言都完成最新审核的12个迷因才会发布。我们不会用过期翻译填补空缺。",
   completedTitle: "你已完成今天的全球迷因",
   completedBody: (streak) => `已连续 ${streak} 天。明天再来挑战新的内容。`,
    continueTitle: "现在就用起来",
    continueBody: "打开已审核的详情，直接进入使用包。",
    continueAction: "立即使用这个迷因",
    reviewShelfTitle: "复习今天的三个迷因",
    reviewShelfBody: "重新确认每个迷因的含义和使用安全信号，需要时直接打开已审核的使用包。",
    reviewShelfMeaningLabel: "含义",
    reviewShelfSafetyLabel: "使用安全信号",
    reviewShelfOpen: "打开使用包",
    reviewShelfOneCut: "准备 One-Cut",
    start: "开始第一题",
    next: "下一题",
    finish: "完成并记录连续天数",
    selected: "已选择",
    correct: "答对了。",
    incorrect: (answer) => `正确答案是第 ${answer} 项。`,
    openMeme: "查看这个迷因",
    submitting: "正在记录完成…",
    retry: "重试完成记录",
    score: (correct, total) => `${total} 题答对 ${correct} 题`,
    questionProgress: (current, total) => `第 ${current} / ${total} 题`,
    streak: (count) => `连续 ${count} 天`,
    safety: { green: "通常可以使用", yellow: "请确认语境", gray: "大多已过时", red: "谨慎使用" },
  },
  "zh-tw": {
    eyebrow: "GLOBAL MEME DAILY",
    title: "今天的全球迷因：3 道題",
    intro: "透過韓文原文和四種最新審核翻譯，真正掌握一個共同的全球迷因。",
    dateLabel: "挑戰日期",
    reviewedLabel: "五種語言均已審核",
    contentLanguageLabel: "內容語言",
    currentLabel: "與原文版本一致",
    safetyLabel: "使用安全訊號",
    signedOutTitle: "登入後開始今天的迷因",
    signedOutBody: "登入後，Plus 每天用三道題帶你學習同一個全球迷因。",
    signIn: "登入並開始",
    lockedTitle: "每日三題是 Plus 專屬功能",
    lockedBody: "辭典和公開測驗免費開放。Plus 會解鎖今天的全球審核挑戰和連續記錄。",
    upgrade: "用 Plus 解鎖今天的迷因",
    unavailableTitle: "今天的全球迷因正在準備",
    unavailableBody: "只有五種語言都完成最新審核的12個迷因才會發布。我們不會用過期翻譯填補空缺。",
   completedTitle: "你已完成今天的全球迷因",
   completedBody: (streak) => `已連續 ${streak} 天。明天再來挑戰新的內容。`,
    continueTitle: "現在就用起來",
    continueBody: "開啟已審核的詳情，直接進入使用包。",
    continueAction: "立即使用這個迷因",
    reviewShelfTitle: "複習今天的三個迷因",
    reviewShelfBody: "重新確認每個迷因的意思和使用安全訊號，需要時直接開啟已審核的使用包。",
    reviewShelfMeaningLabel: "意思",
    reviewShelfSafetyLabel: "使用安全訊號",
    reviewShelfOpen: "開啟使用包",
    reviewShelfOneCut: "準備 One-Cut",
    start: "開始第一題",
    next: "下一題",
    finish: "完成並記錄連續天數",
    selected: "已選擇",
    correct: "答對了。",
    incorrect: (answer) => `正確答案是第 ${answer} 項。`,
    openMeme: "查看這個迷因",
    submitting: "正在記錄完成…",
    retry: "重試完成記錄",
    score: (correct, total) => `${total} 題答對 ${correct} 題`,
    questionProgress: (current, total) => `第 ${current} / ${total} 題`,
    streak: (count) => `連續 ${count} 天`,
    safety: { green: "通常可以使用", yellow: "請確認語境", gray: "大多已過時", red: "謹慎使用" },
  },
};
