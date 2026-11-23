#!/usr/bin/env node
// Inventory of what the page layer and auth are made of, read from the code.
//
//   node docs/axum-migration/inventory/inventory.mjs
//
// Writes, next to this file: pages.md, client-components.md, third-party.md,
// server-dependencies.md, auth.md and inventory.json (everything, for tools).
// Rerun it after the app changes; UI-PLAN.md quotes its numbers.
//
// How it reads the code: imports are followed with regular expressions, not
// a TypeScript compiler. A file is a client component when its first
// statement is "use client", an action file when it is "use server". Test
// files are left out. Two inputs are optional:
//   .next/prerender-manifest.json   what `next build` made of each page
//                                   (static, ISR with its period, on demand)
//   TEST_DB_CONTAINER=<name>        a scripts/test-db.sh container that a
//                                   Next has run against, for the columns of
//                                   the better-auth tables (they are created
//                                   by better-auth at run time, not by db/migrations)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const SOURCE_DIRS = ["app", "components", "lib"];
const SOURCE_FILES = ["proxy.ts"];
const isTest = (file) => /\.(test|spec)\.[tj]sx?$|\/__tests__\/|\.render\.test\./.test(file);

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !isTest(path)) out.push(path);
  }
  return out;
}

const files = [...SOURCE_DIRS.flatMap((dir) => walk(dir)), ...SOURCE_FILES].sort();
const source = new Map(files.map((file) => [file, readFileSync(join(root, file), "utf8")]));
const lines = (file) => source.get(file).split("\n").length;

function directive(text) {
  const first = text.replace(/^(\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*/, "").slice(0, 14);
  return /^["']use client["']/.test(first) ? "client" : /^["']use server["']/.test(first) ? "server" : null;
}

function resolveLocal(from, specifier) {
  const base = specifier.startsWith("@/") ? specifier.slice(2) : join(dirname(from), specifier);
  const clean = base.replace(/\\/g, "/").replace(/^\.\//, "");
  for (const candidate of [clean, `${clean}.ts`, `${clean}.tsx`, `${clean}/index.ts`, `${clean}/index.tsx`]) {
    if (source.has(candidate)) return candidate;
  }
  return null;
}

const packageOf = (specifier) => (specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const modules = new Map();
for (const [file, text] of source) {
  const local = new Set();
  const packages = new Set();
  const specifiers = new Set();
  for (const match of text.matchAll(IMPORT)) {
    const specifier = match[1] ?? match[2];
    if (/^import\s+type\s/.test(match[0]) || /\.css$/.test(specifier)) continue;
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const target = resolveLocal(file, specifier);
      if (target) local.add(target);
    } else {
      packages.add(packageOf(specifier));
      specifiers.add(specifier);
    }
  }
  modules.set(file, {
    kind: directive(text),
    local: [...local],
    packages: [...packages],
    specifiers: [...specifiers],
    tables: [...text.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]/g)].map((match) => match[1]),
    rpcs: [...text.matchAll(/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/g)].map((match) => match[1]),
  });
}

/** Files reachable from `start`. `enter(file)` false stops at that file (it is still listed). */
function reach(start, enter = () => true) {
  const seen = new Set();
  const queue = [...start];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file !== start[0] && !enter(file)) continue;
    queue.push(...modules.get(file).local);
  }
  return seen;
}

