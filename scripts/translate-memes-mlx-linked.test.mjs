import { strict as assert } from "node:assert";
import {
  assertSourceFidelity,
  assertTargetLanguage,
  buildAtomicInsertSql,
  buildCandidateSql,
  decodeJsonBase64,
  encodeJsonBase64,
  extractKoreanMemeShortIds,
  parseArgs,
  parseStrictTranslation,
  parseSupabaseCliJson,
  requestMlxTranslation,
  run,
  sourceSnapshot,
  sourceSnapshotHash,
} from "./translate-memes-mlx-linked.mjs";

const defaults = parseArgs(["--locale=en"]);
assert.equal(defaults.apply, false, "dry-run must be the default");
assert.equal(defaults.locale, "en");
assert.equal(parseArgs(["--locale=zh-tw", "--apply", "--limit=3"]).apply, true);
assert.throws(() => parseArgs(["--locale=ko"]), /--locale/);
assert.throws(() => parseArgs(["--locale=en", "--limit=0"]), /--limit/);
assert.throws(() => parseArgs(["--locale=en", "--unknown=x"]), /unknown option/);

assert.deepEqual(
  extractKoreanMemeShortIds(`
    <urlset>
      <url><loc>https://catchmeme.com/memes/abc123-%ED%82%B9%EB%B0%9B%EB%84%A4</loc></url>
      <url><loc>https://catchmeme.com/en/memes/abc123-king-bat-ne</loc></url>
      <url><loc>https://catchmeme.com/memes/def456-second</loc></url>
      <url><loc>https://catchmeme.com/memes/abc123-duplicate</loc></url>
    </urlset>
  `),
  ["abc123", "def456"],
);

const validTranslation = {
  title: "King-bat-ne (킹받네)",
  summary: "A playful way to say something is infuriating.",
  description: "A sufficiently complete localized explanation.",
  origin: "The origin remains uncertain in the Korean source.",
  usage_note: "Use it casually among friends.",
  caution: "Avoid it in formal settings.",
  aliases: ["king-bat-ne"],
  usage_examples: [{ situation: "Chat", text: "That is so king-bat-ne." }],
};
assert.deepEqual(parseStrictTranslation(JSON.stringify(validTranslation)), validTranslation);
assert.equal(assertTargetLanguage(validTranslation, "en"), validTranslation);
assert.throws(
  () => parseStrictTranslation(`\`\`\`json\n${JSON.stringify(validTranslation)}\n\`\`\``),
  /fences/,
);
assert.throws(
  () => parseStrictTranslation(JSON.stringify({ ...validTranslation, extra: "no" })),
  /exact schema/,
);

const allKoreanTranslation = {
  title: "킹받네",
  summary: "장난스럽게 화가 난다는 뜻이에요.",
  description: "짜증이 나거나 약이 오를 때 쓰는 한국어 유행어예요.",
  origin: "정확한 시작점은 확인되지 않았어요.",
  usage_note: "친구끼리 가볍게 사용해요.",
  caution: "공식적인 자리에서는 피하는 편이 좋아요.",
  aliases: ["킹받네"],
  usage_examples: [{ situation: "친구와 대화", text: "그거 정말 킹받네." }],
};
assert.throws(
  () => assertTargetLanguage(allKoreanTranslation, "en"),
  /title is not valid en text/,
  "exact JSON containing Korean prose must not pass English validation",
);

