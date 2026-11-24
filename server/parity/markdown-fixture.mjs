#!/usr/bin/env node
// Writes the expected values for server/tests/markdown_parity.rs: community
// post bodies rendered by the app's real `MarkdownBody`
// (components/markdown-body.tsx: react-markdown with remark-gfm and
// remark-breaks, `sanitizeMarkdownUrl`, the media rules) under Node.
//
//   node server/parity/markdown-fixture.mjs > server/tests/fixtures/markdown.json
//
// Node 22.18 or later. The component is transpiled with the repository's
// TypeScript and loaded with its imports resolved from the repository, so
// the code that renders is the app's own. Bodies too large to keep are
// stored as how to build them and the SHA-256 of their markup.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(`${root}package.json`);
const ts = require("typescript");
const source = readFileSync(`${root}components/markdown-body.tsx`, "utf8");
const { outputText } = ts.transpileModule(source, {
  fileName: "markdown-body.tsx",
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
});
const resolved = outputText.replace(/from "([^"]+)"/g, (_, specifier) => {
  const url = specifier.startsWith("@/")
    ? pathToFileURL(`${root}${specifier.slice(2)}.ts`).href
    : pathToFileURL(require.resolve(specifier)).href;
  return `from "${url}"`;
});
const { MarkdownBody } = await import(`data:text/javascript,${encodeURIComponent(resolved)}`);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const render = (body) => renderToStaticMarkup(createElement(MarkdownBody, null, body));

