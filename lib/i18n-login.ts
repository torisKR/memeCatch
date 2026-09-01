import { withLocaleFallback, type Locale } from "@/lib/i18n";

type LoginCopy = {
  brand: string;
  loginTitle: string;
  signupTitle: string;
  loginDescription: string;
  signupDescription: string;
  callbackError: string;
  providerNames: { kakao: string; google: string };
  oauthUnavailable: (provider: string) => string;
  kaiaButton: string;
  kaiaAccountNotice: string;
  kaiaUnavailable: string;
  kaiaWrongChain: string;
  kaiaRejected: string;
  kaiaGenericError: string;
  kakaoButton: string;
  googleButton: string;
  tiktokButton: string;
  emailDivider: string;
  tabListLabel: string;
  loginTab: string;
  signupTab: string;
  email: string;
  password: string;
  nickname: string;
  nicknamePlaceholder: string;
  newPasswordPlaceholder: string;
  loginSubmit: string;
  loginPending: string;
  signupSubmit: string;
  signupPending: string;
  forgotPassword: string;
  browseWithoutLogin: string;
};

const BASE: { ko: LoginCopy; en: LoginCopy; ja: LoginCopy; zh: LoginCopy } = {
  ko: {
    brand: "밈캐치",
    loginTitle: "다시 만나서 반가워요",
    signupTitle: "밈캐치에 어서 오세요",
    loginDescription: "로그인하면 밈 저장과 제보를 이어서 할 수 있어요.",
    signupDescription: "가입하면 밈을 저장하고 직접 제보할 수 있어요.",
    callbackError: "로그인 링크가 만료됐거나 잘못됐어요. 다시 로그인해 주세요.",
    providerNames: { kakao: "카카오", google: "구글" },
    oauthUnavailable: (provider) => `${provider} 로그인은 곧 열려요. 지금은 이메일로 시작해 주세요.`,
    kaiaButton: "Kaia Wallet로 로그인",
    kaiaAccountNotice: "지갑 로그인은 기존 이메일 계정과 자동으로 연결되지 않아요.",
    kaiaUnavailable: "Kaia Wallet을 찾지 못했어요. Kaia Wallet을 설치하거나 지갑 브라우저에서 다시 시도해 주세요.",
    kaiaWrongChain: "Kaia Mainnet으로 네트워크를 변경한 뒤 다시 시도해 주세요.",
    kaiaRejected: "Kaia Wallet 서명이 취소됐어요. 로그인하려면 다시 시도해 주세요.",
    kaiaGenericError: "Kaia Wallet 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.",
    kakaoButton: "카카오로 시작하기",
    googleButton: "구글로 시작하기",
    tiktokButton: "TikTok으로 시작하기",
    emailDivider: "또는 이메일로",
    tabListLabel: "로그인 방법 선택",
    loginTab: "로그인",
    signupTab: "가입하기",
    email: "이메일",
    password: "비밀번호",
    nickname: "닉네임",
    nicknamePlaceholder: "2~20자로 지어 주세요",
    newPasswordPlaceholder: "6자 이상",
    loginSubmit: "로그인",
    loginPending: "로그인 중…",
    signupSubmit: "가입하고 시작하기",
    signupPending: "가입 중…",
    forgotPassword: "비밀번호를 잊으셨나요?",
    browseWithoutLogin: "로그인 없이 둘러보기",
  },
  en: {
    brand: "MemeCatch",
    loginTitle: "Welcome back",
    signupTitle: "Welcome to MemeCatch",
    loginDescription: "Log in to keep saving and submitting memes.",
    signupDescription: "Create an account to save and submit memes.",
    callbackError: "This login link is invalid or has expired. Please log in again.",
    providerNames: { kakao: "Kakao", google: "Google" },
    oauthUnavailable: (provider) => `${provider} login is not available yet. Please use email for now.`,
    kaiaButton: "Continue with Kaia Wallet",
    kaiaAccountNotice: "Wallet login does not automatically link to an existing email account.",
    kaiaUnavailable: "Kaia Wallet was not found. Install it or try again in the wallet browser.",
    kaiaWrongChain: "Switch to Kaia Mainnet and try again.",
    kaiaRejected: "The Kaia Wallet signature was cancelled. Try again to log in.",
    kaiaGenericError: "Kaia Wallet login failed. Please try again shortly.",
    kakaoButton: "Continue with Kakao",
    googleButton: "Continue with Google",
    tiktokButton: "Continue with TikTok",
    emailDivider: "or continue with email",
    tabListLabel: "Choose login method",
    loginTab: "Log in",
    signupTab: "Sign up",
    email: "Email",
    password: "Password",
    nickname: "Nickname",
    nicknamePlaceholder: "Use 2–20 characters",
    newPasswordPlaceholder: "At least 6 characters",
    loginSubmit: "Log in",
    loginPending: "Logging in…",
    signupSubmit: "Create account",
    signupPending: "Creating account…",
    forgotPassword: "Forgot your password?",
    browseWithoutLogin: "Browse without logging in",
  },
  ja: {
    brand: "MemeCatch",
    loginTitle: "おかえりなさい",
    signupTitle: "MemeCatchへようこそ",
    loginDescription: "ログインすると、ミームの保存や投稿を続けられます。",
    signupDescription: "アカウントを作成すると、ミームを保存・投稿できます。",
    callbackError: "ログインリンクが無効か、有効期限が切れています。もう一度ログインしてください。",
    providerNames: { kakao: "Kakao", google: "Google" },
    oauthUnavailable: (provider) => `${provider}ログインはまだ利用できません。現在はメールをご利用ください。`,
    kaiaButton: "Kaia Walletでログイン",
    kaiaAccountNotice: "ウォレットログインは既存のメールアカウントに自動連携されません。",
    kaiaUnavailable: "Kaia Walletが見つかりません。インストールするか、ウォレットブラウザで再試行してください。",
    kaiaWrongChain: "Kaia Mainnetに切り替えてから、もう一度お試しください。",
    kaiaRejected: "Kaia Walletの署名がキャンセルされました。ログインするにはもう一度お試しください。",
    kaiaGenericError: "Kaia Walletでのログインに失敗しました。しばらくしてからもう一度お試しください。",
    kakaoButton: "Kakaoで続ける",
    googleButton: "Googleで続ける",
    tiktokButton: "TikTokで続ける",
    emailDivider: "またはメールで続ける",
    tabListLabel: "ログイン方法を選択",
    loginTab: "ログイン",
    signupTab: "新規登録",
    email: "メールアドレス",
    password: "パスワード",
    nickname: "ニックネーム",
    nicknamePlaceholder: "2～20文字で入力",
    newPasswordPlaceholder: "6文字以上",
    loginSubmit: "ログイン",
    loginPending: "ログイン中…",
    signupSubmit: "アカウントを作成",
    signupPending: "作成中…",
    forgotPassword: "パスワードをお忘れですか？",
    browseWithoutLogin: "ログインせずに見る",
  },
  zh: {
    brand: "MemeCatch",
    loginTitle: "欢迎回来",
    signupTitle: "欢迎来到 MemeCatch",
    loginDescription: "登录后可继续收藏和投稿迷因。",
    signupDescription: "创建账户即可收藏和投稿迷因。",
    callbackError: "登录链接无效或已过期，请重新登录。",
    providerNames: { kakao: "Kakao", google: "Google" },
    oauthUnavailable: (provider) => `${provider} 登录暂未开放，请先使用邮箱。`,
    kaiaButton: "使用 Kaia Wallet 登录",
    kaiaAccountNotice: "钱包登录不会自动关联已有的邮箱账户。",
    kaiaUnavailable: "未找到 Kaia Wallet。请安装钱包，或在钱包浏览器中重试。",
    kaiaWrongChain: "请切换到 Kaia Mainnet 后重试。",
    kaiaRejected: "Kaia Wallet 签名已取消。如需登录，请重试。",
    kaiaGenericError: "Kaia Wallet 登录失败，请稍后重试。",
    kakaoButton: "使用 Kakao 继续",
    googleButton: "使用 Google 继续",
    tiktokButton: "使用 TikTok 继续",
    emailDivider: "或使用邮箱继续",
    tabListLabel: "选择登录方式",
    loginTab: "登录",
    signupTab: "注册",
    email: "邮箱",
    password: "密码",
    nickname: "昵称",
    nicknamePlaceholder: "请输入 2–20 个字符",
    newPasswordPlaceholder: "至少 6 个字符",
    loginSubmit: "登录",
    loginPending: "正在登录…",
    signupSubmit: "创建账户",
    signupPending: "正在创建…",
    forgotPassword: "忘记密码？",
    browseWithoutLogin: "不登录直接浏览",
  },
};

export const LOGIN_COPY: Record<Locale, LoginCopy> = withLocaleFallback(BASE);