const localeFixtures = {
  ja: {
    good: {
      title: "キングバンネ（킹받네）",
      summary: "腹が立つ気持ちを、冗談っぽく表す言葉です。",
      description: "いら立った場面を軽く笑いに変えるために使われる韓国の流行語です。",
      origin: "正確な始まりについては、韓国語の原文でも断定されていません。",
      usage_note: "親しい友達との会話で使います。",
      caution: "改まった場面では避けたほうが安全です。",
      aliases: ["킹받네"],
      usage_examples: [{ situation: "友達との会話", text: "それは本当に腹が立つね。" }],
    },
    badField: "summary",
  },
  zh: {
    good: {
      title: "让人恼火（킹받네）",
      summary: "用开玩笑的语气表达恼火的韩国流行语。",
      description: "遇到让人烦躁的事情时，用轻松幽默的方式表达情绪。",
      origin: "韩文原文并未确定这个说法的准确起点。",
      usage_note: "适合在熟悉的朋友之间使用。",
      caution: "正式场合最好避免使用。",
      aliases: ["킹받네"],
      usage_examples: [{ situation: "朋友聊天", text: "这件事真的让人恼火。" }],
    },
    badField: "description",
  },
  "zh-tw": {
    good: {
      title: "讓人惱火（킹받네）",
      summary: "用開玩笑的語氣表達惱火的韓國流行語。",
      description: "遇到令人煩躁的事情時，用輕鬆幽默的方式表達情緒。",
      origin: "韓文原文並未確定這個說法的準確起點。",
      usage_note: "適合在熟悉的朋友之間使用。",
      caution: "正式場合最好避免使用。",
      aliases: ["킹받네"],
      usage_examples: [{ situation: "朋友聊天", text: "這件事真的讓人惱火。" }],
    },
    badField: "origin",
  },
};

for (const [locale, fixture] of Object.entries(localeFixtures)) {
  assert.equal(assertTargetLanguage(fixture.good, locale), fixture.good);
  assert.throws(
    () => assertTargetLanguage({ ...fixture.good, [fixture.badField]: "번역되지 않은 한국어 문장입니다." }, locale),
    new RegExp(`${fixture.badField} is not valid ${locale} text`),
  );
}

const japaneseProse = {
  ...localeFixtures.zh.good,
  title: "韓国のミームです",
  summary: "これは韓国のミームです",
  description: "韓国で使われる表現について説明しています",
  origin: "正確な起源は確認されていません",
  usage_note: "友達との会話で使います",
  caution: "正式な場では避けます",
  usage_examples: [{ situation: "友達との会話", text: "これは面白いミームです" }],
};
for (const locale of ["zh", "zh-tw"]) {
  assert.throws(
    () => assertTargetLanguage(japaneseProse, locale),
    new RegExp(`title is not valid ${locale} text.*zero kana`),
    `Japanese prose must be rejected for ${locale}`,
  );
}

const mostlyEnglishJapanese = {
  title: "This is English prose です",
  summary: "This is English prose です",
  description: "This is English prose です",
  origin: "This is English prose です",
  usage_note: null,
  caution: null,
  aliases: [],
  usage_examples: [],
};
assert.throws(
  () => assertTargetLanguage(mostlyEnglishJapanese, "ja"),
  /title is not valid ja text.*substantial kana/,
);
const chineseWithJapaneseEnding = {
  ...mostlyEnglishJapanese,
  title: "这是中文标题です",
  summary: "这是中文翻译的内容です",
  description: "这是中文翻译的详细说明です",
  origin: "这是中文起源说明です",
};
assert.throws(
  () => assertTargetLanguage(chineseWithJapaneseEnding, "ja"),
  /title is not valid ja text.*rejects Chinese prose signals/,
);
assert.throws(
  () => assertTargetLanguage({
    ...chineseWithJapaneseEnding,
    title: "這是中文標題です",
    summary: "這是中文翻譯的內容です",
    description: "這是中文翻譯的詳細說明です",
    origin: "這是中文起源說明です",
  }, "ja"),
  /title is not valid ja text.*rejects Chinese prose signals/,
);
assert.doesNotThrow(() => assertTargetLanguage({
  ...localeFixtures.ja.good,
  title: "韓国発の流行語",
}, "ja"));
for (const locale of ["zh", "zh-tw"]) {
  const mostlyEnglishChinese = {
    ...mostlyEnglishJapanese,
    title: "This is English prose 中",
    summary: "This is English prose 中",
    description: "This is English prose 中",
    origin: "This is English prose 中",
  };
  assert.throws(
    () => assertTargetLanguage(mostlyEnglishChinese, locale),
    new RegExp(`title is not valid ${locale} text.*substantial Han characters`),
  );
}
for (const locale of ["ja", "zh", "zh-tw"]) {
  const alignedProperNameSource = {
    origin: "Boys Club",
  };
  const translation = {
    ...localeFixtures[locale].good,
    origin: "《Boys Club》",
  };
  assert.doesNotThrow(
    () => assertTargetLanguage(translation, locale, alignedProperNameSource),
    `a Latin-only proper-name origin must remain valid for ${locale}`,
  );
  assert.throws(
    () => assertTargetLanguage(
      translation,
      locale,
      { origin: "Boys Club 2005" },
    ),
    new RegExp(`origin is not valid ${locale} text`),
    `proper-name alignment must not drop source identity tokens for ${locale}`,
  );
  for (const invalidOrigin of [
    "this is ordinary prose",
    "This Is Ordinary English Prose",
    "HTTP://EXAMPLE.COM",
  ]) {
    assert.throws(
      () => assertTargetLanguage(
        { ...translation, origin: invalidOrigin },
        locale,
        alignedProperNameSource,
      ),
      new RegExp(`origin is not valid ${locale} text`),
      `unaligned Latin prose or URLs must not use the proper-name exception for ${locale}`,
    );
  }
}

