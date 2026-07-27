#!/usr/bin/env node
/**
 * Parse public careet.net scrapes into review-only slang/abbreviation candidates.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { memeTitleKey } from "./meme-title-key.mjs";

const PAYWALL = /앗! 여기서부터 진짜 필요한 내용인데/;

const TITLE_NOISE =
  /(?:모음|총정리|해독|사전|인터뷰|브랜드|마케팅|레퍼런스|근황|데이터|리포트|캘린더|전광판|이주의|요즘 뜨는|Z세대가|MZ세대|도대체|검색으로|릴스 조회수|SNS 담당자|제안서|공감과 클릭)/;

function jsonlFiles(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return extname(absolute) === ".jsonl" ? [absolute] : [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolute, entry.name);
    if (entry.isDirectory()) return jsonlFiles(entryPath);
    return extname(entry.name) === ".jsonl" ? [entryPath] : [];
  });
}

function loadCatalogKeys(csvPaths) {
  const keys = new Set();
  for (const path of csvPaths.split(",").map((part) => part.trim()).filter(Boolean)) {
    if (!existsSync(resolve(path))) continue;
    for (const file of jsonlFiles(path)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          for (const name of [row.title, row.term, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
            const key = memeTitleKey(name);
            if (key) keys.add(key);
          }
        } catch {
          // ignore malformed rows
        }
      }
    }
  }
  return keys;
}

function collectInputFiles(paths) {
  const files = [];
  for (const base of paths.split(",").map((p) => p.trim()).filter(Boolean)) {
    const absolute = resolve(base);
    if (!existsSync(absolute)) continue;
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/careet/i.test(entry.name) && /\.(md|json)$/i.test(entry.name)) files.push(full);
      }
    };
    if (statSync(absolute).isDirectory()) walk(absolute);
    else files.push(absolute);
  }
  return [...new Set(files)];
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\\+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^['"‘’]+|['"‘’]+$/g, "")
    .trim();
}

function normalizeTerm(term) {
  return cleanText(term)
    .replace(/^\d+\.\s*/, "")
    .replace(/\s*VS\s*.+$/i, "")
    .replace(/\(.+?\)$/g, (m) => (m.length > 20 ? "" : m))
    .trim();
}

