export const SUPPORTED_LOCALES = [
  "ko", "en", "ja", "zh", "zh-tw", "th", "vi", "mn", "id", "ar",
  "ru", "es", "de", "fr", "it", "pt", "tr", "ms", "hi",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** UI 문자열 본번역이 존재하는 로케일. 나머지는 en(zh-tw는 zh) 폴백. */
export type TranslatedLocale = "ko" | "en" | "ja" | "zh";

export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_COOKIE = "memecatch_locale";
export const LOCALE_HEADER = "x-memecatch-locale";

export const LANGUAGE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文(简体)",
  "zh-tw": "中文(繁體)",
  th: "ภาษาไทย",
  vi: "Tiếng Việt",
  mn: "Монгол",
  id: "Bahasa Indonesia",
  ar: "العربية",
  ru: "Русский",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  tr: "Türkçe",
  ms: "Bahasa Melayu",
  hi: "हिन्दी",
};

export const LANGUAGE_FLAGS: Record<Locale, string> = {
  ko: "🇰🇷",
  en: "🇺🇸",
  ja: "🇯🇵",
  zh: "🇨🇳",
  "zh-tw": "🇹🇼",
  th: "🇹🇭",
  vi: "🇻🇳",
  mn: "🇲🇳",
  id: "🇮🇩",
  ar: "🇦🇪",
  ru: "🇷🇺",
  es: "🇪🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  it: "🇮🇹",
  pt: "🇧🇷",
  tr: "🇹🇷",
  ms: "🇲🇾",
  hi: "🇮🇳",
};

export const LANGUAGE_SHORT_NAMES: Record<Locale, string> = {
  ko: "KO", en: "EN", ja: "JA", zh: "ZH", "zh-tw": "TW", th: "TH", vi: "VI",
  mn: "MN", id: "ID", ar: "AR", ru: "RU", es: "ES", de: "DE", fr: "FR",
  it: "IT", pt: "PT", tr: "TR", ms: "MS", hi: "HI",
};

/** Intl(날짜·숫자 포맷)용 BCP47 태그. */
const BCP47_TAGS: Record<Locale, string> = {
  ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN", "zh-tw": "zh-TW", th: "th-TH",
  vi: "vi-VN", mn: "mn-MN", id: "id-ID", ar: "ar", ru: "ru-RU", es: "es-ES",
  de: "de-DE", fr: "fr-FR", it: "it-IT", pt: "pt-BR", tr: "tr-TR", ms: "ms-MY", hi: "hi-IN",
};

export function toBcp47(locale: Locale): string {
  return BCP47_TAGS[locale];
}

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDocumentLanguage(locale: Locale): string {
  if (locale === "zh") return "zh-Hans";
  if (locale === "zh-tw") return "zh-Hant";
  return locale;
}

export function getDocumentDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function localeFromLanguageTag(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const parts = value.trim().toLowerCase().split(/[-_]/);
  const language = parts[0];
  if (language === "zh") {
    const traditional = parts
      .slice(1)
      .some((part) => part === "tw" || part === "hk" || part === "mo" || part === "hant");
    return traditional ? "zh-tw" : "zh";
  }
  return isLocale(language) ? language : null;
}