assert.throws(
  () => assertTargetLanguage({
    ...localeFixtures.zh.good,
    title: localeFixtures["zh-tw"].good.title,
  }, "zh-tw"),
  /combined explanatory text is not valid zh-tw/,
  "Simplified Chinese prose must be rejected for zh-tw",
);
assert.throws(
  () => assertTargetLanguage({
    ...localeFixtures["zh-tw"].good,
    title: localeFixtures.zh.good.title,
  }, "zh"),
  /combined explanatory text is not valid zh/,
  "Traditional Chinese prose must be rejected for zh",
);
assert.throws(
  () => assertTargetLanguage({
    ...localeFixtures.zh.good,
    title: localeFixtures["zh-tw"].good.title,
  }, "zh"),
  /title is not valid zh/,
  "Traditional Chinese title must be rejected for zh",
);
assert.throws(
  () => assertTargetLanguage({
    ...localeFixtures["zh-tw"].good,
    title: localeFixtures.zh.good.title,
  }, "zh-tw"),
  /title is not valid zh-tw/,
  "Simplified Chinese title must be rejected for zh-tw",
);

const sharedHanOnly = {
  ...localeFixtures.zh.good,
  title: "中文迷因",
  summary: "中文迷因文化",
  description: "中文迷因文化文本",
  origin: "文化起源不明",
  usage_note: "朋友交流使用",
  caution: "正式使用注意",
  usage_examples: [{ situation: "朋友交流", text: "文化文本" }],
};
assert.doesNotThrow(() => assertTargetLanguage(sharedHanOnly, "zh"));
assert.doesNotThrow(() => assertTargetLanguage(sharedHanOnly, "zh-tw"));

const badEnglish = { ...validTranslation, origin: "한국어 원문을 그대로 복사한 유래입니다." };
assert.throws(
  () => assertTargetLanguage(badEnglish, "en"),
  /origin is not valid en text/,
);

