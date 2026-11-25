// AUTH_EMAIL_WEBHOOK for the server (server/src/routes/better_auth/mail.rs):
// a POST of {"to","subject","url"} with no credentials of its own, so the
// path carries a secret. It sends only the two account mails, and only links
// to the site, so a leaked URL cannot send arbitrary mail.

const MAX_BODY_BYTES = 4096;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_SITE_ORIGIN = "https://catchmeme.com";

// The server's subjects (sign_up.rs, oauth/link.rs, password_reset.rs).
const MAILS = {
  "Verify your MemeCatch email": {
    subject: "[밈캐치] 이메일 주소를 인증해 주세요",
    lead: "아래 링크를 눌러 밈캐치 이메일 인증을 마쳐 주세요.",
    leadEn: "Open the link below to verify your MemeCatch email.",
    action: "이메일 인증하기 / Verify email",
  },
  "Reset your MemeCatch password": {
    subject: "[밈캐치] 비밀번호 재설정 링크",
    lead: "아래 링크에서 새 비밀번호를 정해 주세요. 링크는 1시간 동안 한 번만 쓸 수 있습니다.",
    leadEn: "Set a new password at the link below. It works once, for one hour.",
    action: "비밀번호 재설정 / Reset password",
  },
};
const FOOTER = "직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다. / If you did not ask for this, ignore this mail.";

const EMAIL_PATTERN = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

function sameSecret(given, expected) {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// The mail to send, or null when the request is not one the server sends.
export function parseMail(body, siteOrigin) {
  if (!body || typeof body !== "object") return null;
  const { to, subject, url } = body;
  const mail = typeof subject === "string" ? MAILS[subject] : undefined;
  if (!mail || typeof to !== "string" || typeof url !== "string") return null;
  if (to.length > 254 || !EMAIL_PATTERN.test(to)) return null;
  if (url.length > 2048 || !url.startsWith(`${siteOrigin}/`)) return null;
  try {
    if (new URL(url).origin !== siteOrigin) return null;
  } catch {
    return null;
  }
  const link = escapeHtml(url);
  return {
    to,
    subject: mail.subject,
    text: `${mail.lead}\n${mail.leadEn}\n\n${url}\n\n${FOOTER}\n`,
    html: `<p>${mail.lead}<br>${mail.leadEn}</p><p><a href="${link}">${mail.action}</a></p><p style="color:#666;font-size:12px">${link}</p><p style="color:#666;font-size:12px">${FOOTER}</p>`,
  };
}

export default {
  async fetch(request, env) {
    const secret = env.MAIL_HOOK_SECRET ?? "";
    const path = new URL(request.url).pathname.slice(1);
    if (secret.length < MIN_SECRET_LENGTH || !sameSecret(path, secret)) {
      return new Response("not found", { status: 404 });
    }
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new Response("too large", { status: 413 });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("bad request", { status: 400 });
    }
    const mail = parseMail(body, env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN);
    if (!mail) return new Response("bad request", { status: 400 });
    try {
      await env.EMAIL.send({ ...mail, from: { email: env.MAIL_FROM, name: "밈캐치 MemeCatch" } });
    } catch (error) {
      console.error(JSON.stringify({ event: "mail_send_failed", subject: body.subject, code: error?.code ?? null, message: String(error?.message ?? error) }));
      return new Response("send failed", { status: 502 });
    }
    return new Response(null, { status: 202 });
  },
};
