//! `GET /{locale}/llms.txt` and `GET /{locale}/llms-full.txt`:
//! `app/[locale]/llms.txt/route.ts` and `app/[locale]/llms-full.txt/route.ts`,
//! for the four locales of `SEO_CONTENT_LOCALES`, rendered on every request.
//! Only the four real paths are registered (`routes/public.rs`); any other
//! prefix is a 404.

use axum::extract::State;
use axum::response::Response;

use super::js;
use super::labels::{self, CONTACT_EMAIL};
use super::llms::text_response;
use super::localized::{self, LocalizedMeme};
use crate::AppState;

const INDEX_LIMIT: usize = 15;
const FULL_LIMIT: usize = 400;

/// `COPY[locale]` of the index route.
struct IndexCopy {
    summary: &'static str,
    editorial: &'static str,
    entry_points: &'static str,
    home: &'static str,
    full: &'static str,
    korean_site: &'static str,
    featured: &'static str,
    empty: &'static str,
    citation: &'static str,
    citation_rules: [&'static str; 3],
    contact: &'static str,
}

/// `COPY[locale]` of the full route.
struct FullCopy {
    intro: &'static str,
    policy: &'static str,
    original: &'static str,
    summary: &'static str,
    description: &'static str,
    origin: &'static str,
    usage: &'static str,
    caution: &'static str,
    sources: &'static str,
    updated: &'static str,
    attribution: &'static str,
    no_value: &'static str,
    contact: &'static str,
    canonical_index: &'static str,
    entries: &'static str,
}

/// A locale with translated content.
pub struct Locale {
    /// The path segment and the `meme_translations.locale` value.
    pub code: &'static str,
    /// `SEO_LOCALE_CONFIG[locale].bcp47`, sent as `Content-Language`.
    bcp47: &'static str,
    index: IndexCopy,
    full: FullCopy,
}

/// `getSeoCopy(locale).siteName`: the same for the four locales.
const SITE_NAME: &str = "MemeCatch";

pub static LOCALES: [Locale; 4] = [
    Locale {
        code: "en",
        bcp47: "en-US",
        index: IndexCopy {
            summary: "A multilingual guide to Korean meme terms, challenge dances, songs, drama scenes, and meme videos, explaining meaning, origin, usage, and cultural risk.",
            editorial: "Indexable translations are human-reviewed, current with the Korean source, and backed by substantial source material. Machine and outdated drafts remain private to the operator workflow and are excluded from public pages, search, and AI discovery feeds.",
            entry_points: "Key entry points",
            home: "Korean meme dictionary",
            full: "Full translated corpus for AI systems",
            korean_site: "Korean source site",
            featured: "Featured reviewed translations",
            empty: "No reviewed translations are available yet.",
            citation: "Citation and attribution",
            citation_rules: [
                "Cite the localized meme page URL, not this index.",
                "Keep the original Korean title when identifying a meme.",
                "Follow the source links on each entry for primary or contextual evidence.",
            ],
            contact: "Corrections and removal requests",
        },
        full: FullCopy {
            intro: "Full human-reviewed, current translation corpus for Korean meme retrieval and citation.",
            policy: "Machine translations, stale translations, incomplete Korean entries, and thin source records are excluded.",
            original: "Original Korean title",
            summary: "Summary",
            description: "Meaning",
            origin: "Origin",
            usage: "Usage",
            caution: "Caution",
            sources: "Sources",
            updated: "Translation updated",
            attribution: "For attribution, cite the localized entry URL and retain its Korean title. Use the listed source URLs to distinguish primary material from contextual references.",
            no_value: "Not specified",
            contact: "Contact",
            canonical_index: "Canonical index",
            entries: "Entries",
        },
    },
    Locale {
        code: "ja",
        bcp47: "ja-JP",
        index: IndexCopy {
            summary: "韓国のミーム用語、チャレンジダンス、楽曲、ドラマシーン、ミーム動画の意味・由来・使い方・文化的な注意点を多言語で解説する辞典です。",
            editorial: "検索登録される翻訳は、人が確認し、韓国語の原文と同期し、十分な出典を持つものに限ります。機械翻訳や古い下書きは編集者向けの非公開ワークフローにとどまり、公開ページ・検索・AI向けフィードから除外します。",
            entry_points: "主な入口",
            home: "韓国ミーム辞典",
            full: "AI向け翻訳全文コーパス",
            korean_site: "韓国語の原文サイト",
            featured: "注目の確認済み翻訳",
            empty: "確認済みの翻訳はまだありません。",
            citation: "引用と出典表記",
            citation_rules: [
                "この索引ではなく、各言語のミーム記事URLを引用してください。",
                "ミームを特定するときは韓国語の原題も残してください。",
                "一次情報・文脈資料は各記事の出典リンクで確認してください。",
            ],
            contact: "訂正・削除依頼",
        },
        full: FullCopy {
            intro: "韓国ミームの検索・引用向けに、人が確認し、原文と同期した翻訳全文を収録しています。",
            policy: "機械翻訳、古い翻訳、不完全な韓国語記事、出典の薄い記事は除外しています。",
            original: "韓国語の原題",
            summary: "要約",
            description: "意味",
            origin: "由来",
            usage: "使い方",
            caution: "注意点",
            sources: "出典",
            updated: "翻訳更新日",
            attribution: "引用時は各言語の記事URLを示し、韓国語の原題も残してください。掲載した出典URLで一次資料と文脈資料を区別してください。",
            no_value: "記載なし",
            contact: "問い合わせ",
            canonical_index: "正規索引",
            entries: "収録件数",
        },
    },
    Locale {
        code: "zh",
        bcp47: "zh-CN",
        index: IndexCopy {
            summary: "以多语言解释韩国梗语、舞蹈挑战、歌曲、电视剧场景和梗视频的含义、起源、用法与文化风险。",
            editorial: "只有经过人工审核、与韩文原文同步且来源资料充足的翻译才会被收录。机器翻译和过期草稿仅保留在编辑者的私有工作流中，不会出现在公开页面、搜索或 AI 发现源中。",
            entry_points: "主要入口",
            home: "韩国迷因词典",
            full: "面向 AI 系统的完整翻译语料",
            korean_site: "韩文原文网站",
            featured: "精选审核翻译",
            empty: "目前还没有审核过的翻译。",
            citation: "引用与署名",
            citation_rules: [
                "请引用对应语言的迷因详情页，而不是本索引。",
                "识别迷因时请保留韩文原名。",
                "请通过每篇词条的来源链接核对一手资料或背景依据。",
            ],
            contact: "更正与删除请求",
        },
        full: FullCopy {
            intro: "面向韩国迷因检索与引用的完整语料，仅收录人工审核且与原文同步的翻译。",
            policy: "机器翻译、过期翻译、内容不完整的韩文词条和来源薄弱的记录均不收录。",
            original: "韩文原名",
            summary: "摘要",
            description: "含义",
            origin: "起源",
            usage: "用法",
            caution: "注意事项",
            sources: "来源",
            updated: "翻译更新时间",
            attribution: "引用时请使用对应语言的词条 URL，并保留韩文原名。请通过列出的来源 URL 区分一手资料与背景参考。",
            no_value: "未注明",
            contact: "联系",
            canonical_index: "规范索引",
            entries: "词条数",
        },
    },
    Locale {
        code: "zh-tw",
        bcp47: "zh-TW",
        index: IndexCopy {
            summary: "以多語言解釋韓國梗語、舞蹈挑戰、歌曲、電視劇場景和梗影片的含義、起源、用法與文化風險。",
            editorial: "只有經過人工審核、與韓文原文同步且來源資料充足的翻譯才會被收錄。機器翻譯和過期草稿僅保留在編輯者的私有工作流中，不會出現在公開頁面、搜尋或 AI 探索來源中。",
            entry_points: "主要入口",
            home: "韓國迷因辭典",
            full: "供 AI 系統使用的完整翻譯語料",
            korean_site: "韓文原文網站",
            featured: "精選審核翻譯",
            empty: "目前還沒有審核過的翻譯。",
            citation: "引用與署名",
            citation_rules: [
                "請引用對應語言的迷因詳細頁，而不是本索引。",
                "辨識迷因時請保留韓文原名。",
                "請透過每篇詞條的來源連結核對第一手資料或背景依據。",
            ],
            contact: "更正與移除請求",
        },
        full: FullCopy {
            intro: "供韓國迷因檢索與引用使用的完整語料，只收錄人工審核且與原文同步的翻譯。",
            policy: "機器翻譯、過期翻譯、內容不完整的韓文詞條和來源薄弱的紀錄均不收錄。",
            original: "韓文原名",
            summary: "摘要",
            description: "含義",
            origin: "起源",
            usage: "用法",
            caution: "注意事項",
            sources: "來源",
            updated: "翻譯更新時間",
            attribution: "引用時請使用對應語言的詞條 URL，並保留韓文原名。請透過列出的來源 URL 區分第一手資料與背景參考。",
            no_value: "未註明",
            contact: "聯絡",
            canonical_index: "標準索引",
            entries: "詞條數",
        },
    },
];

pub async fn index(State(state): State<AppState>, locale: &'static Locale) -> Response {
    let featured = localized::featured_memes(&state.db, locale.code, INDEX_LIMIT).await;
    text_response(
        locale.bcp47,
        render_index(labels::site_url(&state.config.site_url), locale, &featured),
    )
}

pub async fn full(State(state): State<AppState>, locale: &'static Locale) -> Response {
    let memes = localized::featured_memes(&state.db, locale.code, FULL_LIMIT).await;
    text_response(
        locale.bcp47,
        render_full(labels::site_url(&state.config.site_url), locale, &memes),
    )
}

/// `localizedMemePath(locale, shortId, slug)` for a translated locale: the
/// Korean path behind the locale segment.
fn localized_meme_path(locale: &str, meme: &LocalizedMeme) -> String {
    format!("/{locale}{}", labels::meme_path(&meme.short_id, &meme.slug))
}

/// `singleLine`.
fn single_line(value: &str) -> String {
    js::trim(&js::collapse_spaces(value)).to_owned()
}

/// The body of `/{locale}/llms.txt`.
fn render_index(site: &str, locale: &Locale, featured: &[LocalizedMeme]) -> String {
    let (code, copy) = (locale.code, &locale.index);
    let featured_block = if featured.is_empty() {
        format!("- ({})", copy.empty)
    } else {
        featured
            .iter()
            .map(|meme| {
                format!(
                    "- [{}]({site}{}): {}",
                    single_line(&meme.title),
                    localized_meme_path(code, meme),
                    single_line(&meme.summary)
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    let rules = copy
        .citation_rules
        .map(|rule| format!("- {rule}"))
        .join("\n");
    format!(
        "# {SITE_NAME}\n\n> {}\n>\n> {}\n\n## {}\n- [{}]({site}/{code})\n- [{}]({site}/{code}/llms-full.txt)\n- [{}]({site})\n\n## {}\n{featured_block}\n\n## {}\n{rules}\n- {}: {CONTACT_EMAIL}\n",
        copy.summary,
        copy.editorial,
        copy.entry_points,
        copy.home,
        copy.full,
        copy.korean_site,
        copy.featured,
        copy.citation,
        copy.contact,
    )
}

/// `prose`: the trimmed text, or `fallback` when there is none.
fn prose<'a>(value: Option<&'a str>, fallback: &'a str) -> &'a str {
    match value.map(js::trim) {
        Some(text) if !text.is_empty() => text,
        _ => fallback,
    }
}

/// One entry of `/{locale}/llms-full.txt`.
fn render_entry(site: &str, locale: &Locale, meme: &LocalizedMeme) -> String {
    let copy = &locale.full;
    let sources: Vec<String> = meme
        .sources
        .iter()
        .filter_map(|source| {
            let url = source.source_url.as_deref().filter(|url| !url.is_empty())?;
            // `source.title || source.platform`.
            let name = source
                .title
                .as_deref()
                .filter(|title| !title.is_empty())
                .or(source.platform.as_deref());
            source
                .is_public()
                .then(|| format!("- [{}]({url})", prose(name, copy.sources)))
        })
        .collect();
    let sources = if sources.is_empty() {
        format!("- {}", copy.no_value)
    } else {
        sources.join("\n")
    };
    format!(
        "## {}\nURL: {site}{}\n{}: {}\n{}: {}\n\n### {}\n{}\n\n### {}\n{}\n\n### {}\n{}\n\n### {}\n{}\n\n### {}\n{sources}\n\n{}: {}",
        meme.title,
        localized_meme_path(locale.code, meme),
        copy.original,
        meme.original_title,
        copy.summary,
        prose(Some(&meme.summary), copy.no_value),
        copy.description,
        prose(Some(&meme.description), copy.no_value),
        copy.origin,
        prose(Some(&meme.origin), copy.no_value),
        copy.usage,
        prose(meme.usage_note.as_deref(), copy.no_value),
        copy.caution,
        prose(meme.caution.as_deref(), copy.no_value),
        copy.sources,
        copy.updated,
        meme.translation_updated_at,
    )
}

/// The body of `/{locale}/llms-full.txt`.
fn render_full(site: &str, locale: &Locale, memes: &[LocalizedMeme]) -> String {
    let (code, copy) = (locale.code, &locale.full);
    let entries: Vec<String> = memes
        .iter()
        .map(|meme| render_entry(site, locale, meme))
        .collect();
    format!(
        "# MemeCatch — llms-full ({code})\n\n> {}\n>\n> {}\n\n{}\n{}: {CONTACT_EMAIL}\n{}: {site}/{code}/llms.txt\n{}: {}\n\n{}\n",
        copy.intro,
        copy.policy,
        copy.attribution,
        copy.contact,
        copy.canonical_index,
        copy.entries,
        memes.len(),
        entries.join("\n\n---\n\n"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routes::public::content_depth::SourceRef;

    fn meme() -> LocalizedMeme {
        LocalizedMeme {
            short_id: "r1aaaa01".to_owned(),
            slug: "en slug?".to_owned(),
            title: "  Unbreakable   spirit\n(중꺾마) [x] ".to_owned(),
            summary: "What   matters\tis heart.  ".to_owned(),
            description: "  Meaning\nline two  ".to_owned(),
            origin: "Origin".to_owned(),
            usage_note: None,
            caution: Some("   ".to_owned()),
            original_title: "중꺾마".to_owned(),
            sources: Vec::new(),
            translation_updated_at: "2026-05-03T04:05:06.789012+00:00".to_owned(),
            card: crate::pages::meme_card::CardMeme {
                id: "m1".to_owned(),
                category: "phrase".to_owned(),
                short_id: "r1aaaa01".to_owned(),
                slug: "en slug?".to_owned(),
                title: String::new(),
                summary: String::new(),
                safety_level: None,
                origin_year: None,
                trend_score: None,
                contents: Vec::new(),
            },
        }
    }

    fn source(
        url: Option<&str>,
        title: Option<&str>,
        platform: &str,
        hidden: Option<bool>,
    ) -> SourceRef {
        SourceRef {
            source_url: url.map(str::to_owned),
            hidden_from_public: hidden,
            title: title.map(str::to_owned),
            platform: Some(platform.to_owned()),
        }
    }

    #[test]
    fn the_index_line_is_one_line_and_escapes_nothing() {
        let body = render_index("https://memes.example", &LOCALES[0], &[meme()]);

        assert!(body.contains(
            "\n## Featured reviewed translations\n- [Unbreakable spirit (중꺾마) [x]](https://memes.example/en/memes/r1aaaa01-en%20slug%3F): What matters is heart.\n\n## Citation and attribution\n"
        ));
    }

    #[test]
    fn an_index_without_translations_says_so_in_the_locale() {
        let body = render_index("https://memes.example", &LOCALES[1], &[]);

        assert!(body.contains("\n## 注目の確認済み翻訳\n- (確認済みの翻訳はまだありません。)\n\n"));
        assert!(body.ends_with("- 訂正・削除依頼: toris@toris.kr\n"));
    }

    #[test]
    fn an_entry_keeps_the_text_as_stored_and_fills_the_gaps() {
        let entry = render_entry("https://memes.example", &LOCALES[0], &meme());

        assert_eq!(
            entry,
            "##   Unbreakable   spirit\n(중꺾마) [x] \nURL: https://memes.example/en/memes/r1aaaa01-en%20slug%3F\nOriginal Korean title: 중꺾마\nSummary: What   matters\tis heart.\n\n### Meaning\nMeaning\nline two\n\n### Origin\nOrigin\n\n### Usage\nNot specified\n\n### Caution\nNot specified\n\n### Sources\n- Not specified\n\nTranslation updated: 2026-05-03T04:05:06.789012+00:00"
        );
    }

    #[test]
    fn sources_need_a_url_and_must_not_be_hidden() {
        let mut meme = meme();
        meme.sources = vec![
            source(Some("https://a.example/1"), Some("  Titled  "), "web", None),
            source(Some("https://a.example/2"), None, "youtube", Some(false)),
            source(
                Some("https://a.example/3"),
                Some("Hidden"),
                "web",
                Some(true),
            ),
            source(None, Some("No URL"), "web", None),
            source(Some(""), Some("Empty URL"), "web", None),
            source(Some("https://a.example/4"), Some(""), "   ", None),
        ];

        let entry = render_entry("", &LOCALES[0], &meme);

        assert!(entry.contains(
            "\n### Sources\n- [Titled](https://a.example/1)\n- [youtube](https://a.example/2)\n- [Sources](https://a.example/4)\n\nTranslation updated"
        ));
    }

    #[test]
    fn the_full_export_counts_its_entries_and_separates_them() {
        let empty = render_full("https://memes.example", &LOCALES[2], &[]);
        let two = render_full("https://memes.example", &LOCALES[0], &[meme(), meme()]);

        assert!(empty.starts_with("# MemeCatch — llms-full (zh)\n\n> "));
        assert!(empty.ends_with("规范索引: https://memes.example/zh/llms.txt\n词条数: 0\n\n\n"));
        assert!(two.contains("\nEntries: 2\n\n##   Unbreakable"));
        assert_eq!(two.matches("\n\n---\n\n").count(), 1);
    }
}