// [name, body]
const CASES = [
  ["empty", ""],
  ["plain", "그냥 글이에요."],
  ["paragraphs", "첫 문단.\n\n둘째 문단."],
  ["soft break", "첫 줄\n둘째 줄\n셋째 줄"],
  ["soft break with indent", "첫 줄\n   둘째 줄"],
  ["hard break spaces", "첫 줄  \n둘째 줄"],
  ["hard break backslash", "첫 줄\\\n둘째 줄"],
  ["trailing spaces", "글 끝에 공백   "],
  ["crlf", "첫 줄\r\n둘째 줄\r\n\r\n문단"],
  ["cr", "첫 줄\r둘째 줄"],
  ["tabs", "\t탭으로 시작\n글\t중간"],
  ["leading blank lines", "\n\n\n글"],
  ["many blank lines", "가\n\n\n\n\n나"],
  ["emphasis", "*기울임* _밑줄 기울임_ **굵게** __굵게__ ***둘 다***"],
  ["nested emphasis", "**굵게 *안에 기울임* 다시 굵게**"],
  ["intraword underscore", "snake_case_word 와 a*b*c"],
  ["unmatched emphasis", "*열기만 **굵게 열기 _ 밑줄"],
  ["emphasis across lines", "*첫 줄\n둘째 줄*"],
  ["strikethrough", "~~취소~~ 와 ~하나~ 와 ~~~셋~~~"],
  ["inline code", "`코드` 와 ``백틱 ` 안`` 와 `<b>태그</b>`"],
  ["inline code spaces", "` 앞뒤 공백 `"],
  ["unclosed backtick", "`닫히지 않음"],
  ["headings", "# 하나\n## 둘\n### 셋\n#### 넷\n##### 다섯\n###### 여섯"],
  ["heading closing hashes", "## 제목 ##\n#없는 공백\n####### 일곱"],
  ["empty heading", "#\n\n## "],
  ["setext headings", "제목\n===\n\n부제목\n---"],
  ["heading then text", "# 제목\n바로 다음 줄"],
  ["thematic breaks", "가\n\n***\n\n나\n\n---\n\n___"],
  ["tight list", "- 하나\n- 둘\n- 셋"],
  ["loose list", "- 하나\n\n- 둘\n\n- 셋"],
  ["star and plus lists", "* 별\n* 별\n\n+ 더하기"],
  ["ordered list", "1. 하나\n2. 둘\n3. 셋"],
  ["ordered start", "3. 셋\n4. 넷"],
  ["ordered paren", "1) 하나\n2) 둘"],
  ["nested list", "- 위\n  - 아래\n    - 더 아래\n- 다시 위"],
  ["list with paragraphs", "- 첫 문단\n\n  둘째 문단\n- 다음"],
  ["list with code", "- 항목\n\n  ```\n  코드\n  ```"],
  ["list soft break", "- 첫 줄\n  둘째 줄"],
  ["task list", "- [ ] 할 일\n- [x] 한 일\n- [X] 대문자\n- 그냥"],
  ["task list loose", "- [ ] 할 일\n\n- [x] 한 일"],
  ["task list nested", "- [ ] 위\n  - [x] 아래"],
  ["task not at start", "- 앞 [x] 뒤"],
  ["blockquote", "> 인용"],
  ["blockquote paragraphs", "> 첫 문단\n>\n> 둘째 문단"],
  ["blockquote lazy", "> 첫 줄\n이어지는 줄"],
  ["nested blockquote", "> 하나\n>> 둘\n>>> 셋"],
  ["blockquote list", "> - 하나\n> - 둘"],
  ["fenced code", "```js\nconst a = 1;\nconsole.log(a);\n```"],
  ["fenced no lang", "```\n코드\n```"],
  ["fenced tilde", "~~~python\nprint(1)\n~~~"],
  ["fenced info words", "```js title=\"x\"\nx\n```"],
  ["fenced empty", "```\n```"],
  ["fenced unclosed", "```\n닫히지 않음"],
  ["fenced html", "```html\n<script>alert(1)</script>\n```"],
  ["indented code", "    들여쓴 코드\n    둘째 줄"],
  ["code then text", "```\n코드\n```\n글"],
  ["link", "[링크](https://example.com/a)"],
  ["link title", "[링크](https://example.com \"제목\")"],
  ["link http upper", "[링크](HTTPS://EXAMPLE.COM)"],
  ["link relative", "[미디어](/api/media/meme-uploads/x/a.png) [경로](/memes/abc)"],
  ["link anchor", "[위로](#top)"],
  ["link protocol relative", "[밖](//evil.example/x)"],
  ["link javascript", "[누르기](javascript:alert(1))"],
  ["link javascript upper", "[누르기](JaVaScRiPt:alert(1))"],
  ["link javascript entity", "[누르기](javascript&#58;alert(1))"],
  ["link javascript spaces", "[누르기]( javascript:alert(1) )"],
  ["link data", "[누르기](data:text/html;base64,PHNjcmlwdD4=)"],
  ["link vbscript", "[누르기](vbscript:msgbox)"],
  ["link mailto", "[메일](mailto:a@example.com)"],
  ["link tel", "[전화](tel:010)"],
  ["link ftp", "[파일](ftp://example.com)"],
  ["link empty href", "[빈 링크]()"],
  ["link empty text", "[](https://example.com)"],
  ["link angle", "[링크](<https://example.com/a b>)"],
  ["link encoded", "[링크](https://example.com/한글?q=a b)"],
  ["link nested formatting", "[**굵은** `코드` 링크](https://example.com)"],
  ["link with image", "[![그림](/api/media/meme-uploads/x/a.png)](https://example.com)"],
  ["reference link", "[참조][r]\n\n[r]: https://example.com/ref"],
  ["reference link collapsed", "[r][]\n\n[r]: https://example.com/ref \"제목\""],
  ["reference javascript", "[참조][r]\n\n[r]: javascript:alert(1)"],
  ["missing reference", "[없는 참조][nope]"],
  ["autolink", "<https://example.com/auto>"],
  ["autolink mailto", "<mailto:a@example.com>"],
  ["autolink email", "<a@example.com>"],
  ["autolink javascript", "<javascript:alert(1)>"],
  ["bare url", "https://example.com/bare 와 http://example.com."],
  ["bare url punctuation", "(https://example.com/a) https://example.com/b, https://example.com/c?"],
  ["www url", "www.example.com 그리고 www.example.com/path"],
  ["bare email", "메일 a@example.com 으로"],
  ["video link local", "[동영상](/api/media/meme-uploads/x/v.mp4)"],
  ["video link local webm query", "[동영상](/api/media/meme-uploads/x/v.webm?t=1#a)"],
  ["video link external", "[동영상](https://example.com/v.mp4)"],
  ["video link traversal", "[동영상](/api/media/meme-uploads/../v.mp4)"],
  ["video link other route", "[동영상](/api/other/v.mp4)"],
  ["bare video url", "https://example.com/v.mp4"],
  ["image local", "![사진](/api/media/meme-uploads/x/a.png)"],
  ["image thumbs and card art", "![썸](/api/media/meme-thumbs/x/a.webp) ![카드](/api/media/meme-card-art/a.png)"],
  ["image local query", "![사진](/api/media/meme-uploads/x/a.png?w=1)"],
  ["image local video", "![영상](/api/media/meme-uploads/x/v.mp4)"],
  ["image external", "![밖 사진](https://example.com/a.png)"],
  ["image external no alt", "![](https://example.com/a.png)"],
  ["image empty alt local", "![](/api/media/meme-uploads/x/a.png)"],
  ["image data", "![데이터](data:image/png;base64,AAAA)"],
  ["image javascript", "![js](javascript:alert(1))"],
  ["image traversal", "![사진](/api/media/meme-uploads/x/../../secret.png)"],
  ["image dot segment", "![사진](/api/media/meme-uploads/./a.png)"],
  ["image bad chars", "![사진](/api/media/meme-uploads/x/a%20b.png)"],
  ["image formatted alt", "![**굵은** 대체 `글`](/api/media/meme-uploads/x/a.png)"],
  ["image title", "![사진](/api/media/meme-uploads/x/a.png \"제목\")"],
  ["image in text", "앞 ![사진](/api/media/meme-uploads/x/a.png) 뒤"],
  ["reference image", "![그림][i]\n\n[i]: /api/media/meme-uploads/x/a.png"],
  ["raw inline html", "글 <b>굵게</b> 글"],
  ["raw script", "<script>alert(1)</script>"],
  ["raw script inline", "앞 <script>alert(1)</script> 뒤"],
  ["raw img onerror", "<img src=x onerror=alert(1)>"],
  ["raw iframe", "<iframe src=\"https://evil.example\"></iframe>"],
  ["raw html block", "<div>\n블록 *안*\n</div>\n\n뒤 문단"],
  ["raw html comment", "앞 <!-- 주석 --> 뒤\n\n<!-- 블록 주석 -->"],
  ["raw style", "<style>body{display:none}</style>"],
  ["raw a javascript", "<a href=\"javascript:alert(1)\">x</a>"],
  ["raw processing", "<?php echo 1; ?>"],
  ["raw cdata", "<![CDATA[ x ]]>"],
  ["raw declaration", "<!DOCTYPE html>"],
  ["raw closing", "</div>"],
  ["entities", "&amp; &lt; &gt; &quot; &#39; &#x27; &copy; &nbsp;끝 &hellip;"],
  ["invalid entities", "&nope; &#xZZ; & 그냥 &#0; &#1114112;"],
  ["special characters", "<a> & \"따옴표\" '작은따옴표' > 끝"],
  ["backslash escapes", "\\*별\\* \\_밑줄\\_ \\# \\[괄호\\] \\\\ \\`"],
  ["nul character", "앞\u0000뒤"],
  ["zero width and emoji", "가​나 😂🔥 👨‍👩‍👧"],
  ["unicode spaces", "가　나 다"],
  ["table", "| 가 | 나 |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |"],
  ["table alignment", "| 왼 | 가운데 | 오른 |\n| :-- | :-: | --: |\n| a | b | c |"],
  ["table inline", "| **굵게** | `코드` |\n| --- | --- |\n| [링크](https://example.com) | ~~취소~~ |"],
  ["table escaped pipe", "| a \\| b | c |\n| --- | --- |\n| `x \\| y` | z |"],
  ["table no body", "| 가 | 나 |\n| --- | --- |"],
  ["table uneven", "| 가 | 나 |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |"],
  ["table no outer pipes", "가 | 나\n--- | ---\n1 | 2"],
  ["table then text", "| 가 |\n| --- |\n| 1 |\n\n뒤"],
  ["not a table", "| 가 | 나 |\n| 1 | 2 |"],
  ["footnote", "본문[^1]\n\n[^1]: 각주"],
  ["footnote named", "본문[^note]\n\n[^note]: 이름 있는 각주"],
  ["footnote twice", "하나[^a] 둘[^a]\n\n[^a]: 같은 각주"],
  ["footnote order", "먼저[^b] 다음[^a]\n\n[^a]: 에이\n[^b]: 비"],
  ["footnote unreferenced", "본문\n\n[^x]: 안 쓰인 각주"],
  ["footnote missing", "본문[^nope]"],
  ["footnote multi paragraph", "본문[^1]\n\n[^1]: 첫 문단\n\n    둘째 문단"],
  ["mixed document", "# 밈 추천\n\n**굵게** 쓴 문장과 `코드`.\n\n![사진](/api/media/meme-uploads/x/a.png)\n[링크](https://example.com/a) 와 https://example.com/bare\n\n```js\nconst a = 1;\n```\n\n- [x] 끝\n\n> 인용"],
  ["post seed", "**굵게** 쓴 문장과 `코드`.\n\n![사진](/api/media/meme-uploads/x/a.png)\n[링크](https://example.com/a) 와 https://example.com/bare\n\n```js\nconst a = 1;\n```"],
  ["deep blockquote", `${"> ".repeat(60)}깊은 인용`],
  ["deep list", Array.from({ length: 40 }, (_, i) => `${"  ".repeat(i)}- ${i}`).join("\n")],
  ["many emphasis", "*a **b *c **d *e **f** e* d** c* b** a*"],
  ["brackets", "[[[[[[[[[[링크]]]]]]]]]]"],
  ["brackets link", "[a [b [c](https://example.com/c) b] a](https://example.com/a)"],
  ["unbalanced brackets", "[[[[ ]]]] ((( ))) ![[ ]]("],
  ["asterisk runs", "**** ***** ******"],
  ["underscore runs", "____ _____ ______"],
  ["link in heading", "## [제목 링크](https://example.com)"],
  ["html in table", "| <b>x</b> | <script>y</script> |\n| --- | --- |\n| 1 | 2 |"],
  ["html in link text", "[<b>굵게</b>](https://example.com)"],
  ["image alt html", "![<b>alt</b>](/api/media/meme-uploads/x/a.png)"],
  ["url with quotes", "[링크](https://example.com/\"onmouseover=\"x)"],
  ["url with angle", "[링크](https://example.com/<x>)"],
  ["url with spaces encoded", "[링크](https://example.com/a%20b)"],
  ["url unicode", "[링크](https://example.com/밈)"],
  ["autolink unicode", "https://example.com/밈?q=가"],
  ["www trailing", "www.example.com. www.example.com) www.example.com!"],
];