const fidelitySource = {
  title: "페페 더 프로그",
  aliases: ["페페"],
  summary: "만화 캐릭터로 시작한 이미지 매크로 밈",
  description: "국내 커뮤니티에서는 반응짤 밈으로 사용된다.",
  origin: "만화 캐릭터",
  usage_note: null,
  caution: "",
  usage_examples: [],
};
const fidelityTranslations = {
  en: {
    title: "Pepe the Frog",
    summary: "A comic character that became an image macro meme.",
    description: "It is used as a reaction meme in Korean online communities.",
    origin: "A comic character.",
    usage_note: null,
    caution: null,
    aliases: ["Pepe"],
    usage_examples: [],
  },
  ja: {
    title: "ペペ・ザ・フロッグ",
    summary: "漫画キャラクターから広まった画像マクロのミームです。",
    description: "韓国のオンラインコミュニティではリアクション用のミームとして使われます。",
    origin: "漫画のキャラクターです。",
    usage_note: null,
    caution: null,
    aliases: ["ペペ"],
    usage_examples: [],
  },
  zh: {
    title: "佩佩蛙",
    summary: "源自漫画角色的图片梗。",
    description: "在韩国网络社区中，它被当作反应梗使用。",
    origin: "漫画角色。",
    usage_note: null,
    caution: null,
    aliases: ["佩佩"],
    usage_examples: [],
  },
  "zh-tw": {
    title: "佩佩蛙",
    summary: "源自漫畫角色的經典迷因圖。",
    description: "在韓國網路社群中，它被當作反應迷因使用。",
    origin: "漫畫角色。",
    usage_note: null,
    caution: null,
    aliases: ["佩佩"],
    usage_examples: [],
  },
};
for (const locale of ["en", "ja", "zh", "zh-tw"]) {
  assert.equal(
    assertSourceFidelity(fidelityTranslations[locale], locale, fidelitySource),
    fidelityTranslations[locale],
  );
}
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.en,
    usage_examples: [{ situation: "Chat", text: "A newly invented example." }],
  }, "en", fidelitySource),
  /usage_examples count must match source exactly/,
);
assert.throws(
  () => assertSourceFidelity({ ...fidelityTranslations.en, usage_note: "Invented guidance." }, "en", fidelitySource),
  /usage_note must remain empty/,
);
assert.throws(
  () => assertSourceFidelity({ ...fidelityTranslations.en, caution: "Invented caution." }, "en", fidelitySource),
  /caution must remain empty/,
);
assert.throws(
  () => assertSourceFidelity(
    fidelityTranslations.en,
    "en",
    { ...fidelitySource, usage_note: "친구 사이에서 사용" },
  ),
  /usage_note must remain non-empty/,
);
assert.throws(
  () => assertSourceFidelity(
    fidelityTranslations.en,
    "en",
    { ...fidelitySource, caution: "공식적인 자리에서는 주의" },
  ),
  /caution must remain non-empty/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.zh,
    description: "这是在韩国很常见的梗，在国内社区也经常使用。",
  }, "zh", fidelitySource),
  /bare domestic perspective/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations["zh-tw"],
    description: "這是在韓國常見的迷因，在國內社群也很流行。",
  }, "zh-tw", fidelitySource),
  /bare domestic perspective/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.en,
    title: "Korean Pepe meme",
    description: "It is used as an online joke in local communities.",
  }, "en", fidelitySource),
  /must name Korea/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.en,
    title: "Korean Pepe meme",
    summary: "A comic character that became a reaction image.",
    description: "It is used as a reaction image in Korean online communities.",
  }, "en", fidelitySource),
  /must use the locale meme term/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.ja,
    summary: "漫画キャラクターから広まった画像マクロのマネーとミームです。",
  }, "ja", fidelitySource),
  /must not mistranslate 밈 as マネー/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.ja,
    title: "ペペ・ザ・プログ",
  }, "ja", fidelitySource),
  /must preserve Pepe the Frog as ペペ・ザ・フロッグ/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.ja,
    title: "Pepe the Frogです",
  }, "ja", fidelitySource),
  /must preserve Pepe the Frog as ペペ・ザ・フロッグ/,
);
assert.throws(
  () => assertSourceFidelity(
    {
      ...fidelityTranslations.ja,
      title: "ペペ・ザ・フロッグ（悲しきカエルペペ）",
    },
    "ja",
    { ...fidelitySource, title: "페페 더 프로그(슬픈 개구리 페페)" },
  ),
  /must translate 슬픈 개구리 naturally as 悲しいカエル/,
);
assert.throws(
  () => assertSourceFidelity(
    {
      ...fidelityTranslations.ja,
      title: "ペペ・ザ・フロッグ（楽しいカエルのペペ）",
    },
    "ja",
    { ...fidelitySource, title: "페페 더 프로그(슬픈 개구리 페페)" },
  ),
  /must translate 슬픈 개구리 naturally as 悲しいカエル/,
);
assert.doesNotThrow(() => assertSourceFidelity(
  {
    ...fidelityTranslations.ja,
    description: "劇団の俳優が登場するミームです。",
  },
  "ja",
  { ...fidelitySource, description: "극단 배우가 등장하는 밈이다." },
));
const sensitiveContextSource = {
  ...fidelitySource,
  description: "국내에서는 여유를 표현하는 밈이지만 극단주의 커뮤니티가 혐오 상징으로 사용했다.",
};
const sensitiveJapanese = {
  ...fidelityTranslations.ja,
  description: "韓国ではくつろぎを表すミームだが、極端主義コミュニティがヘイトシンボルとして利用した。",
};
assert.doesNotThrow(() => assertSourceFidelity(sensitiveJapanese, "ja", sensitiveContextSource));
assert.throws(
  () => assertSourceFidelity({
    ...sensitiveJapanese,
    description: "韓国ではくつろぎを表すミームだが、極端なコミュニティがヘイトシンボルとして利用した。",
  }, "ja", sensitiveContextSource),
  /must preserve the source's extremist meaning precisely/,
);
assert.throws(
  () => assertSourceFidelity({
    ...sensitiveJapanese,
    description: "韓国ではくつろぎを表すミームだが、極端主義コミュニティが憎しみのシンボルとして利用した。",
  }, "ja", sensitiveContextSource),
  /must preserve 혐오 상징 with the locale's precise term/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations.zh,
    description: "在韩国，它是表达轻松情绪的表情包，但曾被极端社区用作仇恨象征。",
  }, "zh", sensitiveContextSource),
  /must preserve the source's extremist meaning precisely/,
);
assert.throws(
  () => assertSourceFidelity({ ...fidelityTranslations.zh, summary: "源自漫画角色的图像宏梗。" }, "zh", fidelitySource),
  /malformed or redundant image-macro term/,
);
assert.throws(
  () => assertSourceFidelity({
    ...fidelityTranslations["zh-tw"],
    summary: "源自漫畫角色的圖像宏觀梗迷因。",
  }, "zh-tw", fidelitySource),
  /malformed or redundant meme term/,
);
assert.throws(
  () => assertSourceFidelity({ ...fidelityTranslations["zh-tw"], summary: "源自動漫角色的迷因。" }, "zh-tw", fidelitySource),
  /must translate 만화 as 漫畫 rather than 動漫/,
);
const tooManySourceExamples = Array.from({ length: 11 }, (_, index) => ({
  situation: `상황 ${index + 1}`,
  text: `예문 ${index + 1}`,
}));
assert.throws(
  () => assertSourceFidelity(
    fidelityTranslations.en,
    "en",
    { ...fidelitySource, usage_examples: tooManySourceExamples },
  ),
  /source usage_examples exceeds the supported maximum of 10/,
);
assert.throws(
  () => assertSourceFidelity(
    {
      ...fidelityTranslations.en,
      usage_examples: [{ situation: "Invented situation", text: "Invented dialogue." }],
    },
    "en",
    { ...fidelitySource, usage_examples: [{}] },
  ),
  /source usage_examples\[0\]\.situation must be a non-empty string/,
);