function isNoisyTerm(term) {
  if (!term || term.length < 2 || term.length > 40) return true;
  if (/^(목차|캐릿|회원|로그인|북마크|상세보기|시리즈|유행중|유행지남|유행예감)$/i.test(term)) return true;
  if (/^\d+대$/.test(term)) return true;
  if (/^(노래|이미지|마케터|신조어|밈\/유행어|해외의|체험|그런데|하나로|결제|공간)$/.test(term)) return true;
  if (/^\[.*해설지\]/.test(term)) return true;
  if (/참고하기 좋은|자주 보이는 밈|자주 사용하는 밈|줄임말 모음/.test(term)) return true;
  if (/^임플로이언서|^전업 자녀부터/.test(term)) return true;
  if (/^✅\s/.test(term)) return true;
  if (TITLE_NOISE.test(term)) return true;
  if (/[?？]/.test(term) && term.length > 12) return true;
  if (/^https?:\/\//.test(term)) return true;
  return false;
}

function inferCategory(term, definition, hint = "") {
  const blob = `${term} ${definition} ${hint}`;
  if (/줄임말|초성|abbrev|꾸미기'의|의 줄임/.test(blob)) return "abbreviation";
  if (/밈|짤|드립|패러디|상황극|응용/.test(blob)) return "meme";
  if (/반어|신조어|유행어|해시태그|의성어|속어/.test(blob)) return "slang";
  return "phrase";
}

function parseOriginYear(text, fallbackUrl) {
  const fromText = text.match(/20\d{2}(?:\.\d{2}\.\d{2})?/);
  if (fromText) return Number(fromText[0].slice(0, 4));
  const fromUrl = fallbackUrl?.match(/careet\.net\/(\d+)/);
  if (fromUrl) {
    const id = Number(fromUrl[1]);
    if (id >= 1900) return 2025;
    if (id >= 1700) return 2024;
    if (id >= 1500) return 2023;
    if (id >= 1200) return 2022;
    if (id >= 900) return 2021;
    if (id >= 600) return 2020;
    if (id >= 300) return 2019;
    return 2018;
  }
  return null;
}

function addCandidate(store, seen, catalogKeys, raw) {
  const term = normalizeTerm(raw.term);
  const definition = cleanText(raw.definition);
  if (isNoisyTerm(term)) return;

  const aliases = [...new Set((raw.aliases ?? []).map(cleanText).filter((a) => a && a.length <= 60 && a !== term))];
  const keys = [term, ...aliases].map(memeTitleKey).filter(Boolean);
  if (keys.some((key) => catalogKeys.has(key))) return;
  const dedupeKey = keys[0];
  if (!dedupeKey || seen.has(dedupeKey)) return;
  seen.add(dedupeKey);

  store.push({
    term,
    aliases,
    definition: definition || null,
    category: raw.category ?? inferCategory(term, definition, raw.collection_note ?? ""),
    source_url: raw.source_url ?? null,
    source: "careet.net",
    origin_year: raw.origin_year ?? null,
    catalog_match_status: "new",
    review_status: "needs_human_source_match",
    collection_note:
      raw.collection_note ??
      "Public careet.net excerpt; confirm definition and meme-title mapping before catalog merge.",
  });
}

function parseDictionaryEntries(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  const re = /^- _([^_]+)_\s*\n([^\n-][^\n]*)/gm;
  let match;
  while ((match = re.exec(body))) {
    rows.push({
      term: match[1],
      definition: match[2],
      source_url: sourceUrl,
      collection_note: "요즘어 사전 public teaser entry.",
    });
  }
  return rows;
}

function parseTocTerms(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  for (const line of body.split("\n")) {
    const matches = line.matchAll(/\*\*\d+\\\.\s*([^*<]+?)(?:<br>|\*\*)/g);
    for (const m of matches) {
      const chunk = cleanText(m[1]);
      for (const piece of chunk.split(/[,·/]/)) {
        const term = normalizeTerm(piece);
        if (!isNoisyTerm(term)) {
          rows.push({
            term,
            definition: null,
            source_url: sourceUrl,
            collection_note: "Extracted from article table of contents.",
          });
        }
      }
    }
  }
  return rows;
}

function parseSectionArticles(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  const chunks = body.split(/^###\s+/m).slice(1);
  for (const chunk of chunks) {
    const header = chunk.split("\n")[0];
    const term = normalizeTerm(header.replace(/^\d+\.\s*/, ""));
    if (isNoisyTerm(term)) continue;

    const definitionMatch = chunk.match(
      /(?:\*\*✔ 뜻(?:&유래)?\*\*|◾ 뜻:)\s*([\s\S]*?)(?:\n\n|\*\*✅|\*\*🔗|!\[|$)/,
    );
    const inlineAbbrev = chunk.match(/['"‘]([^'"]{2,30})['"’]의\s*줄임말[^.\n]*[.。]?\s*([^.\n]{15,300})/);
    const plain = chunk
      .split("\n")
      .slice(1)
      .filter((line) => line.trim() && !line.startsWith("!["))
      .join(" ")
      .slice(0, 400);

    const definition = definitionMatch?.[1] ?? inlineAbbrev?.[2] ?? plain;
    const aliases = inlineAbbrev?.[1] ? [inlineAbbrev[1]] : [];

    rows.push({
      term,
      aliases,
      definition,
      source_url: sourceUrl,
      collection_note: "Article section before membership paywall.",
    });
  }
  return rows;
}

function parseHashKeywords(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  for (const match of body.matchAll(/\*\*#([^*]+)\*\*\s*[\s\S]*?“([^”]+)”/g)) {
    const term = normalizeTerm(match[1]);
    if (isNoisyTerm(term)) continue;
    rows.push({
      term,
      definition: cleanText(match[2]),
      source_url: sourceUrl,
      category: "phrase",
      collection_note: "Z세대 자문단 keyword quote block.",
    });
  }
  return rows;
}

function parseInlineDictionary(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  const block = body.match(/요즘 단어 사전([\s\S]*?)(?:!\[|앗! 여기서부터)/);
  if (!block) return rows;
  for (const match of block[1].matchAll(/(\d+)\.\s*([^:<\n]+):([\s\S]*?)(?=\d+\.|$)/g)) {
    const term = normalizeTerm(match[2]);
    const definition = cleanText(match[3]);
    if (!isNoisyTerm(term)) {
      rows.push({
        term,
        definition,
        source_url: sourceUrl,
        category: "slang",
        collection_note: "Inline 요즘 단어 사전 block.",
      });
    }
  }
  return rows;
}

function parseAbbrevFromText(text, sourceUrl) {
  const rows = [];
  const body = text.split(PAYWALL)[0];
  const patterns = [
    /['"‘]?([가-힣a-zA-Z0-9]{2,12})['"’]?(?:은|는|이)?\s*['"‘]([^'"]{2,40})['"’]의\s*줄임말[^.。\n]*[.。]?\s*([^.\n]{10,220})/g,
    /['"‘]([^'"]{2,20})['"’](?:은|는|이)?\s*['"‘]([^'"]{2,40})['"’]의\s*줄임말/g,
    /([가-힣a-zA-Z]{2,12})\s*[:：]\s*['"‘]([^'"]{2,40})['"’]의\s*줄임말[^.。\n]*[.。]?\s*([^.\n]{10,180})/g,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(body))) {
      const term = normalizeTerm(match[1]);
      if (isNoisyTerm(term)) continue;
      rows.push({
        term,
        aliases: match[2] ? [cleanText(match[2])] : [],
        definition: match[3] ? cleanText(match[3]) : null,
        source_url: sourceUrl,
        category: "abbreviation",
      });
    }
  }
  return rows;
}

function parseMicroTrend(text, sourceUrl) {
  const rows = [];
  // List page shows a membership teaser before public rows.
  const body = text.split(PAYWALL).length > 1 ? text.split(PAYWALL).pop() : text;
  const dates = [...String(body).matchAll(/(20\d{2})\.(\d{2})\.(\d{2})(?:\s+\d{2}:\d{2})?/g)];
  for (let i = 0; i < dates.length; i += 1) {
    const start = dates[i].index ?? 0;
    const end = i + 1 < dates.length ? dates[i + 1].index ?? body.length : body.length;
    const block = body.slice(start, end);
    const origin_year = Number(dates[i][1]);
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("!["));
    const platforms = new Set(["엑스", "인스타그램", "유튜브", "틱톡", "트위터", "페이스북"]);
    const titleCandidates = lines.filter(
      (line) =>
        !/^20\d{2}\./.test(line) &&
        !/^✔/.test(line) &&
        !/^실시간/.test(line) &&
        !platforms.has(line) &&
        line.length <= 40,
    );
    const term = normalizeTerm(titleCandidates[0] ?? "");
    if (isNoisyTerm(term)) continue;
    const definition = lines
      .filter((line) => line.startsWith("✔"))
      .map((line) => line.replace(/^✔\s*/, ""))
      .join(" ");
    if (!definition) continue;
    rows.push({
      term,
      definition,
      source_url: sourceUrl,
      origin_year,
      category: inferCategory(term, definition, "micro trend"),
      collection_note: "MicroTrend board public row.",
    });
  }
  return rows;
}

function parseMapJson(file) {
  const rows = [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return rows;
  }
  for (const link of parsed?.data?.links ?? []) {
    const { url, description = "" } = link;
    if (!description || !url?.includes("careet.net/")) continue;

    const inline = description.matchAll(
      /['"‘]?([가-힣a-zA-Z0-9]{2,12})['"’]?(?:은|는|이)?\s*['"‘]([^'"]{2,40})['"’]의\s*줄임말[^.]*[.。]?\s*([^]{0,180})/g,
    );
    for (const match of inline) {
      const term = normalizeTerm(match[1]);
      if (isNoisyTerm(term)) continue;
      rows.push({
        term,
        aliases: [cleanText(match[2])],
        definition: cleanText(match[3]),
        source_url: url,
        category: "abbreviation",
        collection_note: "firecrawl map description snippet.",
      });
    }

    const named = description.match(/['"‘]([^'"]{2,20})['"’](?:은|는|이)?\s*['"‘]([^'"]{2,40})['"’]의\s*줄임말/);
    if (named) {
      const term = normalizeTerm(named[1]);
      if (!isNoisyTerm(term)) {
        rows.push({
          term,
          aliases: [cleanText(named[2])],
          definition: cleanText(description).slice(0, 220),
          source_url: url,
          category: "abbreviation",
          collection_note: "firecrawl map description snippet.",
        });
      }
    }
  }
  return rows;
}

function curatedSeeds() {
  return [
    {
      term: "영크크",
      aliases: ["YOUNGCREATORCREW", "영 크리에이터 크루"],
      definition:
        "코르티스 곡 제목을 줄인 말. 젊고 트렌디한 사람을 가리키며, 늙크크·올크크와 대비되어 쓰인다.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1905",
      origin_year: 2026,
      collection_note: "Curated from free article section.",
    },
    {
      term: "늙크크",
      aliases: ["올크크", "올드 크리에이터 크루"],
      definition: "2030이 자신을 칭하거나 나이를 강조할 때 쓰는 세대 구분 밈. 영크크의 반대말.",
      category: "meme",
      source_url: "https://www.careet.net/1905",
      origin_year: 2026,
    },
    {
      term: "사고방식을 바꾸세요",
      aliases: [],
      definition:
        "부정적 자책을 고양이 무심한 말투로 바꿔 쓰는 짤 밈. '난 왜 이럴까?' 대신 '하면 해 ㅋㅋ' 식으로 변주한다.",
      category: "meme",
      source_url: "https://www.careet.net/1704",
      origin_year: 2025,
    },
    {
      term: "스핀",
      aliases: ["스핀깅", "스핀스핀"],
      definition: "덕질 때 쓰는 익명 Q&A 서비스명. 엑스 프로필에 링크를 올려 팬들과 소통한다.",
      category: "slang",
      source_url: "https://www.careet.net/1509",
      origin_year: 2024,
    },
    {
      term: "푸슝",
      aliases: ["푸슝깅"],
      definition: "덕질 익명 Q&A 서비스. 스핀과 함께 Z세대 팬덤 소통 문화로 자리 잡았다.",
      category: "slang",
      source_url: "https://www.careet.net/1509",
      origin_year: 2024,
    },
    {
      term: "감옥에~서 누가 돌아왔~게",
      aliases: [],
      definition:
        "크리에이터 팔리아치의 유행어. 안심귀가 통화 상황극 대사로, 과장된 억양이 포인트다.",
      category: "meme",
      source_url: "https://www.careet.net/Dictionary",
    },
    {
      term: "갓생",
      aliases: [],
      definition:
        "god(신)과 인생의 합성어. 부지런하고 알찬 삶을 사는 것을 뜻하며, 최근엔 완벽한 갓생보다 적당한 쉼을 추구하는 인식도 확산했다.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1465",
      origin_year: 2024,
    },
    {
      term: "좋반",
      aliases: ["좋아요반사", "#좋반해요", "#좋반가요"],
      definition: "좋아요 반사의 줄임말. 상대 게시물에 좋아요를 주면 나도 좋아요를 주겠다는 뜻의 인스타 해시태그.",
      category: "abbreviation",
      source_url: "https://www.careet.net/7",
      origin_year: 2020,
    },
    {
      term: "반모",
      aliases: ["반말 모드"],
      definition: "반말 모드의 줄임말. 유튜브·SNS에서 친해지자는 제안으로 쓰인다.",
      category: "abbreviation",
      source_url: "https://www.careet.net/7",
      origin_year: 2020,
    },
    {
      term: "볼꾸",
      aliases: ["볼펜 꾸미기"],
      definition: "볼펜 꾸미기의 줄임말. 동대문 부자재시장에서 파츠를 골라 커스텀 볼펜을 만드는 Z세대 트렌드.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1938",
      origin_year: 2026,
    },
    {
      term: "책없쾌",
      aliases: ["책임 없는 쾌락"],
      definition:
        "책임 없는 쾌락의 줄임말. 연애·관계에서 부담 없이 즐기려는 태도를 가리키는 Z세대 신조어.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1945",
      origin_year: 2026,
      collection_note: "Listed in public TOC; full article mostly behind paywall.",
    },
    {
      term: "느좋",
      aliases: ["느낌 좋다"],
      definition: "느낌 좋다의 줄임말. 멋지다·감성적이다의 대체어로 쓰인다.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1492",
      origin_year: 2024,
    },
    {
      term: "깊생",
      aliases: ["깊은 생각"],
      definition: "깊은 생각의 줄임말. 덕질 대상에 대한 마음을 표현하는 주접 밈으로 쓰인다.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1492",
      origin_year: 2024,
    },
    {
      term: "사보필",
      aliases: [],
      definition: "careet.net 1945 목차에 포함된 Z세대 줄임말. 멤버십 구간이라 공개 정의는 후속 검수 필요.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1945",
      origin_year: 2026,
      collection_note: "Term listed in public TOC; definition behind paywall.",
    },
    {
      term: "오살힘",
      aliases: [],
      definition: "careet.net 1945 목차에 포함된 Z세대 줄임말. 멤버십 구간이라 공개 정의는 후속 검수 필요.",
      category: "abbreviation",
      source_url: "https://www.careet.net/1945",
      origin_year: 2026,
      collection_note: "Term listed in public TOC; definition behind paywall.",
    },
  ];
}

function sourceUrlFromFile(file) {
  const name = file.split("/").pop() ?? "";
  const idMatch = name.match(/careet-(\d+)\.md/) ?? name.match(/careet\.net-(\d+)\.md/);
  if (idMatch) return `https://www.careet.net/${idMatch[1]}`;
  if (/dictionary/i.test(name)) return "https://www.careet.net/Dictionary";
  if (/microtrend/i.test(name)) return "https://www.careet.net/MicroTrend";
  return "https://www.careet.net/";
}

function main() {
  const [, , inputDirs, catalogDirs, outputPath] = process.argv;
  if (!inputDirs || !catalogDirs || !outputPath) {
    console.error(
      "Usage: node scripts/collect-careet-slang-candidates.mjs <input-dirs> <catalog-dirs> <output.jsonl>",
    );
    process.exit(1);
  }

  const catalogKeys = loadCatalogKeys(catalogDirs);
  const files = collectInputFiles(inputDirs);
  const store = [];
  const seen = new Set();

  for (const seed of curatedSeeds()) addCandidate(store, seen, catalogKeys, seed);

  for (const file of files) {
    if (file.endsWith(".json")) {
      for (const row of parseMapJson(file)) addCandidate(store, seen, catalogKeys, row);
      continue;
    }

    const text = readFileSync(file, "utf8");
    const sourceUrl = sourceUrlFromFile(file);
    const parsers = [
      parseDictionaryEntries(text, sourceUrl),
      parseTocTerms(text, sourceUrl),
      parseSectionArticles(text, sourceUrl),
      parseHashKeywords(text, sourceUrl),
      parseInlineDictionary(text, sourceUrl),
      parseAbbrevFromText(text, sourceUrl),
    ];
    if (/microtrend/i.test(file)) parsers.push(parseMicroTrend(text, sourceUrl));

    for (const rows of parsers) {
      for (const row of rows) {
        addCandidate(store, seen, catalogKeys, {
          ...row,
          origin_year: row.origin_year ?? parseOriginYear(text, sourceUrl),
        });
      }
    }
  }

  store.sort((a, b) => a.term.localeCompare(b.term, "ko"));
  const out = store.map((row) => JSON.stringify(row)).join("\n") + (store.length ? "\n" : "");
  writeFileSync(resolve(outputPath), out, "utf8");
  console.log(
    JSON.stringify({
      files: files.length,
      rows: store.length,
      output: resolve(outputPath),
      catalog_keys: catalogKeys.size,
    }),
  );
}

main();