CASES.push(
  ["empty blockquote", ">"],
  ["empty list item", "-"],
  ["empty task", "- [ ]"],
  ["empty task checked", "- [x] "],
  ["footnote korean label", "본문[^각주 하나]\n\n[^각주 하나]: 한글 이름"],
  ["footnote code tail", "본문[^c]\n\n[^c]:\n    코드"],
  ["definitions only", "[a]: https://example.com\n[b]: /x"],
  ["inline br tag", "줄<br>바꿈 <br/> 끝"],
  ["cjk emphasis", "**한국어(괄호)**뒤 *기울임。*끝 __밑줄__글"],
  ["html block types", "<!-- c -->\n\n<?x?>\n\n<!X>\n\n<![CDATA[y]]>\n\n<pre>\n*a*\n</pre>\n\n<custom-tag>\n*b*"],
  ["list interrupts paragraph", "문단\n- 목록\n1. 번호"],
  ["ordered list interrupt", "문단\n2. 둘"],
  ["link reference case", "[Foo][BAR]\n\n[bar]: https://example.com/bar"],
  ["autolink trailing", "<https://example.com/a>> <https://ex ample.com>"],
  ["image in link reference", "[![a][i]][l]\n\n[i]: /api/media/meme-uploads/a.png\n[l]: https://example.com"],
  ["strikethrough in emphasis", "*~~둘 다~~* ~~*안쪽*~~"],
  ["tab list", "-\t탭 목록\n1.\t탭 번호"],
  ["heading with trailing spaces", "# 제목   \n## 끝 #   "],
  ["setext lazy", "> 인용\n===="],
  ["mixed line endings", "가\r\n나\r다\n라"],
);