export function localeFromCountry(value: string | null | undefined): Locale | null {
  switch (value?.trim().toUpperCase()) {
    case "KR": return "ko";
    case "JP": return "ja";
    case "CN": return "zh";
    case "HK":
    case "MO":
    case "TW": return "zh-tw";
    case "TH": return "th";
    case "VN": return "vi";
    case "MN": return "mn";
    case "ID": return "id";
    case "AE":
    case "SA":
    case "EG": return "ar";
    case "RU": return "ru";
    case "ES":
    case "MX":
    case "AR": return "es";
    case "DE":
    case "AT": return "de";
    case "FR": return "fr";
    case "IT": return "it";
    case "BR":
    case "PT": return "pt";
    case "TR": return "tr";
    case "MY": return "ms";
    case "IN": return "hi";
    default: return null;
  }
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const entries = value
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = Number(parameters.find((item) => item.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { locale: localeFromLanguageTag(tag), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry): entry is { locale: Locale; quality: number } => entry.locale !== null)
    .sort((a, b) => b.quality - a.quality);
  return entries[0]?.locale ?? null;
}

const CORE_MESSAGES = {
  ko: {
    brand: "밈캐치", home: "밈캐치 홈", search: "밈 검색", searchPlaceholder: "밈 검색",
    explore: "탐색", timeline: "연표", community: "커뮤니티", submit: "제보", my: "MY", login: "로그인",
    savedMemes: "저장한 밈", logout: "로그아웃", greeting: "님, 어서 오세요", accountMenu: "내 계정",
    random: "아무 밈이나 보기", findingMeme: "밈을 찾고 있어요", language: "언어 설정", languageMenu: "언어 선택",
    footerNav: "사이트 정보", about: "밈캐치 소개", editorial: "편집 원칙", privacy: "개인정보처리방침", terms: "이용약관",
    rankings: "밈캐치 내 급상승",
    news: "세대별 밈 소식", donate: "후원하기", legalSummary: "운영·저작권 안내",
    support: "고객센터",
    donateCardTitle: "이 사전, 도움이 되셨나요?",
    donateCardBody: "밈캐치는 1인 개발자가 운영하는 밈 정보 서비스예요. 커피 한 잔이면 다음 밈도 계속 기록할 수 있어요.",
    legal1: "밈캐치는 한국 밈·유행어의 뜻과 유래를 기록하는 사전 서비스입니다. 모든 제보는 운영자 검수(사실 확인 → 저작권 확인)를 거쳐 공개됩니다.",
    legal2: "제3자 원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공하며, 각 콘텐츠의 저작권은 원저작자에게 있습니다. 문의·삭제 요청:",
    mainNav: "주 내비게이션", discoveryNav: "주요 발견", menu: "메뉴",
  },
  en: {
    brand: "MemeCatch", home: "MemeCatch home", search: "Search memes", searchPlaceholder: "Search memes",
    explore: "Explore", timeline: "Timeline", community: "Community", submit: "Submit", my: "MY", login: "Log in",
    savedMemes: "Saved memes", logout: "Log out", greeting: "Welcome back", accountMenu: "My account",
    random: "Show a random meme", findingMeme: "Finding a meme", language: "Language", languageMenu: "Choose language",
    footerNav: "Site information", about: "About MemeCatch", editorial: "Editorial standards", privacy: "Privacy", terms: "Terms",
    rankings: "Rankings",
    news: "Meme news by age", donate: "Support us", legalSummary: "About & copyright",
    support: "Help center",
    donateCardTitle: "Did this help?",
    donateCardBody: "MemeCatch is an independent meme information service run by a solo developer. A coffee keeps the next meme documented.",
    legal1: "MemeCatch is a dictionary that documents the meaning and origin of Korean memes and trending expressions. Submissions are published only after fact and copyright review.",
    legal2: "We do not store original videos or images; we only provide source links and embeds. Copyright remains with each creator. Contact or removal requests:",
    mainNav: "Main navigation", discoveryNav: "Discover", menu: "Menu",
  },
  ja: {
    brand: "MemeCatch", home: "MemeCatch ホーム", search: "ミームを検索", searchPlaceholder: "ミームを検索",
    explore: "探す", timeline: "年表", community: "コミュニティ", submit: "投稿", my: "MY", login: "ログイン",
    savedMemes: "保存したミーム", logout: "ログアウト", greeting: "さん、ようこそ", accountMenu: "マイアカウント",
    random: "ランダムなミームを見る", findingMeme: "ミームを探しています", language: "言語", languageMenu: "言語を選択",
    footerNav: "サイト情報", about: "MemeCatchについて", editorial: "編集方針", privacy: "プライバシー", terms: "利用規約",
    rankings: "ランキング",
    news: "世代別ミーム情報", donate: "支援する", legalSummary: "運営・著作権について",
    support: "お問い合わせ",
    donateCardTitle: "お役に立ちましたか？",
    donateCardBody: "MemeCatchは個人開発者が運営するミーム情報サービスです。コーヒー一杯で次のミームも記録し続けられます。",
    legal1: "MemeCatchは韓国のミームや流行語の意味と由来を記録する辞典サービスです。投稿は事実・著作権の確認後に公開されます。",
    legal2: "元の動画・画像は保存せず、出典リンクと埋め込みのみを提供します。著作権は各制作者に帰属します。お問い合わせ・削除依頼：",
    mainNav: "メインナビゲーション", discoveryNav: "見つける", menu: "メニュー",
  },
  zh: {
    brand: "MemeCatch", home: "MemeCatch 首页", search: "搜索迷因", searchPlaceholder: "搜索迷因",
    explore: "发现", timeline: "时间线", community: "社区", submit: "投稿", my: "我的", login: "登录",
    savedMemes: "收藏的迷因", logout: "退出登录", greeting: "欢迎回来", accountMenu: "我的账户",
    random: "随机查看迷因", findingMeme: "正在寻找迷因", language: "语言", languageMenu: "选择语言",
    footerNav: "网站信息", about: "关于 MemeCatch", editorial: "编辑准则", privacy: "隐私政策", terms: "使用条款",
    rankings: "排行榜",
    news: "分年龄迷因资讯", donate: "支持我们", legalSummary: "运营与版权说明",
    support: "客服中心",
    donateCardTitle: "这份词典对你有帮助吗？",
    donateCardBody: "MemeCatch 是由独立开发者运营的迷因信息服务。一杯咖啡就能让下一个迷因继续被记录。",
    legal1: "MemeCatch 是记录韩国迷因和流行语含义及来源的词典服务。所有投稿均经事实与版权审核后发布。",
    legal2: "我们不保存原始视频或图片，仅提供来源链接和嵌入内容。版权归各创作者所有。咨询或删除请求：",
    mainNav: "主导航", discoveryNav: "发现", menu: "菜单",
  },
} as const;

export type Messages = { [K in keyof (typeof CORE_MESSAGES)["ko"]]: string };

/**
 * ko/en/ja/zh 본번역만 가진 사전을 전체 로케일 레코드로 확장한다.
 * 누락 로케일은 en(zh-tw는 zh)으로 폴백 — 신규 언어 추가 시 점진 번역을 허용.
 */
export function withLocaleFallback<T>(
  base: { ko: T; en: T; ja: T; zh: T } & Partial<Record<Locale, T>>,
): Record<Locale, T> {
  const result = {} as Record<Locale, T>;
  for (const locale of SUPPORTED_LOCALES) {
    result[locale] = base[locale] ?? (locale === "zh-tw" ? base.zh : base.en);
  }
  return result;
}

/**
 * 신규 로케일의 크롬(헤더·푸터·메뉴) 문자열 번역.
 * legal1/legal2 등 장문 고지는 en 폴백(zh-tw는 완역).
 */
const EXTRA_MESSAGES: Record<Exclude<Locale, TranslatedLocale>, Partial<Messages>> = {
  "zh-tw": {
    home: "MemeCatch 首頁", search: "搜尋迷因", searchPlaceholder: "搜尋迷因",
    explore: "探索", timeline: "時間線", community: "社群", submit: "投稿", my: "我的", login: "登入",
    savedMemes: "收藏的迷因", logout: "登出", greeting: "歡迎回來", accountMenu: "我的帳戶",
    random: "隨機查看迷因", findingMeme: "正在尋找迷因", language: "語言", languageMenu: "選擇語言",
    footerNav: "網站資訊", about: "關於 MemeCatch", editorial: "編輯準則", privacy: "隱私權政策", terms: "使用條款",
    rankings: "排行榜", news: "分年齡迷因資訊", donate: "支持我們",
    legalSummary: "營運與版權說明", support: "客服中心",
    donateCardTitle: "這份詞典對你有幫助嗎？",
    donateCardBody: "MemeCatch 是由獨立開發者營運的迷因資訊服務。一杯咖啡就能讓下一個迷因繼續被記錄。",
    legal1: "MemeCatch 是記錄韓國迷因和流行語含義及來源的詞典服務。所有投稿均經事實與版權審核後發布。",
    legal2: "我們不保存原始影片或圖片，僅提供來源連結和嵌入內容。版權歸各創作者所有。諮詢或刪除請求：",
    mainNav: "主導覽", discoveryNav: "探索", menu: "選單",
  },
  th: {
    home: "หน้าแรก MemeCatch", search: "ค้นหามีม", searchPlaceholder: "ค้นหามีม",
    explore: "สำรวจ", timeline: "ไทม์ไลน์", community: "คอมมูนิตี้", submit: "ส่งมีม", login: "เข้าสู่ระบบ",
    savedMemes: "มีมที่บันทึกไว้", logout: "ออกจากระบบ", greeting: "ยินดีต้อนรับกลับ", accountMenu: "บัญชีของฉัน",
    random: "สุ่มดูมีม", findingMeme: "กำลังหามีม", language: "ภาษา", languageMenu: "เลือกภาษา",
    footerNav: "ข้อมูลเว็บไซต์", about: "เกี่ยวกับ MemeCatch", privacy: "ความเป็นส่วนตัว", terms: "ข้อกำหนด",
    rankings: "อันดับ", news: "ข่าวมีมตามช่วงวัย", donate: "สนับสนุนเรา",
    legalSummary: "การดำเนินงานและลิขสิทธิ์", support: "ศูนย์ช่วยเหลือ", mainNav: "เมนูหลัก",
  },
  vi: {
    home: "Trang chủ MemeCatch", search: "Tìm meme", searchPlaceholder: "Tìm meme",
    explore: "Khám phá", timeline: "Dòng thời gian", community: "Cộng đồng", submit: "Gửi meme", login: "Đăng nhập",
    savedMemes: "Meme đã lưu", logout: "Đăng xuất", greeting: "Chào mừng trở lại", accountMenu: "Tài khoản của tôi",
    random: "Xem meme ngẫu nhiên", findingMeme: "Đang tìm meme", language: "Ngôn ngữ", languageMenu: "Chọn ngôn ngữ",
    footerNav: "Thông tin trang", about: "Giới thiệu MemeCatch", privacy: "Quyền riêng tư", terms: "Điều khoản",
    rankings: "Bảng xếp hạng", news: "Tin meme theo thế hệ", donate: "Ủng hộ",
    legalSummary: "Vận hành & bản quyền", support: "Trung tâm hỗ trợ", mainNav: "Điều hướng chính",
  },
  mn: {
    home: "MemeCatch нүүр", search: "Мем хайх", searchPlaceholder: "Мем хайх",
    explore: "Нээх", timeline: "Цагийн хэлхээс", community: "Нийгэмлэг", submit: "Илгээх", login: "Нэвтрэх",
    savedMemes: "Хадгалсан мемүүд", logout: "Гарах", greeting: "Тавтай морил", accountMenu: "Миний бүртгэл",
    random: "Санамсаргүй мем үзэх", findingMeme: "Мем хайж байна", language: "Хэл", languageMenu: "Хэл сонгох",
    footerNav: "Сайтын мэдээлэл", about: "MemeCatch-ийн тухай", privacy: "Нууцлал", terms: "Үйлчилгээний нөхцөл",
    rankings: "Чансаа", news: "Үеийн мем мэдээ", donate: "Дэмжих",
    legalSummary: "Үйл ажиллагаа ба зохиогчийн эрх", support: "Тусламжийн төв", mainNav: "Үндсэн цэс",
  },
  id: {
    home: "Beranda MemeCatch", search: "Cari meme", searchPlaceholder: "Cari meme",
    explore: "Jelajahi", timeline: "Linimasa", community: "Komunitas", submit: "Kirim", login: "Masuk",
    savedMemes: "Meme tersimpan", logout: "Keluar", greeting: "Selamat datang kembali", accountMenu: "Akun saya",
    random: "Lihat meme acak", findingMeme: "Mencari meme", language: "Bahasa", languageMenu: "Pilih bahasa",
    footerNav: "Informasi situs", about: "Tentang MemeCatch", privacy: "Privasi", terms: "Ketentuan",
    rankings: "Peringkat", news: "Berita meme per generasi", donate: "Dukung kami",
    legalSummary: "Operasional & hak cipta", support: "Pusat bantuan", mainNav: "Navigasi utama",
  },
  ar: {
    home: "الصفحة الرئيسية MemeCatch", search: "البحث عن الميمات", searchPlaceholder: "ابحث عن ميم",
    explore: "استكشاف", timeline: "الخط الزمني", community: "المجتمع", submit: "إرسال", login: "تسجيل الدخول",
    savedMemes: "الميمات المحفوظة", logout: "تسجيل الخروج", greeting: "مرحبًا بعودتك", accountMenu: "حسابي",
    random: "عرض ميم عشوائي", findingMeme: "جارٍ البحث عن ميم", language: "اللغة", languageMenu: "اختر اللغة",
    footerNav: "معلومات الموقع", about: "عن MemeCatch", privacy: "الخصوصية", terms: "الشروط",
    rankings: "التصنيفات", news: "أخبار الميمات حسب الجيل", donate: "ادعمنا",
    legalSummary: "التشغيل وحقوق النشر", support: "مركز المساعدة", mainNav: "التنقل الرئيسي",
  },
  ru: {
    home: "Главная MemeCatch", search: "Поиск мемов", searchPlaceholder: "Поиск мемов",
    explore: "Обзор", timeline: "Хронология", community: "Сообщество", submit: "Отправить", login: "Войти",
    savedMemes: "Сохранённые мемы", logout: "Выйти", greeting: "С возвращением", accountMenu: "Мой аккаунт",
    random: "Случайный мем", findingMeme: "Ищем мем", language: "Язык", languageMenu: "Выбрать язык",
    footerNav: "О сайте", about: "О MemeCatch", privacy: "Конфиденциальность", terms: "Условия",
    rankings: "Рейтинги", news: "Мем-новости по поколениям", donate: "Поддержать",
    legalSummary: "Управление и авторские права", support: "Центр поддержки", mainNav: "Основная навигация",
  },
  es: {
    home: "Inicio de MemeCatch", search: "Buscar memes", searchPlaceholder: "Buscar memes",
    explore: "Explorar", timeline: "Cronología", community: "Comunidad", submit: "Enviar", login: "Iniciar sesión",
    savedMemes: "Memes guardados", logout: "Cerrar sesión", greeting: "Bienvenido de nuevo", accountMenu: "Mi cuenta",
    random: "Ver un meme al azar", findingMeme: "Buscando un meme", language: "Idioma", languageMenu: "Elegir idioma",
    footerNav: "Información del sitio", about: "Acerca de MemeCatch", privacy: "Privacidad", terms: "Términos",
    rankings: "Clasificaciones", news: "Noticias de memes por edad", donate: "Apóyanos",
    legalSummary: "Operación y derechos de autor", support: "Centro de ayuda", mainNav: "Navegación principal",
  },
  de: {
    home: "MemeCatch Startseite", search: "Memes suchen", searchPlaceholder: "Memes suchen",
    explore: "Entdecken", timeline: "Zeitleiste", community: "Community", submit: "Einreichen", login: "Anmelden",
    savedMemes: "Gespeicherte Memes", logout: "Abmelden", greeting: "Willkommen zurück", accountMenu: "Mein Konto",
    random: "Zufälliges Meme anzeigen", findingMeme: "Meme wird gesucht", language: "Sprache", languageMenu: "Sprache wählen",
    footerNav: "Seiteninfo", about: "Über MemeCatch", privacy: "Datenschutz", terms: "Nutzungsbedingungen",
    rankings: "Rankings", news: "Meme-News nach Generation", donate: "Unterstützen",
    legalSummary: "Betrieb & Urheberrecht", support: "Hilfecenter", mainNav: "Hauptnavigation",
  },
  fr: {
    home: "Accueil MemeCatch", search: "Rechercher des mèmes", searchPlaceholder: "Rechercher des mèmes",
    explore: "Explorer", timeline: "Chronologie", community: "Communauté", submit: "Proposer", login: "Connexion",
    savedMemes: "Mèmes enregistrés", logout: "Déconnexion", greeting: "Bon retour", accountMenu: "Mon compte",
    random: "Voir un mème au hasard", findingMeme: "Recherche d'un mème", language: "Langue", languageMenu: "Choisir la langue",
    footerNav: "Infos du site", about: "À propos de MemeCatch", privacy: "Confidentialité", terms: "Conditions",
    rankings: "Classements", news: "Actus mèmes par génération", donate: "Nous soutenir",
    legalSummary: "Gestion et droits d'auteur", support: "Centre d'aide", mainNav: "Navigation principale",
  },
  it: {
    home: "Home di MemeCatch", search: "Cerca meme", searchPlaceholder: "Cerca meme",
    explore: "Esplora", timeline: "Cronologia", community: "Community", submit: "Invia", login: "Accedi",
    savedMemes: "Meme salvati", logout: "Esci", greeting: "Bentornato", accountMenu: "Il mio account",
    random: "Mostra un meme casuale", findingMeme: "Cerco un meme", language: "Lingua", languageMenu: "Scegli la lingua",
    footerNav: "Info sito", about: "Informazioni su MemeCatch", privacy: "Privacy", terms: "Termini",
    rankings: "Classifiche", news: "News sui meme per età", donate: "Sostienici",
    legalSummary: "Gestione e copyright", support: "Centro assistenza", mainNav: "Navigazione principale",
  },
  pt: {
    home: "Início do MemeCatch", search: "Buscar memes", searchPlaceholder: "Buscar memes",
    explore: "Explorar", timeline: "Linha do tempo", community: "Comunidade", submit: "Enviar", login: "Entrar",
    savedMemes: "Memes salvos", logout: "Sair", greeting: "Bem-vindo de volta", accountMenu: "Minha conta",
    random: "Ver um meme aleatório", findingMeme: "Procurando um meme", language: "Idioma", languageMenu: "Escolher idioma",
    footerNav: "Informações do site", about: "Sobre o MemeCatch", privacy: "Privacidade", terms: "Termos",
    rankings: "Rankings", news: "Notícias de memes por geração", donate: "Apoie-nos",
    legalSummary: "Operação e direitos autorais", support: "Central de ajuda", mainNav: "Navegação principal",
  },
  tr: {
    home: "MemeCatch ana sayfa", search: "Meme ara", searchPlaceholder: "Meme ara",
    explore: "Keşfet", timeline: "Zaman çizelgesi", community: "Topluluk", submit: "Gönder", login: "Giriş yap",
    savedMemes: "Kaydedilen memler", logout: "Çıkış yap", greeting: "Tekrar hoş geldin", accountMenu: "Hesabım",
    random: "Rastgele meme göster", findingMeme: "Meme aranıyor", language: "Dil", languageMenu: "Dil seç",
    footerNav: "Site bilgisi", about: "MemeCatch hakkında", privacy: "Gizlilik", terms: "Koşullar",
    rankings: "Sıralamalar", news: "Kuşağa göre meme haberleri", donate: "Bize destek ol",
    legalSummary: "İşletme ve telif hakkı", support: "Yardım merkezi", mainNav: "Ana gezinme",
  },
  ms: {
    home: "Laman utama MemeCatch", search: "Cari meme", searchPlaceholder: "Cari meme",
    explore: "Teroka", timeline: "Garis masa", community: "Komuniti", submit: "Hantar", login: "Log masuk",
    savedMemes: "Meme disimpan", logout: "Log keluar", greeting: "Selamat kembali", accountMenu: "Akaun saya",
    random: "Lihat meme rawak", findingMeme: "Mencari meme", language: "Bahasa", languageMenu: "Pilih bahasa",
    footerNav: "Maklumat laman", about: "Tentang MemeCatch", privacy: "Privasi", terms: "Terma",
    rankings: "Kedudukan", news: "Berita meme ikut generasi", donate: "Sokong kami",
    legalSummary: "Operasi & hak cipta", support: "Pusat bantuan", mainNav: "Navigasi utama",
  },
  hi: {
    home: "MemeCatch होम", search: "मीम खोजें", searchPlaceholder: "मीम खोजें",
    explore: "एक्सप्लोर", timeline: "टाइमलाइन", community: "कम्युनिटी", submit: "सबमिट करें", login: "लॉग इन",
    savedMemes: "सहेजे गए मीम", logout: "लॉग आउट", greeting: "वापसी पर स्वागत है", accountMenu: "मेरा खाता",
    random: "कोई भी मीम देखें", findingMeme: "मीम खोजा जा रहा है", language: "भाषा", languageMenu: "भाषा चुनें",
    footerNav: "साइट जानकारी", about: "MemeCatch के बारे में", privacy: "गोपनीयता", terms: "नियम",
    rankings: "रैंकिंग", news: "पीढ़ी के अनुसार मीम समाचार", donate: "हमें सपोर्ट करें",
    legalSummary: "संचालन और कॉपीराइट", support: "सहायता केंद्र", mainNav: "मुख्य नेविगेशन",
  },
};

const MESSAGES: Record<Locale, Messages> = (() => {
  const result = { ...CORE_MESSAGES } as unknown as Record<Locale, Messages>;
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === "ko" || locale === "en" || locale === "ja" || locale === "zh") continue;
    const fallback = locale === "zh-tw" ? CORE_MESSAGES.zh : CORE_MESSAGES.en;
    result[locale] = { ...fallback, ...EXTRA_MESSAGES[locale] };
  }
  return result;
})();

export function getMessages(locale: Locale): Messages { return MESSAGES[locale]; }
