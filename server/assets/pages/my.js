(() => {
"use strict";
const lib = {};
{
    const postJson = (path, body) => fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
    });
    const nickname = document.querySelector("form[data-my-nickname]");
    nickname?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!nickname.reportValidity())
            return;
        const button = nickname.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await postJson("/api/account/nickname", { nickname: nickname.elements.nickname.value });
            const answer = await response.json();
            if (answer?.redirect) {
                location.assign(answer.redirect);
                return;
            }
        }
        catch {
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
})();