// Random documents: fragments of every kind, joined by line endings, from a
// fixed seed so the fixture is stable.
const FRAGMENTS = [
  "글", "밈 이야기", "**굵게**", "*기울임*", "_밑줄_", "~~취소~~", "`코드`", "***둘***",
  "[링크](https://example.com/x)", "[로컬](/memes/a)", "[js](javascript:x)", "[빈]()",
  "![사진](/api/media/meme-uploads/a.png)", "![밖](https://example.com/a.png)", "![영상](/api/media/meme-uploads/v.mp4)",
  "[영상](/api/media/meme-thumbs/v.webm)", "https://example.com/bare", "www.example.com", "a@example.com",
  "<b>태그</b>", "<script>x</script>", "&amp;", "&copy;", "&#x27;", "\\*", "\\_",
  "# 제목", "## 소제목", "###### 작은", "> 인용", ">> 깊은 인용", "- 목록", "* 별", "1. 번호", "  - 들여쓴",
  "- [ ] 할 일", "- [x] 한 일", "```js", "```", "~~~", "    코드 줄", "---", "***", "| a | b |", "| --- | --- |",
  "| 1 | 2 |", "[^1]", "[^1]: 각주", "[r]: https://example.com/r", "[참조][r]", "", "", " ", "  ", "\t",
  "😂", "가\u200b나", "\"따옴표\"", "'홑'", "<", ">", "&", "*", "_", "**", "__", "~", "`", "[", "]", "(", ")", "!",
];
let seed = 20261124;
const nextRandom = (bound) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % bound;
};
for (let n = 0; n < 400; n += 1) {
  const parts = Array.from({ length: 1 + nextRandom(10) }, () => FRAGMENTS[nextRandom(FRAGMENTS.length)]);
  const joiners = ["\n", "\n\n", " ", ""];
  const body = parts.reduce((text, part, index) => (index === 0 ? part : text + joiners[nextRandom(joiners.length)] + part), "");
  CASES.push([`random ${n}`, body]);
}