for (const invalidSourceExamples of [tooManySourceExamples, [{}]]) {
  let invalidSourceModelCalled = false;
  await assert.rejects(
    requestMlxTranslation({
      endpoint: "http://127.0.0.1:8080/v1/chat/completions",
      model: "test-model",
      locale: "en",
      meme: { ...fidelitySource, usage_examples: invalidSourceExamples },
      fetchImpl: async () => {
        invalidSourceModelCalled = true;
        throw new Error("model must not be called for invalid source examples");
      },
    }),
    /source usage_examples/,
  );
  assert.equal(invalidSourceModelCalled, false);
}

const promptCaptures = {};
for (const locale of ["en", "ja", "zh", "zh-tw"]) {
  await requestMlxTranslation({
    endpoint: "http://127.0.0.1:8080/v1/chat/completions",
    model: "test-model",
    locale,
    meme: fidelitySource,
    fetchImpl: async (_url, init) => {
      promptCaptures[locale] = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return {
            choices: [{
              finish_reason: "stop",
              message: {
                content: JSON.stringify({
                  ...fidelityTranslations[locale],
                  usage_note: "",
                  caution: "",
                }),
              },
            }],
          };
        },
      };
    },
  });
}
for (const locale of ["en", "ja", "zh", "zh-tw"]) {
  const capturedPrompt = promptCaptures[locale].messages.map((message) => message.content).join("\n");
  assert.match(capturedPrompt, /SOURCE FIDELITY RULE/);
  assert.match(capturedPrompt, /exactly 0 item\(s\)/);
  assert.match(capturedPrompt, /Translate each non-empty source usage_note and caution/);
  assert.match(capturedPrompt, /국내\/우리나라/);
}
assert.match(promptCaptures.en.messages[0].content, /이미지 매크로 = image macro/);
assert.match(promptCaptures.ja.messages[0].content, /밈 = ミーム \(never マネー\)/);
assert.match(promptCaptures.ja.messages[0].content, /Pepe the Frog\/페페 더 프로그 = ペペ・ザ・フロッグ/);
assert.match(promptCaptures.zh.messages[0].content, /이미지 매크로 밈 as the single natural phrase 经典表情包/);
assert.match(promptCaptures["zh-tw"].messages[0].content, /이미지 매크로 밈 as the single natural phrase 經典迷因圖/);

