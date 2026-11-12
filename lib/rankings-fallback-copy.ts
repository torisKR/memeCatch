import { getMessages, type Locale } from "@/lib/i18n";
import { isSeoContentLocale, localizedStaticPath } from "@/lib/i18n-routing";

export type RankingsFallbackCopy = {
  title: string;
  guidance: string;
  explore: string;
};

/**
 * Guidance and the explore button. The title is the same label as the nav,
 * so a locale never falls through to Korean.
 */
const FALLBACK_COPY = {
  ko: {
    guidance: "순위를 잠시 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
    explore: "밈 사전 보기",
  },
  en: {
    guidance: "Rankings could not be loaded just now. Please check again in a moment.",
    explore: "Browse the meme dictionary",
  },
  ja: {
    guidance: "ランキングを今は読み込めませんでした。しばらくしてからもう一度ご確認ください。",
    explore: "ミーム辞典を見る",
  },
  zh: {
    guidance: "暂时无法加载排行榜。请稍后再查看。",
    explore: "查看迷因词典",
  },
  "zh-tw": {
    guidance: "暫時無法載入排行榜。請稍後再查看。",
    explore: "查看迷因詞典",
  },
  th: {
    guidance: "โหลดอันดับไม่สำเร็จในตอนนี้ โปรดตรวจสอบอีกครั้งในอีกสักครู่",
    explore: "ดูพจนานุกรมมีม",
  },
  vi: {
    guidance: "Hiện chưa tải được bảng xếp hạng. Vui lòng kiểm tra lại sau giây lát.",
    explore: "Xem từ điển meme",
  },
  mn: {
    guidance: "Чансааг одоогоор ачаалж чадсангүй. Түр хүлээгээд дахин шалгана уу.",
    explore: "Мемийн толь үзэх",
  },
  id: {
    guidance: "Peringkat belum bisa dimuat saat ini. Silakan periksa lagi sebentar lagi.",
    explore: "Lihat kamus meme",
  },
  ar: {
    guidance: "تعذر تحميل التصنيفات الآن. يُرجى المحاولة مرة أخرى بعد قليل.",
    explore: "تصفح قاموس الميمات",
  },
  ru: {
    guidance: "Сейчас не удалось загрузить рейтинги. Проверьте ещё раз чуть позже.",
    explore: "Открыть словарь мемов",
  },
  es: {
    guidance: "No se pudieron cargar las clasificaciones en este momento. Vuelve a intentarlo dentro de un momento.",
    explore: "Ver el diccionario de memes",
  },
  de: {
    guidance: "Die Rankings konnten gerade nicht geladen werden. Bitte schau gleich noch einmal vorbei.",
    explore: "Meme-Wörterbuch ansehen",
  },
  fr: {
    guidance: "Le classement n'a pas pu être chargé pour le moment. Réessayez dans un instant.",
    explore: "Voir le dictionnaire de mèmes",
  },
  it: {
    guidance: "Non è stato possibile caricare le classifiche. Ricontrolla tra poco.",
    explore: "Vedi il dizionario dei meme",
  },
  pt: {
    guidance: "Não foi possível carregar os rankings agora. Confira de novo daqui a pouco.",
    explore: "Ver o dicionário de memes",
  },
  tr: {
    guidance: "Sıralamalar şu anda yüklenemedi. Biraz sonra yeniden kontrol edin.",
    explore: "Meme sözlüğüne bak",
  },
  ms: {
    guidance: "Kedudukan tidak dapat dimuatkan buat masa ini. Sila semak semula sebentar lagi.",
    explore: "Lihat kamus meme",
  },
  hi: {
    guidance: "रैंकिंग अभी लोड नहीं हो सकी. कृपया थोड़ी देर बाद फिर देखें.",
    explore: "मीम शब्दकोश देखें",
  },
} as const satisfies Record<Locale, { guidance: string; explore: string }>;

export function rankingsFallbackCopy(locale: Locale): RankingsFallbackCopy {
  const copy = FALLBACK_COPY[locale];
  return {
    title: getMessages(locale).rankings,
    guidance: copy.guidance,
    explore: copy.explore,
  };
}

/**
 * Explore target for the fallback button. SEO prefixes keep their explore
 * route. Arabic has no `/ar/explore` page (`dynamicParams` is false), so the
 * button uses the Korean dictionary at `/explore`.
 */
export function rankingsExploreHref(locale: Locale): string {
  if (locale === "ko" || locale === "ar") return "/explore";
  if (isSeoContentLocale(locale)) return localizedStaticPath("/explore", locale);
  return `/${locale}/explore`;
}
