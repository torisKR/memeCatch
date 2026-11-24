// A stand-in for Google's, Kakao's and TikTok's token and profile endpoints
// (and TikTok's video list), for the OAuth parity runs (auth-oauth.mjs,
// auth-tiktok.mjs) and probes. It keeps no state: the
// authorization `code` names what the token endpoint answers, and the
// access token it hands out names what Kakao's profile endpoint answers.
//
//   code = codeFor({ status, contentType, body })        token answer
//   body.access_token = tokenFor({ status, body })       Kakao profile answer
//   body.access_token = tokenFor({ user, videos })       TikTok: user info and
//                                                        video list answers
//
// `body` is sent as is when it is a string, as JSON otherwise. Every request
// is kept in `seen`, in order: method, path, headers that matter, form body.
// `POST /hook` is a mail webhook: its JSON bodies are kept in `mail`.
import { createServer } from "node:http";

const encode = (spec) => Buffer.from(JSON.stringify(spec)).toString("base64url");
const decode = (text) => {
  try {
    return JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

export const codeFor = (spec) => `code.${encode(spec)}`;
export const tokenFor = (spec) => `at.${encode(spec)}`;

/** An unsigned JWT with these claims, as Google's `id_token` is read (decoded, not verified). */
export const idToken = (claims) => `${encode({ alg: "RS256", kid: "stub", typ: "JWT" })}.${encode(claims)}.c2lnbmF0dXJl`;

function answer(response, spec) {
  if (!spec) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end('{"error":"invalid_grant"}');
    return;
  }
  const headers = spec.contentType === null ? {} : { "content-type": spec.contentType ?? "application/json" };
  response.writeHead(spec.status ?? 200, headers);
  response.end(typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body ?? {}));
}

export async function startStub(port = 0) {
  const seen = [];
  const mail = [];
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const url = new URL(request.url, "http://stub");
      if (request.method === "POST" && url.pathname === "/hook") {
        mail.push(JSON.parse(raw));
        response.writeHead(204);
        response.end();
        return;
      }
      const form = Object.fromEntries(new URLSearchParams(raw));
      seen.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        contentType: request.headers["content-type"] ?? null,
        accept: request.headers.accept ?? null,
        authorization: request.headers.authorization ?? null,
        body: raw && !request.headers["content-type"]?.startsWith("application/x-www-form-urlencoded") ? raw : null,
        form: raw ? [...new URLSearchParams(raw).keys()].join("&") : null,
        values: form,
      });
      const bearer = (request.headers.authorization ?? "").replace(/^Bearer /, "");
      const tiktok = bearer.startsWith("at.") ? decode(bearer.slice(3)) : null;
      if (request.method === "POST" && ["/token", "/oauth/token", "/v2/oauth/token/"].includes(url.pathname)) {
        answer(response, (form.code ?? "").startsWith("code.") ? decode(form.code.slice(5)) : null);
      } else if (request.method === "GET" && url.pathname === "/v2/user/me") {
        const token = (request.headers.authorization ?? "").replace(/^Bearer /, "");
        answer(response, token.startsWith("at.") ? decode(token.slice(3)) : { status: 401, body: { msg: "this access token does not exist", code: -401 } });
      } else if (url.pathname === "/v2/user/info/") {
        answer(response, tiktok?.user ?? { status: 401, body: { error: { code: "access_token_invalid", message: "stub: unknown token" } } });
      } else if (url.pathname === "/v2/video/list/") {
        answer(response, tiktok?.videos ?? { status: 401, body: { error: { code: "access_token_invalid", message: "stub: unknown token" } } });
      } else {
        response.writeHead(404);
        response.end();
      }
    });
  });
  await new Promise((done) => server.listen(port, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`, seen, mail, close: () => server.close() };
}