const mlxBodies = [];
const repaired = await requestMlxTranslation({
  endpoint: "http://127.0.0.1:8080/v1/chat/completions",
  model: "test-model",
  locale: "en",
  meme: {
    title: "킹받네",
    aliases: [],
    summary: "원문 요약",
    description: "원문 설명",
    origin: "원문 유래",
    usage_note: "친구끼리 가볍게 사용해요.",
    caution: "공식적인 자리에서는 피하는 편이 좋아요.",
    usage_examples: [{ situation: "친구와 대화", text: "그거 정말 킹받네." }],
  },
  fetchImpl: async (_url, init) => {
    mlxBodies.push(JSON.parse(init.body));
    const content = mlxBodies.length === 1
      ? JSON.stringify(allKoreanTranslation)
      : JSON.stringify(validTranslation);
    return {
      ok: true,
      async json() {
        return { choices: [{ finish_reason: "stop", message: { content } }] };
      },
    };
  },
});
assert.deepEqual(repaired, validTranslation);
assert.equal(mlxBodies.length, 2, "language validation failure must be retried");
assert.match(
  mlxBodies[1].messages[1].content,
  /title is not valid en text/,
  "repair prompt must identify the failed field and target locale",
);
assert.throws(
  () => parseStrictTranslation(JSON.stringify({ ...validTranslation, aliases: "wrong" })),
  /aliases/,
);
assert.throws(
  () => parseStrictTranslation(JSON.stringify({ ...validTranslation, description: " " })),
  /description must not be empty/,
);
assert.throws(
  () => parseStrictTranslation(JSON.stringify({
    ...validTranslation,
    usage_examples: [{ situation: "Chat", text: "Example", extra: "no" }],
  })),
  /exact schema/,
);

assert.deepEqual(parseSupabaseCliJson('{"rows":[{"n":1}]}'), [{ n: 1 }]);
assert.deepEqual(parseSupabaseCliJson('[{"n":3}]'), [{ n: 3 }]);
assert.deepEqual(
  parseSupabaseCliJson('Initialising login role...\n{"boundary":"x","rows":[{"n":2}]}'),
  [{ n: 2 }],
);
assert.throws(() => parseSupabaseCliJson('{"data":[]}'), /rows array/);

const encoded = encodeJsonBase64({ korean: "킹받네", quote: "'" });
assert.deepEqual(decodeJsonBase64(encoded), { korean: "킹받네", quote: "'" });

const candidateSql = buildCandidateSql(["abc123"], "en");
assert.match(candidateSql, /not exists/i);
assert.match(candidateSql, /meme_sources/);
assert.match(candidateSql, /meme_contents/);
assert.match(candidateSql, /meme_tags_map/);
assert.doesNotMatch(candidateSql, /abc123/, "sitemap IDs must be base64-encoded");

