import { describe, expect, it, vi } from "vitest";
import worker, { parseMail } from "./index.js";

const SECRET = "s".repeat(40);
const SITE = "https://catchmeme.com";
const reset = { to: "a@example.com", subject: "Reset your MemeCatch password", url: `${SITE}/reset-password?token=abc` };

function call(path: string, body: unknown, method = "POST") {
  const send = vi.fn().mockResolvedValue({ messageId: "m1" });
  const env = { MAIL_HOOK_SECRET: SECRET, MAIL_FROM: "no-reply@catchmeme.com", EMAIL: { send } };
  const request = new Request(`https://hook.test/${path}`, {
    method,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  return worker.fetch(request, env).then((response: Response) => ({ response, send }));
}

describe("mail hook", () => {
  it("sends the reset mail with the site link", async () => {
    const { response, send } = await call(SECRET, reset);
    expect(response.status).toBe(202);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe("a@example.com");
    expect(mail.from.email).toBe("no-reply@catchmeme.com");
    expect(mail.text).toContain(reset.url);
    expect(mail.html).toContain("reset-password?token=abc");
  });

  it("answers 404 without the secret and sends nothing", async () => {
    const { response, send } = await call("wrong", reset);
    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects links off the site, unknown subjects and bad addresses", () => {
    expect(parseMail({ ...reset, url: "https://evil.example/x" }, SITE)).toBeNull();
    expect(parseMail({ ...reset, url: "https://catchmeme.com.evil.example/x" }, SITE)).toBeNull();
    expect(parseMail({ ...reset, subject: "Win a prize" }, SITE)).toBeNull();
    expect(parseMail({ ...reset, to: "a@example.com, b@example.com" }, SITE)).toBeNull();
    expect(parseMail({ ...reset, subject: "Verify your MemeCatch email" }, SITE)?.subject).toContain("인증");
  });

  it("escapes the link in the HTML body", () => {
    const mail = parseMail({ ...reset, url: `${SITE}/reset-password?token="><script>` }, SITE);
    expect(mail?.html).not.toContain("<script>");
  });

  it("answers 502 when sending fails", async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: "E_DELIVERY_FAILED" }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { MAIL_HOOK_SECRET: SECRET, MAIL_FROM: "no-reply@catchmeme.com", EMAIL: { send } };
    const response = await worker.fetch(new Request(`https://hook.test/${SECRET}`, { method: "POST", body: JSON.stringify(reset) }), env);
    expect(response.status).toBe(502);
    expect(errors).toHaveBeenCalled();
  });
});
