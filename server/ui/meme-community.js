// The meme page's community parts (src/pages/meme_detail/community.rs),
// rendered only while the community is on.
//
// components/reaction-bar.tsx: six reactions; a tap counts at once and
// `toggle_reaction` confirms it (put back when it fails). Signed out, the
// sign-in dialog opens instead. As in the component, which reactions are the
// reader's own is not read: each starts as not theirs.
//
// components/comments.tsx with comment-form.tsx: the comments are read in
// the browser through the planner, oldest first in pages of 500, then shown
// newest first with their replies under them. The forms post to
// POST /api/community/comment and the report button to
// POST /api/community/report, which answer as `postComment` and
// `reportContent` do. A form's draft is kept on this device until it is sent.
{
  const COMMUNITY_ERROR = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const element = (tag, attributes = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? "" : value);
    }
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
  };

  const postAction = async (path, body) => {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch {
      return { ok: false, error: "server_error", message: COMMUNITY_ERROR };
    }
  };

  // `notice` of the forms: green for success, red (an alert) for an error.
  const noticeLine = (notice, className, ...extra) =>
    element("p", {
      role: notice.kind === "error" ? "alert" : "status",
      class: className,
      style: `color:${notice.kind === "error" ? "var(--safety-red)" : "var(--safety-green)"}`,
    }, notice.message, ...extra);

  // --- ReactionBar -------------------------------------------------------
  const REACTION_GATE_MESSAGE = "로그인하면 반응을 남길 수 있어요.";
  const REACTION_NOTICE_MS = 2500;
  const REACTION_BUTTON = "hover-glow-flame inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-base font-medium transition-colors";
  const REACTION_ACTIVE = "border-accent bg-accent-soft text-accent";
  const REACTION_IDLE = "border-border bg-surface-2 text-foreground";
  // POP_SPRING (stiffness 400, damping 25) as a curve that overshoots once.
  const POP = { duration: 320, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" };

  const pop = (emoji) => {
    if (!reduceMotion()) emoji.animate([{ transform: "scale(1.3)" }, { transform: "scale(1)" }], POP);
    emoji.style.transform = "none";
  };

  function startReactionBar(bar) {
    const memeId = bar.dataset.reactionBar;
    const status = bar.querySelector('[role="status"]');
    const mine = new Set();
    let loggedIn = null; // null: not known yet
    let noticeTimer = 0;
    const buttons = [...bar.querySelectorAll("[data-reaction]")];

    const showNotice = (message) => {
      status.textContent = message;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => (status.textContent = ""), REACTION_NOTICE_MS);
    };

    // The count, its number sliding in when it changes and the cyan line
    // under it pulsing once when it grows (neither under reduced motion).
    const show = (button, { pulse = false } = {}) => {
      const active = mine.has(button.dataset.reaction);
      const count = Number(button.dataset.count);
      button.className = `${REACTION_BUTTON} ${active ? REACTION_ACTIVE : REACTION_IDLE} `;
      button.setAttribute("aria-pressed", String(active));
      let holder = button.querySelector(".stat-mono");
      if (count <= 0) {
        holder?.remove();
        return;
      }
      if (!holder) {
        holder = element("span", {},
          element("span", { class: "inline-flex overflow-hidden" }, element("span", { style: "opacity:1;transform:none" }, String(count))));
        if (!reduceMotion()) {
          holder.append(element("span", { "aria-hidden": "true", class: "pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-(--signal-cyan)", style: "opacity:0" }));
        }
        button.append(holder);
      } else {
        const value = holder.firstElementChild.firstElementChild;
        if (value.textContent !== String(count)) {
          value.textContent = String(count);
          if (!reduceMotion()) {
            value.animate([{ transform: "translateY(-10px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 180, easing: "ease-out" });
          }
        }
      }
      holder.className = `stat-mono relative inline-flex ${active ? "font-bold" : "text-muted"}`;
      const line = holder.children[1];
      if (pulse && line) line.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 600, easing: "ease-out" });
    };

    const flip = (button, wasMine) => {
      const key = button.dataset.reaction;
      if (wasMine) mine.delete(key);
      else mine.add(key);
      button.dataset.count = String(Math.max(0, Number(button.dataset.count) + (wasMine ? -1 : 1)));
    };

    async function toggle(button) {
      if (loggedIn === false) {
        openLoginGate(REACTION_GATE_MESSAGE);
        return;
      }
      const reaction = button.dataset.reaction;
      const wasMine = mine.has(reaction);
      pop(button.querySelector("span"));
      flip(button, wasMine);
      show(button, { pulse: !wasMine });
      const { error } = await rpc("toggle_reaction", { p_meme_id: memeId, p_reaction: reaction });
      if (error) {
        flip(button, !wasMine);
        show(button);
        if (error.message?.includes("login_required")) {
          loggedIn = false;
          openLoginGate(REACTION_GATE_MESSAGE);
          return;
        }
        showNotice("잠시 후 다시 시도해 주세요.");
        return;
      }
      loggedIn = true;
    }

    for (const button of buttons) {
      pop(button.querySelector("span"));
      if (reduceMotion()) button.querySelector(".stat-mono")?.children[1]?.remove();
      button.addEventListener("click", () => toggle(button));
    }
    currentUser().then((user) => {
      loggedIn = Boolean(user);
    });
  }

  // --- CommentForm -------------------------------------------------------
  const COMMENT_MAX = 2000;
  const draftKey = (memeId, parentId) => `memecatch:comment-draft:${memeId}:${parentId ?? "root"}`;

  /** Brings `form` (rendered or built) to life; `onPosted` runs after a comment is stored. */
  function bindCommentForm(form, { memeId, parentId = null, onPosted }) {
    const textarea = form.querySelector("textarea");
    const counter = form.querySelector("p");
    const submit = form.querySelector('button[type="submit"]');
    const idleLabel = parentId ? "답글 남기기" : "댓글 남기기";
    const key = draftKey(memeId, parentId);
    let pending = false;
    let notice = null;

    const render = () => {
      counter.textContent = `${textarea.value.length.toLocaleString("ko-KR")}/${COMMENT_MAX.toLocaleString("ko-KR")}자 · 10분에 최대 10개까지 쓸 수 있어요`;
      submit.disabled = pending || !textarea.value.trim();
      submit.textContent = pending ? "남기는 중…" : idleLabel;
      form.querySelector("[data-comment-notice]")?.remove();
      if (!notice) return;
      const login = notice.loginLink
        ? [" ", element("a", { href: `/login?next=${encodeURIComponent(location.pathname)}`, class: "font-semibold underline underline-offset-2" }, "로그인하고 이어서 쓰기")]
        : [];
      const line = noticeLine(notice, "text-base", ...login);
      line.dataset.commentNotice = "";
      form.append(line);
    };

    const saved = storage.get("localStorage", key);
    if (saved) textarea.value = saved;
    textarea.addEventListener("input", () => {
      if (textarea.value.trim()) storage.set("localStorage", key, textarea.value);
      else storage.remove("localStorage", key);
      render();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!textarea.value.trim() || pending) return;
      notice = null;
      pending = true;
      render();
      const result = await postAction("/api/community/comment", { memeId, parentId, body: textarea.value });
      pending = false;
      if (result.ok) {
        textarea.value = "";
        storage.remove("localStorage", key);
        notice = { kind: "success", message: "댓글을 남겼어요!" };
        render();
        onPosted?.();
      } else {
        notice = { kind: "error", message: result.message, loginLink: result.error === "login_required" };
        render();
      }
    });
    render();
  }

  // A reply's form, as CommentForm renders it with `parentId`.
  const replyForm = (memeId, parentId) => {
    const field = `comment-body-${parentId}-${memeId}`;
    return element("form", { class: "space-y-2" },
      element("label", { class: "sr-only", for: field }, "댓글 내용"),
      element("textarea", { id: field, placeholder: "답글을 남겨 주세요.", maxlength: String(COMMENT_MAX), rows: "2", class: "w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-signal-cyan focus:outline-none focus:ring-4 focus:ring-signal-cyan/20" }),
      element("div", { class: "flex flex-wrap items-center justify-between gap-2" },
        element("p", { class: "text-sm text-muted" }),
        element("button", { type: "submit", class: "hover-glow-flame holo-sheen inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" })));
  };

  // --- ReportButton ------------------------------------------------------
  function reportButton(targetId) {
    const wrapper = element("div", { class: "flex-1" });
    const toggle = element("button", { type: "button", "aria-expanded": "false", class: "hover-glow-flame inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted" }, "신고");
    const field = `report-reason-${targetId}`;
    const input = element("input", { id: field, maxlength: "500", placeholder: "어떤 점이 문제인지 알려 주세요", class: "min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base placeholder:text-muted" });
    const submit = element("button", { type: "submit", class: "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-base font-semibold disabled:opacity-50" });
    const form = element("form", { class: "mt-1 flex flex-wrap items-center gap-2" },
      element("label", { class: "sr-only", for: field }, "신고 사유"), input, submit);
    let open = false;
    let pending = false;
    let notice = null;

    const render = () => {
      toggle.setAttribute("aria-expanded", String(open));
      submit.disabled = pending || !input.value.trim();
      submit.textContent = pending ? "접수 중…" : "신고하기";
      wrapper.replaceChildren(toggle, open ? form : null, notice ? noticeLine(notice, "mt-1 text-sm") : null);
    };
    toggle.addEventListener("click", () => {
      open = !open;
      render();
    });
    input.addEventListener("input", render);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!input.value.trim() || pending) return;
      pending = true;
      render();
      const result = await postAction("/api/community/report", { targetType: "discussion", targetId, reason: input.value });
      pending = false;
      if (result.ok) {
        notice = { kind: "success", message: "신고가 접수됐어요. 검토 후 처리할게요." };
        input.value = "";
        open = false;
      } else {
        notice = { kind: "error", message: result.message };
      }
      render();
    });
    render();
    return wrapper;
  }

  // --- Comments ----------------------------------------------------------
  const COMMENTS_PAGE = 500;
  const commentsPlan = (memeId, offset) => ({
    ...queryPlan("select", "discussions", {
      fields: [
        ...["id", "parent_id", "body", "status", "created_at", "user_id"].map((name) => ({ kind: "column", name })),
        { kind: "embed", embed: { alias: "profiles", table: "profiles", inner: false, hint: "discussions_user_id_fkey", fields: [{ kind: "column", name: "nickname" }], filters: [], orGroups: [], orders: [], limit: null } },
      ],
      filters: [{ column: "meme_id", op: "eq", value: memeId }],
    }),
    orders: [{ column: "created_at", ascending: true }, { column: "id", ascending: true }],
    limit: COMMENTS_PAGE,
    offset,
  });

  function timeAgo(iso) {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}일 전`;
    return new Date(iso).toLocaleDateString("ko-KR");
  }

  function startComments(section) {
    const memeId = section.dataset.comments;
    const heading = section.querySelector("h2");
    const list = section.querySelector("[data-comments-list]");
    const skeleton = section.querySelector("[data-comments-loading]");
    let comments = null;
    let failed = false;
    let replyTo = null;
    // An item keeps its element, and with it an open report form, across reads (React's keys).
    const items = new Map();

    async function fetchComments() {
      const rows = [];
      for (let offset = 0; ; offset += COMMENTS_PAGE) {
        const { data, error } = await runPlan(commentsPlan(memeId, offset));
        if (error) {
          failed = true;
          render();
          return;
        }
        const page = data ?? [];
        rows.push(...page);
        if (page.length < COMMENTS_PAGE) break;
      }
      failed = false;
      comments = rows;
      render();
    }

    const item = (comment, topLevel) => {
      let entry = items.get(comment.id);
      if (entry) {
        entry.time.textContent = timeAgo(comment.created_at);
        return entry.node;
      }
      const masked = comment.status !== "visible";
      const time = element("time", { datetime: comment.created_at }, timeAgo(comment.created_at));
      const article = element("article", { class: "rounded-xl border border-foreground/10 bg-surface-2/80 p-4" },
        element("header", { class: "flex items-center gap-2 text-sm text-muted" },
          element("span", { class: "font-semibold text-foreground" }, comment.profiles?.nickname ?? "익명"),
          time),
        masked
          ? element("p", { class: "mt-1 text-base italic text-muted" }, comment.status === "deleted" ? "삭제된 댓글이에요" : "가려진 댓글이에요")
          : element("p", { class: "mt-1 whitespace-pre-wrap text-base" }, comment.body));
      entry = { node: article, time, reply: null, form: null };
      if (!masked) {
        const actions = element("div", { class: "mt-2 flex items-center gap-1" });
        if (topLevel) {
          entry.reply = element("button", { type: "button", class: "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted" }, "답글");
          entry.reply.addEventListener("click", () => {
            replyTo = replyTo === comment.id ? null : comment.id;
            render();
          });
          actions.append(entry.reply);
        }
        actions.append(reportButton(comment.id));
        article.append(actions);
      }
      items.set(comment.id, entry);
      return article;
    };

    // The reply form of the item being answered, and only that one.
    const showReply = (id) => {
      const entry = items.get(id);
      if (!entry?.reply) return;
      const replying = replyTo === id;
      entry.reply.textContent = replying ? "답글 닫기" : "답글";
      if (replying && !entry.form) {
        const form = replyForm(memeId, id);
        entry.form = element("div", { class: "mt-2" }, form);
        entry.node.append(entry.form);
        bindCommentForm(form, {
          memeId,
          parentId: id,
          onPosted: () => {
            replyTo = null;
            render();
            void fetchComments();
          },
        });
        form.querySelector("textarea").focus();
      } else if (!replying && entry.form) {
        entry.form.remove();
        entry.form = null;
      }
    };

    function render() {
      heading.textContent = `댓글${comments ? ` ${comments.length.toLocaleString("ko-KR")}` : ""}`;
      if (comments === null && !failed) list.before(skeleton);
      else skeleton.remove();
      section.querySelector("[data-comments-error]")?.remove();
      section.querySelector("[data-comments-empty]")?.remove();
      if (failed) {
        const retry = element("button", { type: "button", class: "mt-2 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold" }, "다시 시도");
        retry.addEventListener("click", () => {
          comments = null;
          failed = false;
          render();
          void fetchComments();
        });
        list.before(element("div", { role: "alert", class: "rounded-xl border border-border bg-surface-2 p-4 text-center", "data-comments-error": "" },
          element("p", { class: "text-base text-muted" }, "댓글을 불러오지 못했어요."), retry));
      }
      const all = comments ?? [];
      const topLevel = all.filter((c) => c.parent_id === null).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (comments !== null && !failed && topLevel.length === 0) {
        list.before(element("p", { class: "rounded-xl bg-surface-2 p-6 text-center text-base text-muted", "data-comments-empty": "" }, "아직 댓글이 없어요. 첫 댓글을 남겨보세요!"));
      }
      list.replaceChildren(...topLevel.map((comment) => {
        const replies = all.filter((c) => c.parent_id === comment.id);
        const li = element("li", {}, item(comment, true));
        if (replies.length > 0) {
          li.append(element("ul", { class: "mt-3 space-y-3 border-l-2 border-border pl-4" },
            ...replies.map((reply) => element("li", {}, item(reply, false)))));
        }
        return li;
      }));
      for (const comment of topLevel) showReply(comment.id);
    }

    bindCommentForm(section.querySelector("[data-comment-form]"), { memeId, onPosted: () => void fetchComments() });
    void fetchComments();
  }

  const bar = document.querySelector("[data-reaction-bar]");
  if (bar) startReactionBar(bar);
  const comments = document.querySelector("[data-comments]");
  if (comments) startComments(comments);
}
