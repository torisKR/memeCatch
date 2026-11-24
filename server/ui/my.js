// /my (src/pages/account/my.rs): the nickname form posts to
// POST /api/account/nickname (`updateNickname`) and goes where its answer
// says; the sign-out button signs out with better-auth and goes home
// (`signOut`). The other sections have scripts of their own.
{
  const postJson = (path, body) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

  const nickname = document.querySelector("form[data-my-nickname]");
  nickname?.addEventListener("submit", async (event) => {
    event.preventDefault();
    // `minLength`, `maxLength` and `required` stop the form as they do on Next.
    if (!nickname.reportValidity()) return;
    const button = nickname.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await postJson("/api/account/nickname", { nickname: nickname.elements.nickname.value });
      const answer = await response.json();
      if (answer?.redirect) {
        location.assign(answer.redirect);
        return;
      }
    } catch {
      /* the action's failure answer */
    }
    location.assign(`/my?nickname_error=${encodeURIComponent("닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요")}`);
  });

  const signOut = document.querySelector("form[data-my-sign-out]");
  signOut?.addEventListener("submit", async (event) => {
    event.preventDefault();
    signOut.querySelector('button[type="submit"]').disabled = true;
    await postJson("/api/auth/sign-out", {}).catch(() => undefined);
    location.assign("/");
  });
}