const unique = (list) => [...new Set(list)].sort();
const cell = (list, limit = 6) => (list.length === 0 ? "" : list.length <= limit ? list.join(", ") : `${list.slice(0, limit).join(", ")} 외 ${list.length - limit}`);
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`)].join("\n");
const write = (name, text) => writeFileSync(join(here, name), `${text.trimEnd()}\n`);
const stamp = "<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->";

// ---------------------------------------------------------------- pages

const routeOf = (file) =>
  `/${file.replace(/^app\//, "").replace(/(^|\/)page\.tsx$/, "").split("/").filter((part) => part && !/^\(.*\)$/.test(part)).join("/")}`;

function layoutChain(file) {
  const parts = dirname(file).split("/");
  const chain = { layouts: [], loading: [] };
  for (let depth = 1; depth <= parts.length; depth += 1) {
    const dir = parts.slice(0, depth).join("/");
    for (const name of ["layout.tsx", "template.tsx"]) if (source.has(`${dir}/${name}`)) chain.layouts.push(`${dir}/${name}`);
    if (source.has(`${dir}/loading.tsx`)) chain.loading.push(`${dir}/loading.tsx`);
  }
  return chain;
}

const prerender = existsSync(join(root, ".next/prerender-manifest.json"))
  ? JSON.parse(readFileSync(join(root, ".next/prerender-manifest.json"), "utf8"))
  : null;

function declaredMode(text) {
  const dynamic = text.match(/export const dynamic\s*=\s*["']([a-z-]+)["']/)?.[1];
  const revalidate = text.match(/export const revalidate\s*=\s*([^;\n]+)/)?.[1]?.trim();
  return [dynamic && `dynamic=${dynamic}`, revalidate && `revalidate=${revalidate}`, /generateStaticParams/.test(text) && "generateStaticParams"].filter(Boolean).join(", ");
}

function builtMode(route) {
  if (!prerender) return "빌드 없음";
  const entry = prerender.routes[route];
  if (entry) return entry.initialRevalidateSeconds ? `ISR ${entry.initialRevalidateSeconds}s` : "정적";
  if (prerender.dynamicRoutes[route]) return "정적 생성(경로별)";
  const generated = Object.values(prerender.routes).filter((value) => value.srcRoute === route);
  if (generated.length) return `정적 생성 ${generated.length}개`;
  return "요청 시 렌더";
}

// `User-Agent: *` rules of the robots.txt the server tests pin down.
const disallow = readFileSync(join(root, "server/tests/fixtures/robots.txt"), "utf8")
  .split("\n\n")[0]
  .split("\n")
  .filter((line) => line.startsWith("Disallow: "))
  .map((line) => line.slice("Disallow: ".length));
const isClient = (file) => modules.get(file).kind === "client";
const isAction = (file) => modules.get(file).kind === "server";
// What ends up in the browser from a client component: its imports, but not
// the body of an action file. The bundler replaces that with a call stub.
const browserReach = (client) => reach([client], (file) => !isAction(file));
const inBrowser = (file) => !isAction(file);
// What a browser bundle gets from these needs no replacement of its own.
const FRAMEWORK = new Set(["react", "react-dom", "next", "server-only", "client-only"]);

const pages = files
  .filter((file) => /^app\/.*page\.tsx$/.test(file) || file === "app/page.tsx")
  .map((file) => {
    const text = source.get(file);
    const route = routeOf(file);
    const chain = layoutChain(file);
    const entry = [file, ...chain.layouts];
    // Server side: everything the page and its layouts import, not entering client components.
    const server = unique(entry.flatMap((start) => [...reach([start], (candidate) => !isClient(candidate))]));
    const clients = server.filter(isClient);
    const pageOnly = [...reach([file], (candidate) => !isClient(candidate))];
    const pageClients = pageOnly.filter(isClient);
    const browser = unique(clients.flatMap((client) => [...browserReach(client)]));
    const everything = unique([...server, ...browser]);
    const robotsBlocked = disallow.some((rule) => route === rule || route.startsWith(rule.endsWith("/") ? rule : `${rule}/`));
    // A fixed `metadata` object that says noindex, as opposed to a
    // generateMetadata that decides per document.
    const staticMetadata = text.match(/export const metadata[\s\S]*?\n\};/)?.[0] ?? "";
    const noindexInSource = /index:\s*false/.test(staticMetadata);
    const conditionalRobots = /robots/i.test(text) && /generateMetadata/.test(text);
    const serverFiles = server.filter((candidate) => !isClient(candidate));
    return {
      file,
      route,
      layouts: chain.layouts,
      loading: chain.loading,
      declared: unique([declaredMode(text), ...chain.layouts.map((layout) => declaredMode(source.get(layout)))].filter(Boolean)).join("; "),
      built: builtMode(route),
      metadata: /generateMetadata/.test(text) ? "generateMetadata" : /export const metadata/.test(text) ? "metadata" : "레이아웃 값",
      jsonLd: unique([...text.matchAll(/\b([A-Z][A-Za-z]*JsonLd)\b/g)].map((match) => match[1])),
      hreflang: /languages\s*[:,}]|hreflang|getHreflang/i.test(text),
      serverModules: serverFiles.filter((candidate) => /\.server\.ts$/.test(candidate)),
      tables: unique(serverFiles.flatMap((candidate) => modules.get(candidate).tables)),
      rpcs: unique(serverFiles.flatMap((candidate) => modules.get(candidate).rpcs)),
      clientComponents: pageClients,
      layoutClientComponents: clients.filter((client) => !pageClients.includes(client)),
      browserPackages: unique(browser.filter(inBrowser).flatMap((candidate) => modules.get(candidate).packages).filter((name) => !FRAMEWORK.has(name))),
      actions: everything.filter(isAction),
      // Everything this page pulls in, for sizing a batch (see batches.md).
      reachFromPage: unique([...pageOnly, ...pageClients.flatMap((client) => [...browserReach(client)])]),
      reachFromLayouts: unique(chain.layouts.flatMap((layout) => [...reach([layout], (candidate) => !isClient(candidate))]).flatMap((candidate) => (isClient(candidate) ? [...browserReach(candidate)] : [candidate]))),
      indexable: robotsBlocked ? "아니오 (robots.txt)" : noindexInSource ? "아니오 (noindex)" : conditionalRobots ? "문서별 판정" : "예",
      lines: lines(file),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const short = (file) => file.replace(/^(components|lib|app)\//, (prefix) => (prefix === "components/" ? "" : prefix)).replace(/\.tsx?$/, "");
write(
  "pages.md",
  [
    stamp,
    "# 페이지",
    "",
    `\`app/**/page.tsx\` ${pages.length}개. 렌더링 열은 \`next build\`가 만든 결과(\`.next/prerender-manifest.json\`)이고, 선언 열은 소스의 \`dynamic\`·\`revalidate\`다. 클라이언트 컴포넌트는 페이지가 직접 얹는 것만 센다(레이아웃이 얹는 ${unique(pages.flatMap((page) => page.layoutClientComponents)).length}개는 client-components.md의 "레이아웃" 표시).`,
    "",
    table(
      ["경로", "레이아웃", "렌더링", "선언", "메타데이터", "JSON-LD", "hreflang", "서버 모듈", "테이블·RPC", "클라이언트 컴포넌트", "서버 액션", "색인"],
      pages.map((page) => [
        `\`${page.route}\``,
        cell(page.layouts.map((layout) => layout.replace(/^app\//, "").replace(/\/?(layout|template)\.tsx$/, (_, kind) => (kind === "template" ? " (template)" : "")) || "(root)"), 3),
        page.built + (page.loading.length ? " + loading" : ""),
        page.declared,
        page.metadata,
        cell(page.jsonLd.map((name) => name.replace(/JsonLd$/, "")), 3),
        page.hreflang ? "있음" : "",
        cell(page.serverModules.map(short), 3),
        `${page.tables.length}·${page.rpcs.length}`,
        `${page.clientComponents.length}${page.clientComponents.length ? `: ${cell(page.clientComponents.map(short), 3)}` : ""}`,
        cell(page.actions.map(short), 2),
        page.indexable,
      ]),
    ),
  ].join("\n"),
);

// ---------------------------------------------------- client components

const HOOKS = ["useState", "useEffect", "useLayoutEffect", "useRef", "useReducer", "useContext", "useSyncExternalStore", "useTransition", "useOptimistic", "useActionState", "useFormStatus", "useRouter", "usePathname", "useSearchParams"];
const BROWSER_APIS = ["window", "document", "navigator", "localStorage", "sessionStorage", "IntersectionObserver", "ResizeObserver", "matchMedia", "requestAnimationFrame", "fetch", "FormData", "history", "location"];
const used = (text, names) => names.filter((name) => new RegExp(`\\b${name}\\b`).test(text));

const pagesUsing = new Map();
for (const page of pages) {
  const direct = new Set([...page.clientComponents, ...page.layoutClientComponents]);
  for (const client of direct) {
    for (const file of browserReach(client)) {
      if (!isClient(file)) continue;
      const entry = pagesUsing.get(file) ?? { pages: new Set(), viaLayout: false };
      if (page.clientComponents.includes(client)) entry.pages.add(page.route);
      else entry.viaLayout = true;
      pagesUsing.set(file, entry);
    }
  }
}

const clientComponents = files
  .filter((file) => isClient(file))
  .map((file) => {
    const text = source.get(file);
    const usage = pagesUsing.get(file) ?? { pages: new Set(), viaLayout: false };
    return {
      file,
      lines: lines(file),
      hooks: used(text, HOOKS),
      browserApis: used(text, BROWSER_APIS),
      handlers: (text.match(/\bon[A-Z][A-Za-z]+=\{/g) ?? []).length,
      packages: modules.get(file).packages.filter((name) => !FRAMEWORK.has(name)),
      nextModules: modules.get(file).specifiers.filter((name) => name.startsWith("next/")),
      pages: [...usage.pages].sort(),
      viaLayout: usage.viaLayout,
    };
  });

write(
  "client-components.md",
  [
    stamp,
    "# 클라이언트 컴포넌트",
    "",
    `\`"use client"\` 파일 ${clientComponents.length}개, ${clientComponents.reduce((sum, item) => sum + item.lines, 0).toLocaleString("en")}줄. "이유" 열은 그 파일이 쓰는 훅·브라우저 API·이벤트 핸들러 수·서드파티 패키지다. "쓰는 페이지"가 "없음"인 파일 가운데 \`error.tsx\`·\`loading.tsx\`·\`global-error.tsx\`는 Next가 import 없이 쓰는 경계이고, 나머지는 어떤 페이지에서도 닿지 않는다.`,
    "",
    table(
      ["파일", "줄", "훅", "브라우저 API", "핸들러", "패키지", "쓰는 페이지"],
      clientComponents.map((item) => [
        `\`${item.file}\``,
        item.lines,
        cell(item.hooks, 5),
        cell(item.browserApis, 5),
        item.handlers || "",
        cell([...item.packages, ...item.nextModules], 4),
        `${item.viaLayout ? "레이아웃(전 페이지)" : ""}${item.viaLayout && item.pages.length ? " + " : ""}${item.pages.length ? `${item.pages.length}: ${cell(item.pages.map((route) => `\`${route}\``), 3)}` : item.viaLayout ? "" : "없음"}`,
      ]),
    ),
  ].join("\n"),
);

// ------------------------------------------------------- third party

const browserFiles = unique(clientComponents.flatMap((item) => [...browserReach(item.file)])).filter(inBrowser);
const byPackage = new Map();
for (const file of browserFiles) {
  for (const specifier of modules.get(file).specifiers) {
    const name = specifier.startsWith("next/") ? specifier : packageOf(specifier);
    if (FRAMEWORK.has(name)) continue;
    byPackage.set(name, [...(byPackage.get(name) ?? []), file]);
  }
}
const pagesWithPackage = (name) => pages.filter((page) => page.browserPackages.includes(name.startsWith("next/") ? "next" : name) || (name.startsWith("next/") && page.browserPackages.includes(name))).length;
const serverOnlyUse = (pattern) => files.filter((file) => pattern.test(source.get(file)));

write(
  "third-party.md",
  [
    stamp,
    "# 브라우저에서 도는 서드파티 코드",
    "",
    "클라이언트 컴포넌트에서 닿는 모든 파일이 import하는 패키지와 Next 모듈. \"Rust 페이지에서\" 열은 UI-PLAN.md가 채운다(판단이라 스크립트가 만들지 않는다).",
    "",
    table(
      ["패키지", "import하는 파일 수", "파일", "닿는 페이지 수"],
      [...byPackage.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([name, importers]) => [`\`${name}\``, unique(importers).length, cell(unique(importers).map(short), 5), name.startsWith("next/") ? "" : pagesWithPackage(name)]),
    ),
    "",
    "## 스크립트 태그와 서비스 워커",
    "",
    table(
      ["무엇", "파일"],
      [
        ["Google Analytics (`@next/third-parties/google`)", cell(serverOnlyUse(/@next\/third-parties/).map(short), 6)],
        ["AdSense 로더 (`pagead2.googlesyndication.com`)", cell(serverOnlyUse(/pagead2\.googlesyndication\.com/).map(short), 6)],
        ["`next/script`", cell(serverOnlyUse(/from ["']next\/script["']/).map(short), 6)],
        ["서비스 워커 (Serwist)", cell(serverOnlyUse(/from ["'](@serwist\/[a-z-]+|serwist)["']/).map(short), 6)],
        ["외부 임베드 iframe (YouTube·TikTok·Instagram)", cell(serverOnlyUse(/youtube-nocookie\.com|tiktok\.com\/embed|instagram\.com\/[^"'`]*embed/).map(short), 8)],
      ],
    ),
  ].join("\n"),
);

// ------------------------------------------------- server dependencies

const count = (pattern) => files.reduce((sum, file) => sum + (source.get(file).match(pattern) ?? []).length, 0);
// A planner call names its table in a string. `Array.from(` and `Buffer.from(` do not.
const TABLE_READ = /\.from\(\s*["'`]/g;
const callSites = files
  .map((file) => ({ file, from: (source.get(file).match(TABLE_READ) ?? []).length, rpc: (source.get(file).match(/\.rpc\(/g) ?? []).length }))
  .filter((item) => item.from + item.rpc > 0)
  .sort((a, b) => b.from + b.rpc - (a.from + a.rpc));
const cacheFunctions = ["unstable_cache", "revalidateTag", "revalidatePath", "updateTag", "cacheTag", "cacheLife", "unstable_noStore", "connection"];
const cacheUse = cacheFunctions.map((name) => {
  const importers = files.filter((file) => new RegExp(`from ["']next/(cache|server)["']`).test(source.get(file)) && new RegExp(`\\b${name}\\(`).test(source.get(file)));
  return [`\`${name}\``, importers.length, importers.reduce((sum, file) => sum + (source.get(file).match(new RegExp(`\\b${name}\\(`, "g")) ?? []).length, 0), cell(importers.map(short), 5)];
});
const routeHandlers = files.filter((file) => /^app\/.*route\.tsx?$/.test(file));
const actionFiles = files.filter(isAction);
const isrFiles = files.filter((file) => /export const revalidate\s*=/.test(source.get(file)));
const cacheTags = source.has("lib/db/cache-tags.ts") ? [...source.get("lib/db/cache-tags.ts").matchAll(/export const ([A-Z_]+)\s*=\s*["']([^"']+)["']/g)].map((match) => `\`${match[1]}\` = \`${match[2]}\``) : [];
const i18nFiles = files.filter((file) => /^lib\/i18n[^/]*\.tsx?$/.test(file));

write(
  "server-dependencies.md",
  [
    stamp,
    "# 페이지가 기대는 서버 전용 부품",
    "",
    "Rust 쪽에 아직 대응물이 없는 것들. 숫자는 테스트 파일을 뺀 `app`·`components`·`lib`·`proxy.ts` 기준이다.",
    "",
    "## 쿼리 플래너 (`lib/db/plan.ts`, `lib/db/execute.ts`)",
    "",
    `\`.from("테이블")\` ${count(TABLE_READ)}곳, \`.rpc(\` ${count(/\.rpc\(/g)}곳, 파일 ${callSites.length}개. 플래너 자체: \`lib/db/plan.ts\` ${source.has("lib/db/plan.ts") ? lines("lib/db/plan.ts") : 0}줄, \`lib/db/execute.ts\` ${source.has("lib/db/execute.ts") ? lines("lib/db/execute.ts") : 0}줄. 호출이 많은 파일:`,
    "",
    table(["파일", "`.from(\"…\")`", "`.rpc(`"], callSites.slice(0, 20).map((item) => [`\`${item.file}\``, item.from, item.rpc])),
    "",
    "## `next/cache`와 ISR",
    "",
    table(["함수", "파일 수", "호출 수", "파일"], cacheUse),
    "",
    `캐시 태그(\`lib/db/cache-tags.ts\`): ${cacheTags.join(", ") || "없음"}.`,
    "",
    `\`export const revalidate\`를 둔 파일 ${isrFiles.length}개: ${cell(isrFiles.map((file) => `\`${file}\``), 40)}.`,
    "",
    "## 그 밖",
    "",
    table(
      ["부품", "파일"],
      [
        ["`next/og` (Satori 이미지)", cell(serverOnlyUse(/from ["']next\/og["']/).map((file) => `\`${file}\``), 12)],
        ["`@huggingface/transformers` (임베딩)", cell(serverOnlyUse(/@huggingface\/transformers/).map((file) => `\`${file}\``), 12)],
        ["i18n", cell(i18nFiles.map((file) => `\`${file}\` ${lines(file)}줄`), 12)],
        [`라우트 핸들러 ${routeHandlers.length}개`, cell(unique(routeHandlers.map((file) => file.split("/").slice(1, 3).join("/"))), 30)],
        [
          `서버 액션 파일 ${actionFiles.length}개 (\`"use server"\`로 시작하는 파일), 함수 ${actionFiles.reduce((sum, file) => sum + (source.get(file).match(/^export async function /gm) ?? []).length, 0)}개`,
          cell(actionFiles.map((file) => `\`${file}\``), 40),
        ],
      ],
    ),
  ].join("\n"),
);

// ------------------------------------------------------------- auth

const authFiles = files.filter((file) => /^(lib\/auth\/|app\/api\/auth\/|app\/auth\/|components\/auth-)/.test(file) || file === "lib/db/client.ts");
const authText = authFiles.map((file) => source.get(file)).join("\n");
const allText = [...source.values()].join("\n");
const config = source.get("lib/auth/server.ts") ?? "";
const feature = (label, pattern, text = config) => [label, pattern.test(text) ? "사용" : "없음"];
let columns = [["(열 목록 없음)", "`TEST_DB_CONTAINER=<컨테이너>`를 주고 다시 실행"]];
if (process.env.TEST_DB_CONTAINER) {
  const sql = `select table_name || '|' || string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name in ('user', 'session', 'account', 'verification') group by table_name order by table_name`;
  const out = execFileSync("docker", ["exec", process.env.TEST_DB_CONTAINER, "psql", "-U", "postgres", "-d", "memecatch", "-Atc", sql], { encoding: "utf8" });
  columns = out.trim().split("\n").map((line) => line.split("|")).map(([name, list]) => [`\`${name}\``, list]);
}

write(
  "auth.md",
  [
    stamp,
    "# 인증 (better-auth)",
    "",
    "## 파일",
    "",
    table(["파일", "줄"], authFiles.map((file) => [`\`${file}\``, lines(file)])),
    "",
    "## 쓰는 기능 (`lib/auth/server.ts`)",
    "",
    table(
      ["기능", "상태"],
      [
        feature("이메일·비밀번호 (`emailAndPassword`)", /emailAndPassword:\s*\{[\s\S]*?enabled:\s*true/),
        feature("가입 뒤 자동 로그인 끔 (`autoSignIn: false`)", /autoSignIn:\s*false/),
        feature("이메일 인증 필수 (`requireEmailVerification`)", /requireEmailVerification:\s*true/),
        ["비밀번호 최소 길이", config.match(/minPasswordLength:\s*(\d+)/)?.[1] ?? "기본값"],
        feature("비밀번호 검증 함수 교체 (`password.verify`)", /password:\s*\{\s*verify/),
        feature("비밀번호 재설정 메일 (`sendResetPassword`)", /sendResetPassword/),
        feature("가입 시 인증 메일 (`sendOnSignUp`)", /sendOnSignUp:\s*true/),
        feature("메일 발송 웹훅 (`AUTH_EMAIL_WEBHOOK`)", /AUTH_EMAIL_WEBHOOK/),
        feature("Google (`socialProviders.google`)", /google:\s*\{/),
        feature("Kakao (`genericOAuth`, providerId `kakao`)", /genericOAuth[\s\S]*providerId:\s*"kakao"/),
        feature("TikTok (자체 경로 `app/auth/tiktok` + 매직 링크)", /tiktok/i, authText),
        feature("`nextCookies` 플러그인", /nextCookies\(\)/),
        feature("UUID id (`advanced.database.generateId`)", /generateId:\s*"uuid"/),
        feature("운영에서 Secure 쿠키 (`useSecureCookies`)", /useSecureCookies/),
        feature("가입 전후 훅 (`databaseHooks.user.create`)", /databaseHooks/),
        feature("스키마를 실행 중에 만든다 (`getMigrations`)", /getMigrations/),
      ],
    ),
    "",
    "## 호출하는 엔드포인트와 서버 API",
    "",
    table(
      ["종류", "이름"],
      [
        ["브라우저가 부르는 `/api/auth/*`", cell(unique([...allText.matchAll(/\/api\/auth\/[a-z0-9-]+(?:\/[a-z0-9-]+)*/g)].map((match) => `\`${match[0]}\``)), 20)],
        ["서버가 부르는 `auth.api.*`", cell(unique([...allText.matchAll(/\.api\.([a-zA-Z]+)\(/g)].map((match) => `\`${match[1]}\``)), 20)],
        ["쿠키 이름이 나오는 곳", cell(unique([...allText.matchAll(/["'`]((?:__Secure-)?better-auth\.[a-z_.]+)["'`]/g)].map((match) => `\`${match[1]}\``)), 10) || "better-auth 기본값만 사용"],
        ["비밀번호 해시 형식 (`lib/auth/passwords.ts`)", cell(unique([...(source.get("lib/auth/passwords.ts") ?? "").matchAll(/startsWith\("([^"]+)"\)/g)].map((match) => `\`${match[1]}\` bcrypt`)).concat(["그 밖: better-auth scrypt (`salt:hash` 16진)"]), 8)],
      ],
    ),
    "",
    "## 테이블 (better-auth가 실행 중에 만든다)",
    "",
    table(["테이블", "열"], columns),
  ].join("\n"),
);

// ----------------------------------------------------------- batches

// The order of work UI-PLAN.md proposes. A page belongs to the first batch
// whose pattern matches its route; a file is counted in the first batch that
// needs it, so a later batch shows only what it adds.
const BATCHES = [
  ["B1 정적 문서", /^\/(about|contact|editorial|privacy|terms|guides(\/\[slug\])?|offline|retired-products|missing-public-meme)$/],
  ["B2 목록·탐색", /^\/(memes|explore|collections(\/\[slug\])?|timeline|slang|weekly|news|rankings|search|meme-cards|quiz(\/r\/\[token\])?|studio|global|originals(\/edition\/\[slug\])?)$/],
  ["B3 밈 문서 (한국어)", /^\/memes\/\[key\]$/],
  ["B4 홈", /^\/$/],
  ["B5 번역 문서", /^\/(\[locale\].*|locale-rankings\/\[locale\])$/],
  ["B6 로그인·계정·제보·커뮤니티", /^\/(login|forgot-password|reset-password|onboarding|my|submit|support|community.*)$/],
  ["B7 운영자", /^\/admin/],
];
const counted = new Set();
const isUi = (file) => file.startsWith("app/") || file.startsWith("components/");
function take(reached) {
  const fresh = unique(reached).filter((file) => !counted.has(file));
  for (const file of fresh) counted.add(file);
  const size = (list) => `${list.length}개 ${list.reduce((sum, file) => sum + lines(file), 0).toLocaleString("en")}줄`;
  const ui = fresh.filter((file) => isUi(file) && !isAction(file));
  return {
    ui: size(ui),
    clients: ui.filter(isClient).length,
    lib: size(fresh.filter((file) => file.startsWith("lib/") && !isAction(file))),
    actions: size(fresh.filter(isAction)),
  };
}
const batchRows = [];
const chrome = take(pages.flatMap((page) => page.reachFromLayouts));
batchRows.push(["B0 공통 틀 (레이아웃이 얹는 것)", "", chrome.ui, chrome.clients, chrome.lib, chrome.actions]);
const unassigned = [];
for (const [name, pattern] of BATCHES) {
  const members = pages.filter((page) => pattern.test(page.route) && !BATCHES.slice(0, BATCHES.findIndex(([other]) => other === name)).some(([, earlier]) => earlier.test(page.route)));
  const added = take(members.flatMap((page) => page.reachFromPage));
  batchRows.push([name, `${members.length}: ${cell(members.map((page) => `\`${page.route}\``), 30)}`, added.ui, added.clients, added.lib, added.actions]);
}
for (const page of pages) if (!BATCHES.some(([, pattern]) => pattern.test(page.route))) unassigned.push(page.route);
write(
  "batches.md",
  [
    stamp,
    "# 묶음별 크기",
    "",
    "UI-PLAN.md가 제안하는 작업 순서대로, 각 묶음이 **새로** 필요로 하는 파일. 앞 묶음에서 이미 센 파일은 다시 세지 않는다. UI 파일은 `app/`·`components/`의 서버·클라이언트 컴포넌트, lib은 그 페이지들이 닿는 `lib/` 모듈(서버 로직 포함)이다. 테스트 파일은 뺐다.",
    "",
    table(["묶음", "페이지", "UI 파일", "그중 클라이언트 컴포넌트", "lib 파일", "서버 액션 파일"], batchRows),
    "",
    unassigned.length ? `어느 묶음에도 들지 않은 페이지: ${unassigned.map((route) => `\`${route}\``).join(", ")}.` : "모든 페이지가 한 묶음에 든다.",
  ].join("\n"),
);
for (const page of pages) {
  delete page.reachFromPage;
  delete page.reachFromLayouts;
}

writeFileSync(join(here, "inventory.json"), `${JSON.stringify({ pages, clientComponents, packages: Object.fromEntries([...byPackage].map(([name, importers]) => [name, unique(importers)])), callSites, actionFiles, routeHandlers }, null, 1)}\n`);

const totals = {
  pages: pages.length,
  clientComponents: clientComponents.length,
  clientComponentLines: clientComponents.reduce((sum, item) => sum + item.lines, 0),
  componentLines: files.filter((file) => file.startsWith("components/")).reduce((sum, file) => sum + lines(file), 0),
  actionFiles: actionFiles.length,
  routeHandlers: routeHandlers.length,
  fromCalls: count(TABLE_READ),
  rpcCalls: count(/\.rpc\(/g),
  indexable: pages.filter((page) => page.indexable === "예" || page.indexable === "문서별 판정").length,
};
console.log(JSON.stringify(totals, null, 1));
console.log(`written to ${relative(root, here)}/`);