// Bodies too large to keep: `unit` repeated `times`, between `prefix` and `suffix`.
const GENERATED = [
  ["huge paragraph", { prefix: "", unit: "가나다 ", times: 2000, suffix: "" }],
  ["huge lines", { prefix: "", unit: "줄\n", times: 2000, suffix: "" }],
  ["huge blockquote nesting", { prefix: "", unit: ">", times: 5000, suffix: " 끝" }],
  ["huge list nesting", { prefix: "", unit: "- ", times: 2500, suffix: "끝" }],
  ["huge emphasis openers", { prefix: "", unit: "*a ", times: 1700, suffix: "" }],
  ["huge emphasis pairs", { prefix: "", unit: "**a** ", times: 830, suffix: "" }],
  ["huge brackets", { prefix: "", unit: "[", times: 5000, suffix: "" }],
  ["huge link openers", { prefix: "", unit: "[a](", times: 1250, suffix: "" }],
  ["huge backticks", { prefix: "", unit: "`", times: 5000, suffix: "" }],
  ["huge table", { prefix: "| a | b |\n| --- | --- |\n", unit: "| 1 | 2 |\n", times: 500, suffix: "" }],
  ["huge html", { prefix: "", unit: "<b>", times: 1600, suffix: "" }],
  ["huge entities", { prefix: "", unit: "&amp;", times: 1000, suffix: "" }],
  ["huge urls", { prefix: "", unit: "https://example.com/a ", times: 220, suffix: "" }],
];

const build = ({ prefix, unit, times, suffix }) => prefix + unit.repeat(times) + suffix;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// A body the renderer cannot take (its recursion overflows the stack) is
// kept with the error's name: Next's page shows its error page for it.
const attempt = (body) => {
  try {
    return { html: render(body) };
  } catch (error) {
    return { throws: error.name };
  }
};
const cases = CASES.map(([name, body]) => ({ name, body, ...attempt(body) }));
const generated = GENERATED.map(([name, spec]) => {
  const { html, throws } = attempt(build(spec));
  return html === undefined ? { name, ...spec, throws } : { name, ...spec, bytes: Buffer.byteLength(html), sha256: sha256(html) };
});
process.stdout.write(`${JSON.stringify({ cases, generated }, null, 1)}\n`);
