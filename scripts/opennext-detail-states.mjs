import { request as httpRequest } from "node:http";

const base = process.env.OPENNEXT_BASE_URL ?? "http://127.0.0.1:8787";
const stub = process.env.STUB_CONTROL_URL ?? "http://127.0.0.1:8799";
const failures = [];

function request(path, headers = {}) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, {
      headers: {
        "sec-fetch-mode": "navigate",
        "accept-language": "ko",
        "accept-encoding": "identity",
        "user-agent": "Mozilla/5.0",
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          location: String(response.headers.location ?? ""),
          cache: String(response.headers["cache-control"] ?? ""),
          type: String(response.headers["content-type"] ?? ""),
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function expect(name, condition, detail) {
  if (condition) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(`${name}: ${detail}`);
  console.error(`fail ${name}: ${detail}`);
}

async function control(patch) {
  const response = await fetch(`${stub}/__control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`stub control failed (${response.status})`);
}

const home = await request("/", { "accept-language": "ko" });
expect("home", home.status === 200, `status ${home.status}`);

const explore = await request("/explore", { "accept-language": "ko" });
expect("explore", explore.status === 200, `status ${explore.status}`);

const locale = await request("/", { "accept-language": "en", "user-agent": "Mozilla/5.0" });
expect("locale redirect", locale.status === 302 && locale.location.endsWith("/en"), `${locale.status} ${locale.location}`);

const auth = await request("/my");
expect("auth gate", auth.status === 307 || auth.status === 302, `status ${auth.status}`);
expect("auth target", auth.location.includes("/login"), auth.location);

const canonical = await request("/memes/okmem001");
expect("canonical redirect", canonical.status === 308 && canonical.location.includes("/memes/okmem001-ok-meme"), `${canonical.status} ${canonical.location}`);

const success = await request("/memes/okmem001-ok-meme");
expect("detail success", success.status === 200 && success.body.includes("확인된 밈"), `status ${success.status}`);

const missing = await request("/memes/zzzzzzzz");
expect("detail miss", missing.status === 404, `status ${missing.status}`);

const outage = await request("/memes/fail0001");
expect(
  "detail outage",
  outage.status === 200 && outage.body.includes("이 밈을 잠시 불러오지 못했어요") && outage.status !== 500,
  `status ${outage.status}`,
);
expect("outage is not a stored success", !/s-maxage=86400|max-age=86400/.test(outage.cache), outage.cache || "(no cache-control)");

await control({ fail0001: "row" });
const outageAgain = await request("/memes/fail0001");
const outageDocument = await request("/memes/fail0001-fail0001-slug");
expect(
  "outage was not cached",
  outageAgain.status === 308 && outageDocument.status === 200 && outageDocument.body.includes("확인된 밈"),
  `again ${outageAgain.status} ${outageAgain.location}; document ${outageDocument.status}`,
);

await control({ zzzzzzzz: "row" });
const missDocument = await request("/memes/zzzzzzzz-zzzzzzzz-slug");
expect(
  "miss was not cached",
  missDocument.status === 200 && missDocument.body.includes("확인된 밈"),
  `status ${missDocument.status}`,
);

await control({ okmem001: "error" });
const successFollowUp = await request("/memes/okmem001-ok-meme");
expect(
  "success was not cached over an outage",
  successFollowUp.status === 200 && successFollowUp.body.includes("이 밈을 잠시 불러오지 못했어요"),
  `status ${successFollowUp.status}`,
);

const sitemap = await request("/sitemap.xml");
expect("sitemap", sitemap.status === 200 && sitemap.body.includes("<urlset"), `status ${sitemap.status}`);

const og = await request("/opengraph-image");
expect("og image", og.status === 200 && og.type.includes("image/"), `${og.status} ${og.type}`);

const cron = await request(`/__scheduled?cron=${encodeURIComponent("30 18 * * *")}`);
expect("scheduled cron", cron.status === 200 && cron.body.includes("Ran scheduled event"), `${cron.status} ${cron.body.slice(0, 80)}`);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("opennext detail states ok");
