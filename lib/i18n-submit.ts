import { withLocaleFallback, type Locale } from "@/lib/i18n";

export type SubmitCopy = {
  metadata: { title: string; description: string };
  page: {
    title: string;
    intro: string;
    reviewProcess: string;
    reviewSteps: readonly [string, string, string, string];
    tiktokTitle: string;
    tiktokBody: string;
    tiktokAction: string;
    tiktokDone: (count: number) => string;
    tiktokEmpty: string;
    tiktokFailed: string;
    closedTitle: string;
    closedBody: string;
    home: string;
    loadErrorTitle: string;
    loadErrorBody: string;
    retry: string;
    loading: string;
  };
  form: {
    restored: string;
    required: string;
    nameLabel: string;
    namePlaceholder: string;
    duplicateLoading: string;
    duplicateTitle: string;
    duplicateBody: string;
    seenAtLabel: string;
    seenAtPlaceholder: string;
    sourceUrlLabel: string;
    sourceUrlPlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    guessLabel: string;
    guessPlaceholder: string;
    tagsLabel: string;
    tagsPlaceholder: string;
    attachmentLabel: string;
    attachmentHint: string;
    attachmentRetry: string;
    attachmentPreview: string;
    removeAttachment: string;
    uploading: string;
    submitting: string;
    submit: string;
    draftHint: string;
    successBadge: string;
    successTitle: string;
    successBody: string;
    viewMy: string;
    submitAnother: string;
  };
  preview: {
    idle: string;
    unsupported: string;
    label: string;
    checking: string;
    ready: string;
    providerContent: (provider: string) => string;
    verifyBody: string;
    verifying: string;
    verify: string;
    errorSuffix: string;
    frameTitle: (provider: string) => string;
    genericError: string;
    unsafeError: string;
  };
  errors: {
    submissionsClosed: string;
    nameRequired: string;
    nameTooLong: string;
    seenAtTooLong: string;
    sourceUrlTooLong: string;
    sourceUrlInvalid: string;
    descriptionTooLong: string;
    guessTooLong: string;
    tagsTooLong: string;
    attachmentTooLong: string;
    loginRequired: string;
    sourceUnavailable: string;
    attachmentInvalid: string;
    rateLimited: string;
    submitFailed: string;
    imageType: string;
    imageTooLarge: string;
    imageUploadFailed: string;
  };
};

