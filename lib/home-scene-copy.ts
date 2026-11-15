import type { SeoRouteLocale } from "@/lib/i18n-routing";

export type HomeSceneCopy = {
  controlsLabel: string;
  scrollLayout: string;
  scrollHint: string;
  scrollPaused: string;
  scrollReduced: string;
  scrollSteps: readonly [string, string, string];
  brandLabel: string;
  layoutLabel: string;
  layoutLoading: string;
  layoutUnavailable: string;
  stackLabel: string;
  spreadLabel: string;
  signalGroupLabel: string;
  selectedSignalLabel: string;
  interactionHint: string;
  resetView: string;
  disclosureLabel: string;
  educationNotice: string;
  demoDisclaimer: string;
};

export const HOME_SCENE_COPY = {
  ko: {
    controlsLabel: "장면 조작",
    scrollLayout: "스크롤",
    scrollHint: "아래로 스크롤하면 펼쳐지고, 위로 올리면 다시 모입니다.",
    scrollPaused: "움직임을 멈췄어요. 재생하면 현재 스크롤에 맞춰 이어집니다.",
    scrollReduced: "모션 감소 설정으로 스크롤 움직임을 껐어요. 버튼으로 직접 살펴보세요.",
    scrollSteps: ["모으기", "펼치기", "살펴보기"],
    brandLabel: "MemeCatch Studio",
    layoutLabel: "3D 레이어 보기",
    layoutLoading: "",
    layoutUnavailable: "정적 보기 · 3D 조작은 지원되지 않아요",
    stackLabel: "모아보기",
    spreadLabel: "펼쳐보기",
    signalGroupLabel: "사용 신호 살펴보기",
    selectedSignalLabel: "선택한 신호",
    interactionHint: "신호를 선택하고, 장면을 좌우로 드래그해 보세요.",
    resetView: "보기 초기화",
    disclosureLabel: "이 신호를 더 알아보기",
    educationNotice: "교육용 안내입니다. 실제 밈 판정이 아닙니다.",
    demoDisclaimer: "이것은 신호 체계를 설명하는 교육용 데모이며 실제 밈에 대한 판정이 아니에요. 각 밈의 검토된 용례를 따로 확인하세요.",
  },
  en: {
    controlsLabel: "Scene controls",
    scrollLayout: "Scroll",
    scrollHint: "Scroll down to unfold. Scroll back up to bring the layers together.",
    scrollPaused: "Motion is paused. Play to follow the current scroll position.",
    scrollReduced: "Scroll motion is off for reduced motion. Use the layout buttons to explore.",
    scrollSteps: ["Gather", "Unfold", "Explore"],
    brandLabel: "MemeCatch Studio",
    layoutLabel: "3D layer layout",
    layoutLoading: "Loading 3D view",
    layoutUnavailable: "Static view · 3D controls unavailable",
    stackLabel: "Stack",
    spreadLabel: "Spread",
    signalGroupLabel: "Explore usage signals",
    selectedSignalLabel: "Selected signal",
    interactionHint: "Choose a signal. Drag sideways to rotate.",
    resetView: "Reset view",
    disclosureLabel: "Why this signal?",
    educationNotice: "Education only. Not a verdict on any meme.",
    demoDisclaimer: "This educational demo explains the signal system; it is not a verdict on any real meme. Check each meme’s reviewed examples.",
  },
  ja: {
    controlsLabel: "シーン操作",
    scrollLayout: "スクロール",
    scrollHint: "下へスクロールすると広がり、上に戻すと重なります。",
    scrollPaused: "動きを停止中です。再生すると現在の位置に合わせて動きます。",
    scrollReduced: "視差効果を減らす設定のため動きを止めています。ボタンで切り替えられます。",
    scrollSteps: ["集める", "広げる", "見てみる"],
    brandLabel: "MemeCatch Studio",
    layoutLabel: "3Dレイヤー表示",
    layoutLoading: "3Dを準備中",
    layoutUnavailable: "静止表示 · 3D操作は利用できません",
    stackLabel: "重ねる",
    spreadLabel: "広げる",
    signalGroupLabel: "使用シグナルを確認",
    selectedSignalLabel: "選択中のシグナル",
    interactionHint: "シグナルを選び、左右にドラッグして回転できます。",
    resetView: "視点をリセット",
    disclosureLabel: "このシグナルの詳細",
    educationNotice: "学習用の案内です。実在するミームへの判定ではありません。",
    demoDisclaimer: "これはシグナルの仕組みを説明する学習用デモで、実在するミームへの判定ではありません。各ミームの確認済み用例を個別に確認してください。",
  },
  zh: {
    controlsLabel: "场景控制",
    scrollLayout: "滚动",
    scrollHint: "向下滚动展开图层，向上滚动重新聚合。",
    scrollPaused: "动画已暂停，播放后将跟随当前滚动位置。",
    scrollReduced: "已按减少动态效果的设置关闭滚动动画，请使用布局按钮。",
    scrollSteps: ["聚合", "展开", "探索"],
    brandLabel: "MemeCatch Studio",
    layoutLabel: "3D图层视图",
    layoutLoading: "正在加载3D",
    layoutUnavailable: "静态视图 · 无法使用3D操作",
    stackLabel: "叠放",
    spreadLabel: "展开",
    signalGroupLabel: "查看使用提示",
    selectedSignalLabel: "当前提示",
    interactionHint: "选择提示，左右拖动即可旋转。",
    resetView: "重置视角",
    disclosureLabel: "为什么是这个提示？",
    educationNotice: "仅供学习。并非对任何真实迷因的判定。",
    demoDisclaimer: "这是用于说明提示体系的教学演示，并非对任何真实迷因的判定。请另行查看每个迷因的已审核用例。",
  },
  "zh-tw": {
    controlsLabel: "場景控制",
    scrollLayout: "捲動",
    scrollHint: "向下捲動展開圖層，向上捲動重新聚合。",
    scrollPaused: "動畫已暫停，播放後將跟隨目前捲動位置。",
    scrollReduced: "已依減少動態效果的設定關閉捲動動畫，請使用版面按鈕。",
    scrollSteps: ["聚合", "展開", "探索"],
    brandLabel: "MemeCatch Studio",
    layoutLabel: "3D圖層檢視",
    layoutLoading: "正在載入3D",
    layoutUnavailable: "靜態檢視 · 無法使用3D操作",
    stackLabel: "堆疊",
    spreadLabel: "展開",
    signalGroupLabel: "查看使用提示",
    selectedSignalLabel: "目前提示",
    interactionHint: "選擇提示，左右拖曳即可旋轉。",
    resetView: "重設視角",
    disclosureLabel: "為什麼是這個提示？",
    educationNotice: "僅供學習。並非對任何真實迷因的判定。",
    demoDisclaimer: "這是用來說明提示系統的教學示範，並非對任何真實迷因的判定。請另外查看每個迷因的已審核用例。",
  },
} as const satisfies Record<SeoRouteLocale, HomeSceneCopy>;