const sourceMeme = {
  id: "11111111-1111-4111-8111-111111111111",
  short_id: "abc123",
  slug: "킹받네",
  updated_at: "2026-07-28T00:00:00.000Z",
  title: "킹받네",
  summary: "장난스럽게 화가 난다는 뜻",
  description: "원문 설명",
  origin: "원문 유래",
  usage_note: null,
  caution: "상황에 따라 주의",
  aliases: ["킹받네", "킹받다"],
  usage_examples: [{ situation: "친구와", text: "진짜 킹받네" }],
};
const snapshot = sourceSnapshot(sourceMeme);
const snapshotHash = sourceSnapshotHash(snapshot);
assert.match(snapshotHash, /^[a-f0-9]{64}$/);
assert.notEqual(
  sourceSnapshotHash({ ...snapshot, summary: `${snapshot.summary}!` }),
  snapshotHash,
);
const insertSql = buildAtomicInsertSql({
  meme: { ...sourceMeme, source_snapshot: snapshot, source_snapshot_hash: snapshotHash },
  locale: "en",
  translation: validTranslation,
  model: "test-model",
});
assert.match(insertSql, /for share of m/i);
assert.match(insertSql, /m\.updated_at = i\.source_updated_at/i);
assert.match(insertSql, /moderation_status in \('approved', 'limited'\)/i);
for (const field of [
  "title",
  "summary",
  "description",
  "origin",
  "usage_note",
  "caution",
  "aliases",
  "usage_examples",
]) {
  assert.match(
    insertSql,
    new RegExp(`m\\.${field} is not distinct from i\\.source_${field}`, "i"),
    `atomic insert must compare source snapshot field ${field}`,
  );
}
assert.match(insertSql, /btrim\(i\.description\) <> ''/i);
assert.match(insertSql, /'machine'/i);
assert.match(insertSql, /'mlx'/i);
assert.match(insertSql, /on conflict \(meme_id, locale\) do nothing/i);
assert.match(insertSql, /count\(\*\)::int as inserted_count/i);
assert.doesNotMatch(insertSql, /King-bat-ne/, "model output must be base64-encoded");
const encodedInsertPayload = insertSql.match(/decode\('([^']+)', 'base64'\)/)?.[1];
assert.ok(encodedInsertPayload);
const decodedInsertPayload = decodeJsonBase64(encodedInsertPayload);
assert.equal(decodedInsertPayload.source_snapshot_hash, snapshotHash);
assert.deepEqual(decodedInsertPayload.source_aliases, sourceMeme.aliases);
assert.deepEqual(decodedInsertPayload.source_usage_examples, sourceMeme.usage_examples);
assert.throws(
  () => buildAtomicInsertSql({
    meme: { ...sourceMeme, source_snapshot: snapshot, source_snapshot_hash: "0".repeat(64) },
    locale: "en",
    translation: validTranslation,
    model: "test-model",
  }),
  /snapshot hash mismatch/,
);

let modelCalled = false;
let writeCalled = false;
const logs = [];
const substantialCandidate = {
  ...sourceMeme,
  title: "원문 제목",
  aliases: [],
  summary: "원문 요약",
  description: "충분한 설명",
  origin: "충분한 유래",
  usage_note: null,
  caution: null,
  usage_examples: [],
  meme_sources: [],
  meme_contents: [],
  meme_tags_map: [],
};
const dryRunResult = await run(["--locale=en", "--limit=1"], {
  fetchImpl: async () => ({
    ok: true,
    async text() {
      return "<urlset><url><loc>https://catchmeme.com/memes/abc123-source</loc></url></urlset>";
    },
  }),
  queryImpl: async () => [substantialCandidate],
  isIndexableMeme: () => true,
  translateImpl: async () => {
    modelCalled = true;
    return validTranslation;
  },
  persistImpl: async () => {
    writeCalled = true;
  },
  logger: {
    log(value) {
      logs.push(String(value));
    },
    error(value) {
      logs.push(String(value));
    },
  },
});
assert.deepEqual(dryRunResult, { selected: 1, translated: 0, failed: 0 });
assert.equal(modelCalled, false, "dry-run must not call MLX");
assert.equal(writeCalled, false, "dry-run must not write to Supabase");
assert.doesNotMatch(logs.join("\n"), /원문 제목|원문 요약|충분한 설명/);

console.log("translate-memes MLX linked safeguards OK");