const SUBMIT_COPY_BASE = {
  ko: {
    metadata: {
      title: "밈 제보",
      description: "처음 본 밈을 알려 주세요. 검토 후 밈캐치에 등록돼요.",
    },
    page: {
      title: "밈 제보하기",
      intro:
        "처음 본 밈을 알려 주세요. 검토를 거쳐 24~48시간 안에 등록 여부를 알려드려요.",
      reviewProcess: "검수 절차",
      reviewSteps: ["제보", "사실 확인", "저작권 확인", "공개"],
      tiktokTitle: "내 TikTok 공개 영상 가져오기",
      tiktokBody:
        "동의한 계정의 최신 공개 영상 최대 20개를 검수 대기로만 추가해요. 자동 공개하지 않아요.",
      tiktokAction: "TikTok 영상 가져오기",
      tiktokDone: (count) => `${count}개 영상을 검수 대기로 추가했어요.`,
      tiktokEmpty: "새로 추가할 영상은 없어요.",
      tiktokFailed:
        "영상을 가져오지 못했어요. TikTok에서 video.list 권한을 허용한 뒤 다시 시도해 주세요.",
      closedTitle: "제보 준비 중이에요",
      closedBody: "지금은 제보를 받지 않아요. 준비가 끝나면 바로 열어드릴게요.",
      home: "홈으로 돌아가기",
      loadErrorTitle: "제보 화면을 불러오지 못했어요",
      loadErrorBody: "잠시 후 다시 시도해 주세요.",
      retry: "다시 시도",
      loading: "불러오는 중이에요",
    },
    form: {
      restored: "작성하던 내용을 불러왔어요.",
      required: "필수",
      nameLabel: "밈 이름",
      namePlaceholder: "예: 우당탕탕",
      duplicateLoading: "비슷한 밈이 있는지 확인하는 중…",
      duplicateTitle: "이미 등록된 밈 아닌가요?",
      duplicateBody: "같은 밈이면 제보 대신 그 페이지에서 반응을 남겨 주세요.",
      seenAtLabel: "어디서 봤나요?",
      seenAtPlaceholder: "예: 인스타 릴스, 회사 단톡방",
      sourceUrlLabel: "원본 콘텐츠 링크",
      sourceUrlPlaceholder: "YouTube·Shorts·Instagram·TikTok 링크",
      descriptionLabel: "설명",
      descriptionPlaceholder:
        "무슨 뜻인지, 어떻게 쓰이는지 아는 만큼 적어 주세요",
      guessLabel: "왜 유행하는 것 같나요?",
      guessPlaceholder: "추측이어도 좋아요. 검토에 큰 도움이 돼요",
      tagsLabel: "태그",
      tagsPlaceholder: "콤마로 구분 (예: 직장인, 유행어)",
      attachmentLabel: "짤/캡처 이미지 첨부(선택)",
      attachmentHint: "JPG·PNG·WebP·GIF, 5MB 이하",
      attachmentRetry: "제보 보내기를 다시 눌러 재시도할 수 있어요",
      attachmentPreview: "첨부한 이미지 미리보기",
      removeAttachment: "제거",
      uploading: "이미지 올리는 중…",
      submitting: "제보 보내는 중…",
      submit: "제보 보내기",
      draftHint: "작성 중인 내용은 이 기기에 자동으로 임시저장돼요.",
      successBadge: "접수됨",
      successTitle: "접수됨",
      successBody:
        "제보해 주셔서 고마워요. 검토가 끝나면 MY에서 결과를 알려드려요.",
      viewMy: "MY에서 제보 상태 보기",
      submitAnother: "다른 밈 제보하기",
    },
    preview: {
      idle: "YouTube·Shorts·Instagram·TikTok 링크를 붙이면 제출 전에 확인할 수 있어요.",
      unsupported:
        "일반 출처 링크로 제출할 수 있어요. 영상 미리보기는 YouTube·Instagram·TikTok을 지원해요.",
      label: "콘텐츠 링크 미리보기",
      checking: "콘텐츠 신호 확인",
      ready: "공개 콘텐츠를 확인했어요",
      providerContent: (provider) => `${provider} 콘텐츠`,
      verifyBody: "링크가 공개 상태이고 사이트 안에서 재생되는지 확인합니다.",
      verifying: "공개 콘텐츠 확인 중…",
      verify: "링크 확인하고 미리보기",
      errorSuffix: "삭제·비공개·연령 제한 여부와 URL을 확인해 주세요.",
      frameTitle: (provider) => `${provider} 콘텐츠 미리보기`,
      genericError: "콘텐츠를 확인하지 못했어요.",
      unsafeError: "안전한 미리보기 주소를 확인하지 못했어요.",
    },
    errors: {
      submissionsClosed: "지금은 제보를 받지 않아요. 조금만 기다려 주세요",
      nameRequired: "밈 이름을 입력해 주세요",
      nameTooLong: "이름은 100자 이내로 입력해 주세요",
      seenAtTooLong: "200자 이내로 입력해 주세요",
      sourceUrlTooLong: "링크가 너무 길어요",
      sourceUrlInvalid: "https:// 로 시작하는 링크만 넣을 수 있어요",
      descriptionTooLong: "설명은 2000자 이내로 입력해 주세요",
      guessTooLong: "1000자 이내로 입력해 주세요",
      tagsTooLong: "태그가 너무 길어요",
      attachmentTooLong: "첨부 이미지 정보가 너무 길어요",
      loginRequired: "로그인이 필요해요. 로그인 후 다시 시도해 주세요",
      sourceUnavailable:
        "콘텐츠를 확인하지 못했어요. 공개 링크인지 다시 확인해 주세요",
      attachmentInvalid:
        "첨부 이미지 정보가 올바르지 않아요. 이미지를 다시 올려 주세요",
      rateLimited:
        "너무 빨라요 — 제보는 1시간에 5개까지만 보낼 수 있어요. 잠시 후 다시 시도해 주세요",
      submitFailed: "제보 접수에 실패했어요. 잠시 후 다시 시도해 주세요",
      imageType: "JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요",
      imageTooLarge: "이미지는 5MB 이하만 올릴 수 있어요",
      imageUploadFailed: "이미지 업로드에 실패했어요. 다시 시도해 주세요",
    },
  },
  en: {
    metadata: {
      title: "Submit a meme",
      description:
        "Tell us about a meme you found. We review every submission before adding it to MemeCatch.",
    },
    page: {
      title: "Submit a meme",
      intro:
        "Tell us about a meme you found. We will let you know within 24–48 hours whether it can be added.",
      reviewProcess: "Review process",
      reviewSteps: ["Submit", "Fact check", "Copyright check", "Publish"],
      tiktokTitle: "Import my public TikTok videos",
      tiktokBody:
        "We add up to 20 recent public videos from the account you approve to the review queue only. Nothing is published automatically.",
      tiktokAction: "Import TikTok videos",
      tiktokDone: (count) => `Added ${count} videos to the review queue.`,
      tiktokEmpty: "There are no new videos to add.",
      tiktokFailed:
        "We could not import the videos. Allow TikTok's video.list permission and try again.",
      closedTitle: "Submissions are being prepared",
      closedBody:
        "We are not accepting submissions right now. We will open them as soon as they are ready.",
      home: "Return home",
      loadErrorTitle: "We could not load the submission page",
      loadErrorBody: "Please try again shortly.",
      retry: "Try again",
      loading: "Loading",
    },
    form: {
      restored: "We restored what you were writing.",
      required: "required",
      nameLabel: "Meme name",
      namePlaceholder: "e.g. Oops chaos",
      duplicateLoading: "Checking for a similar meme…",
      duplicateTitle: "Is this meme already listed?",
      duplicateBody:
        "If it is the same meme, leave a reaction on that page instead of submitting it again.",
      seenAtLabel: "Where did you see it?",
      seenAtPlaceholder: "e.g. Instagram Reels, a work group chat",
      sourceUrlLabel: "Original content link",
      sourceUrlPlaceholder: "YouTube · Shorts · Instagram · TikTok link",
      descriptionLabel: "Description",
      descriptionPlaceholder:
        "Share as much as you know about what it means and how it is used",
      guessLabel: "Why do you think it is trending?",
      guessPlaceholder: "A guess is welcome and helps our review",
      tagsLabel: "Tags",
      tagsPlaceholder: "Separate with commas (e.g. office, slang)",
      attachmentLabel: "Attach an image or capture (optional)",
      attachmentHint: "JPG · PNG · WebP · GIF, up to 5MB",
      attachmentRetry: "You can try again by pressing Submit.",
      attachmentPreview: "Attached image preview",
      removeAttachment: "Remove",
      uploading: "Uploading image…",
      submitting: "Submitting…",
      submit: "Submit meme",
      draftHint: "What you are writing is saved as a draft on this device.",
      successBadge: "Received",
      successTitle: "Received",
      successBody:
        "Thanks for the submission. We will show the result in MY when the review is complete.",
      viewMy: "View submission status in MY",
      submitAnother: "Submit another meme",
    },
    preview: {
      idle: "Paste a YouTube, Shorts, Instagram, or TikTok link to check it before submitting.",
      unsupported:
        "You can submit a general source link. Video previews support YouTube, Instagram, and TikTok.",
      label: "Content link preview",
      checking: "Checking the content signal",
      ready: "We confirmed public content",
      providerContent: (provider) => `${provider} content`,
      verifyBody: "We check that the link is public and can play on this site.",
      verifying: "Checking public content…",
      verify: "Check link and preview",
      errorSuffix:
        "Check whether it was deleted, made private, age-restricted, or has the right URL.",
      frameTitle: (provider) => `${provider} content preview`,
      genericError: "We could not check this content.",
      unsafeError: "We could not verify a safe preview address.",
    },
    errors: {
      submissionsClosed:
        "Submissions are not open right now. Please check back soon.",
      nameRequired: "Enter a meme name.",
      nameTooLong: "Use 100 characters or fewer for the name.",
      seenAtTooLong: "Use 200 characters or fewer.",
      sourceUrlTooLong: "The link is too long.",
      sourceUrlInvalid: "Use a link that starts with https://.",
      descriptionTooLong: "Use 2,000 characters or fewer for the description.",
      guessTooLong: "Use 1,000 characters or fewer.",
      tagsTooLong: "The tags are too long.",
      attachmentTooLong: "The attachment information is too long.",
      loginRequired: "Log in, then try again.",
      sourceUnavailable:
        "We could not check the content. Confirm that the link is public and try again.",
      attachmentInvalid:
        "The attachment information is invalid. Upload the image again.",
      rateLimited:
        "That was fast — you can submit up to five memes per hour. Try again shortly.",
      submitFailed: "We could not submit your meme. Please try again shortly.",
      imageType: "Upload a JPG, PNG, WebP, or GIF image.",
      imageTooLarge: "Images must be 5MB or smaller.",
      imageUploadFailed: "We could not upload the image. Please try again.",
    },
  },
  ja: {
    metadata: {
      title: "ミームを投稿",
      description:
        "見つけたミームを教えてください。MemeCatchへ追加する前に確認します。",
    },
    page: {
      title: "ミームを投稿",
      intro:
        "見つけたミームを教えてください。掲載できるかどうかを24〜48時間以内にお知らせします。",
      reviewProcess: "確認の流れ",
      reviewSteps: ["投稿", "事実確認", "著作権確認", "公開"],
      tiktokTitle: "公開TikTok動画を取り込む",
      tiktokBody:
        "同意したアカウントの最近の公開動画を最大20件、確認待ちにだけ追加します。自動公開はしません。",
      tiktokAction: "TikTok動画を取り込む",
      tiktokDone: (count) => `${count}件の動画を確認待ちに追加しました。`,
      tiktokEmpty: "新たに追加する動画はありません。",
      tiktokFailed:
        "動画を取り込めませんでした。TikTokのvideo.list権限を許可してからもう一度お試しください。",
      closedTitle: "投稿を準備中です",
      closedBody: "現在は投稿を受け付けていません。準備ができ次第公開します。",
      home: "ホームに戻る",
      loadErrorTitle: "投稿画面を読み込めませんでした",
      loadErrorBody: "しばらくしてからもう一度お試しください。",
      retry: "再試行",
      loading: "読み込み中",
    },
    form: {
      restored: "入力中の内容を復元しました。",
      required: "必須",
      nameLabel: "ミーム名",
      namePlaceholder: "例：ドタバタ",
      duplicateLoading: "似たミームがないか確認しています…",
      duplicateTitle: "すでに登録されているミームではありませんか？",
      duplicateBody:
        "同じミームなら、再投稿せずそのページにリアクションを残してください。",
      seenAtLabel: "どこで見ましたか？",
      seenAtPlaceholder: "例：Instagram Reels、職場のグループチャット",
      sourceUrlLabel: "元コンテンツのリンク",
      sourceUrlPlaceholder: "YouTube・Shorts・Instagram・TikTokのリンク",
      descriptionLabel: "説明",
      descriptionPlaceholder: "意味や使われ方を知っている範囲で書いてください",
      guessLabel: "なぜ流行していると思いますか？",
      guessPlaceholder: "推測でも確認の助けになります",
      tagsLabel: "タグ",
      tagsPlaceholder: "カンマ区切り（例：職場、スラング）",
      attachmentLabel: "画像・キャプチャを添付（任意）",
      attachmentHint: "JPG・PNG・WebP・GIF、5MBまで",
      attachmentRetry: "投稿ボタンをもう一度押して再試行できます。",
      attachmentPreview: "添付画像のプレビュー",
      removeAttachment: "削除",
      uploading: "画像をアップロード中…",
      submitting: "送信中…",
      submit: "ミームを投稿",
      draftHint: "入力中の内容はこの端末に下書き保存されます。",
      successBadge: "受付済み",
      successTitle: "受付済み",
      successBody:
        "投稿ありがとうございます。確認が終わるとMYで結果をお知らせします。",
      viewMy: "MYで投稿状況を見る",
      submitAnother: "別のミームを投稿",
    },
    preview: {
      idle: "YouTube・Shorts・Instagram・TikTokのリンクを貼ると、投稿前に確認できます。",
      unsupported:
        "一般の出典リンクも投稿できます。動画プレビューはYouTube・Instagram・TikTokに対応しています。",
      label: "コンテンツリンクのプレビュー",
      checking: "コンテンツの状態を確認",
      ready: "公開コンテンツを確認しました",
      providerContent: (provider) => `${provider}コンテンツ`,
      verifyBody: "リンクが公開され、サイト内で再生できるか確認します。",
      verifying: "公開コンテンツを確認中…",
      verify: "リンクを確認してプレビュー",
      errorSuffix: "削除・非公開・年齢制限・URLを確認してください。",
      frameTitle: (provider) => `${provider}コンテンツのプレビュー`,
      genericError: "コンテンツを確認できませんでした。",
      unsafeError: "安全なプレビューURLを確認できませんでした。",
    },
    errors: {
      submissionsClosed:
        "現在は投稿を受け付けていません。しばらくしてからもう一度ご確認ください。",
      nameRequired: "ミーム名を入力してください。",
      nameTooLong: "名前は100文字以内で入力してください。",
      seenAtTooLong: "200文字以内で入力してください。",
      sourceUrlTooLong: "リンクが長すぎます。",
      sourceUrlInvalid: "https://で始まるリンクを入力してください。",
      descriptionTooLong: "説明は2,000文字以内で入力してください。",
      guessTooLong: "1,000文字以内で入力してください。",
      tagsTooLong: "タグが長すぎます。",
      attachmentTooLong: "添付情報が長すぎます。",
      loginRequired: "ログインしてからもう一度お試しください。",
      sourceUnavailable:
        "コンテンツを確認できませんでした。公開リンクかどうか確認してください。",
      attachmentInvalid:
        "添付情報が正しくありません。画像をもう一度アップロードしてください。",
      rateLimited:
        "送信が早すぎます。1時間に5件まで投稿できます。しばらくしてからもう一度お試しください。",
      submitFailed:
        "投稿を受け付けられませんでした。しばらくしてからもう一度お試しください。",
      imageType: "JPG、PNG、WebP、GIF画像をアップロードしてください。",
      imageTooLarge: "画像は5MB以下にしてください。",
      imageUploadFailed:
        "画像をアップロードできませんでした。もう一度お試しください。",
    },
  },
  zh: {
    metadata: {
      title: "投稿迷因",
      description: "告诉我们你发现的迷因。MemeCatch 会在收录前进行审核。",
    },
    page: {
      title: "投稿迷因",
      intro: "告诉我们你发现的迷因。我们会在 24–48 小时内告知是否可以收录。",
      reviewProcess: "审核流程",
      reviewSteps: ["投稿", "事实核查", "版权核查", "发布"],
      tiktokTitle: "导入我的公开 TikTok 视频",
      tiktokBody:
        "我们最多只会将你授权账号的 20 个近期公开视频加入审核队列，不会自动发布。",
      tiktokAction: "导入 TikTok 视频",
      tiktokDone: (count) => `已将 ${count} 个视频加入审核队列。`,
      tiktokEmpty: "没有新视频可添加。",
      tiktokFailed: "无法导入视频。请允许 TikTok 的 video.list 权限后重试。",
      closedTitle: "投稿功能准备中",
      closedBody: "目前暂不接受投稿，准备完成后会立即开放。",
      home: "返回首页",
      loadErrorTitle: "无法加载投稿页面",
      loadErrorBody: "请稍后重试。",
      retry: "重试",
      loading: "加载中",
    },
    form: {
      restored: "已恢复你刚才填写的内容。",
      required: "必填",
      nameLabel: "迷因名称",
      namePlaceholder: "例如：手忙脚乱",
      duplicateLoading: "正在查找相似迷因…",
      duplicateTitle: "这个迷因是否已经收录？",
      duplicateBody: "如果是同一个迷因，请在该页面留下互动，而不是再次投稿。",
      seenAtLabel: "你在哪里看到的？",
      seenAtPlaceholder: "例如：Instagram Reels、工作群聊",
      sourceUrlLabel: "原始内容链接",
      sourceUrlPlaceholder: "YouTube · Shorts · Instagram · TikTok 链接",
      descriptionLabel: "说明",
      descriptionPlaceholder: "请尽量写下你知道的含义和使用方式",
      guessLabel: "你认为它为什么流行？",
      guessPlaceholder: "推测也能帮助审核",
      tagsLabel: "标签",
      tagsPlaceholder: "用逗号分隔（例如：职场、流行语）",
      attachmentLabel: "附加图片或截图（可选）",
      attachmentHint: "JPG · PNG · WebP · GIF，最大 5MB",
      attachmentRetry: "再次按下投稿按钮即可重试。",
      attachmentPreview: "附加图片预览",
      removeAttachment: "移除",
      uploading: "正在上传图片…",
      submitting: "正在投稿…",
      submit: "投稿迷因",
      draftHint: "正在填写的内容会自动保存在此设备上。",
      successBadge: "已收到",
      successTitle: "已收到",
      successBody: "感谢投稿。审核完成后会在“我的”中通知你结果。",
      viewMy: "在“我的”查看投稿状态",
      submitAnother: "再投稿一个迷因",
    },
    preview: {
      idle: "粘贴 YouTube、Shorts、Instagram 或 TikTok 链接，即可在投稿前确认。",
      unsupported:
        "也可以提交一般来源链接。视频预览支持 YouTube、Instagram 和 TikTok。",
      label: "内容链接预览",
      checking: "正在确认内容状态",
      ready: "已确认公开内容",
      providerContent: (provider) => `${provider} 内容`,
      verifyBody: "我们会确认链接是否公开，以及能否在本站播放。",
      verifying: "正在确认公开内容…",
      verify: "确认链接并预览",
      errorSuffix:
        "请检查内容是否已删除、设为私密、受年龄限制，或 URL 是否正确。",
      frameTitle: (provider) => `${provider} 内容预览`,
      genericError: "无法确认此内容。",
      unsafeError: "无法确认安全的预览地址。",
    },
    errors: {
      submissionsClosed: "目前暂不接受投稿，请稍后再来。",
      nameRequired: "请输入迷因名称。",
      nameTooLong: "名称请控制在 100 个字符以内。",
      seenAtTooLong: "请控制在 200 个字符以内。",
      sourceUrlTooLong: "链接过长。",
      sourceUrlInvalid: "请输入以 https:// 开头的链接。",
      descriptionTooLong: "说明请控制在 2,000 个字符以内。",
      guessTooLong: "请控制在 1,000 个字符以内。",
      tagsTooLong: "标签过长。",
      attachmentTooLong: "附加图片信息过长。",
      loginRequired: "请登录后重试。",
      sourceUnavailable: "无法确认内容，请检查链接是否公开。",
      attachmentInvalid: "附加图片信息无效，请重新上传图片。",
      rateLimited: "操作太快了：每小时最多投稿 5 个迷因，请稍后重试。",
      submitFailed: "无法提交迷因，请稍后重试。",
      imageType: "请上传 JPG、PNG、WebP 或 GIF 图片。",
      imageTooLarge: "图片大小必须不超过 5MB。",
      imageUploadFailed: "无法上传图片，请重试。",
    },
  },
} satisfies Record<"ko" | "en" | "ja" | "zh", SubmitCopy>;

export const SUBMIT_COPY: Record<Locale, SubmitCopy> =
  withLocaleFallback<SubmitCopy>(SUBMIT_COPY_BASE);
