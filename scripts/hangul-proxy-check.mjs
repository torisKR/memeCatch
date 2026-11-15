import http from "node:http";

const port = Number(process.argv[2]);
if (!port) {
  console.error("usage: hangul-proxy-check.mjs <proxy-port>");
  process.exit(1);
}
const hangul = "중꺾마";
const canonical = `/memes/rk3w632x-${encodeURIComponent(hangul)}`;
const lowercase = `/memes/rk3w632x-${encodeURIComponent(hangul).toLowerCase()}`;
const nfd = `/memes/rk3w632x-${encodeURIComponent(hangul.normalize("NFD"))}`;
const encodedHyphen = `/memes/rk3w632x%2D${encodeURIComponent(hangul)}`;

function get(path) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { accept: "text/html" },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function snippet(result) {
  return JSON.stringify({
    status: result.status,
    location: result.location,
    body: result.body.slice(0, 400),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameCanonical(location) {
  return location.endsWith(canonical) || location.endsWith(encodeURI(canonical));
}

async function waitForCanonical() {
  let last = null;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      last = await get(canonical);
      if (last.status === 200) return last;
    } catch {
      last = null;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`canonical Hangul page was not served: ${last ? snippet(last) : "no response"}`);
}

const page = await waitForCanonical();
assert(page.status === 200, `canonical status ${snippet(page)}`);
assert(!page.body.includes("NEXT_REDIRECT"), "canonical Hangul page contains NEXT_REDIRECT");
assert(page.body.includes(hangul), "canonical Hangul page is missing the title");

const shortId = await get("/memes/rk3w632x");
assert(shortId.status === 308, `short id status ${snippet(shortId)}`);
assert(sameCanonical(shortId.location), `short id location ${shortId.location}`);
const followedPath = shortId.location.startsWith("/")
  ? shortId.location
  : (shortId.location.match(/^https?:\/\/[^/]+(\/.*)$/)?.[1] ?? shortId.location);
const followed = await get(followedPath);
assert(followed.status === 200, `short id follow ${snippet(followed)}`);
assert(!followed.body.includes("NEXT_REDIRECT"), "short id follow still redirects");

const lower = await get(lowercase);
assert(lower.status === 308, `lowercase percent status ${snippet(lower)}`);
assert(sameCanonical(lower.location), `lowercase percent location ${lower.location}`);

const decomposed = await get(nfd);
assert(decomposed.status === 308, `NFD status ${snippet(decomposed)}`);
assert(sameCanonical(decomposed.location), `NFD location ${decomposed.location}`);

const hyphen = await get(encodedHyphen);
assert(hyphen.status === 308, `%2D status ${snippet(hyphen)}`);
assert(sameCanonical(hyphen.location), `%2D location ${hyphen.location}`);

console.log("hangul standalone proxy checks passed");
