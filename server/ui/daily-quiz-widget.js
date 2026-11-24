// components/daily-meme-quiz.tsx: one question a day and the attendance
// streak, for a page script (assets/pages/my.js; the home page will use it
// too). The server renders the card while the question loads
// (`data-daily-quiz`); this fills it in. The question is GET /api/daily-quiz
// for today in Korea; the streak is the account's (`get_daily_meme_quiz_status`
// and `complete_daily_meme_quiz` through the planner, as the component's
// browser client sends them) when signed in, else this device's
// `mc_daily_quiz_v1`.
import { LOCAL_STREAK_KEY, kstDayKey, parseLocalRecord, recordLocalAnswer, statusFromLocal, statusFromRpcRow } from "@/server/ui/lib/daily-quiz";
import { createPlanClient } from "@/lib/db/plan";
import { memePathFrom } from "@/server/ui/lib/labels";
import { track } from "@/server/ui/lib/analytics";

const postPlan = async (plan) => {
  const response = await fetch("/api/db/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
  });
  return response.json();
};

const readLocal = () => {
  try {
    return parseLocalRecord(localStorage.getItem(LOCAL_STREAK_KEY));
  } catch {
    return null;
  }
};
const writeLocal = (record) => {
  try {
    localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(record));
  } catch {
    /* this screen only */
  }
};

async function loadServerStatus() {
  const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
  const user = response.ok ? (await response.json())?.user : null;
  if (!user) return null;
  const { data, error } = await createPlanClient(postPlan).rpc("get_daily_meme_quiz_status").single();
  if (error || !data) return null;
  return statusFromRpcRow(data);
}

async function completeOnServer(memeShortId, correct) {
  const { data, error } = await createPlanClient(postPlan)
    .rpc("complete_daily_meme_quiz", { p_meme_short_id: memeShortId, p_correct: correct })
    .single();
  return !error && data ? statusFromRpcRow(data) : null;
}

const element = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
};

/** Fills `section` (the card the server rendered) and keeps it current. */
export function startDailyQuiz(section, variant = "home") {
  const card = section.firstElementChild;
  const state = { question: null, day: null, status: null, signedIn: false, selected: null, unsynced: null };
  const answered = () => state.selected !== null || state.status?.answeredToday === true;

  const streakBadge = () => {
    const status = state.status;
    if (!status) return null;
    const streak = status.currentStreak;
    return element("p", { class: "stat-mono inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-bold", "aria-label": `연속 출석 ${streak}일, 최고 ${status.bestStreak}일` },
      element("span", { "aria-hidden": "true" }, "🔥"),
      `${streak}일 연속`,
      status.bestStreak > streak ? element("span", { class: "font-normal text-muted" }, `· 최고 ${status.bestStreak}일`) : null);
  };

  const questionBody = () => {
    const { question, selected } = state;
    const done = answered();
    const items = question.options.map((option, index) => {
      const isAnswer = index === question.answerIndex;
      const isPicked = index === selected;
      let stateClass = "border-border bg-surface hover:border-accent";
      if (done) {
        if (isAnswer) stateClass = "border-safety-green bg-safety-green-bg text-safety-green";
        else if (isPicked) stateClass = "border-safety-red bg-safety-red-bg text-safety-red";
        else stateClass = "border-border bg-surface text-muted opacity-70";
      }
      const button = element("button", { type: "button", disabled: done, "aria-pressed": String(isPicked), class: `flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${stateClass}` },
        element("span", { "aria-hidden": "true", class: "grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold" }, String(index + 1)),
        element("span", { class: "min-w-0 flex-1" }, option));
      button.addEventListener("click", () => select(index));
      return element("li", {}, button);
    });
    return [
      element("p", { class: "mt-3 font-semibold leading-snug sm:text-lg" }, question.question),
      element("ol", { class: "mt-3 space-y-2" }, ...items),
      done && selected !== null
        ? element("p", { class: "mt-3 text-sm font-semibold" }, selected === question.answerIndex
          ? element("span", { class: "text-safety-green" }, "정답! 밈력이 느껴져요.")
          : element("span", { class: "text-safety-red" }, `아쉬워요, 정답은 ${question.answerIndex + 1}번이에요.`))
        : null,
    ];
  };

  const footer = () => {
    const streak = state.status?.currentStreak ?? 0;
    const { question } = state;
    return element("div", { class: "mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" },
      element("p", { role: "status", class: "text-sm font-semibold" },
        streak > 1 ? `${streak}일 연속 출석! 내일도 이어가요.` : "출석 완료! 내일 새 문제가 열려요.",
        state.signedIn ? null : element("span", { class: "mt-1 block text-xs font-normal text-muted" },
          "지금은 이 기기에만 기록돼요. ",
          element("a", { href: "/login?next=/my", class: "font-semibold text-accent-text underline-offset-4 hover:underline" }, "로그인"),
          "하면 MY에서 연속 출석을 이어갈 수 있어요.")),
      element("div", { class: "flex flex-wrap items-center gap-2" },
        element("a", { href: memePathFrom(question.meme.shortId, question.meme.slug), class: "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" }, "이 밈 보러가기"),
        variant === "compact" ? null : element("a", { href: "/quiz", class: "inline-flex min-h-11 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97]" }, "10문제 더 풀기")));
  };

  const render = () => {
    const title = element("h2", { id: "daily-meme-quiz-title", class: "flex items-center gap-2 text-lg font-bold sm:text-xl" },
      element("span", { "aria-hidden": "true", class: "inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800" }, "오늘"),
      "오늘의 밈 퀴즈",
      state.day ? element("span", { "aria-hidden": "true", class: "stat-mono text-xs font-normal text-muted" }, state.day.slice(5).replace("-", ".")) : null);
    const head = element("div", { class: "flex flex-wrap items-center justify-between gap-3" }, title, streakBadge());
    const body = state.question ? questionBody() : [element("p", { role: "status", class: "mt-4 text-sm text-muted" }, "오늘의 문제를 가져오고 있어요…")];
    card.replaceChildren(head, ...body, answered() && state.question ? footer() : null);
  };

  const syncUnsynced = async () => {
    if (state.unsynced === null || !state.question) return;
    const pick = state.unsynced;
    const saved = await completeOnServer(state.question.meme.shortId, pick === state.question.answerIndex);
    if (saved) state.status = saved;
    state.unsynced = null;
    render();
  };

  async function select(index) {
    const { question } = state;
    if (!question || answered()) return;
    const today = state.day ?? kstDayKey();
    const correct = index === question.answerIndex;
    state.selected = index;
    track("quiz_complete", { mode: "daily", score: correct ? 1 : 0 });
    const next = recordLocalAnswer(readLocal(), today, index, correct);
    writeLocal(next);
    state.status = statusFromLocal(next, today);
    render();
    if (!state.signedIn) return;
    const saved = await completeOnServer(question.meme.shortId, correct);
    if (saved) {
      state.status = saved;
      render();
    }
  }

  (async () => {
    try {
      // The Korean day is in the URL, so yesterday's cached question cannot
      // answer for today after midnight.
      const response = await fetch(`/api/daily-quiz?d=${kstDayKey()}`);
      if (!response.ok) {
        // Not read, the answer stayed open and the page never went idle
        // (D2-18, PLAN.md B4-9).
        response.body?.cancel().catch(() => {});
        throw new Error(String(response.status));
      }
      const body = await response.json();
      state.question = body.question;
      state.day = body.date;
      render();
      syncUnsynced();
    } catch {
      // `if (failed) return null`.
      section.remove();
    }
  })();
  (async () => {
    const today = kstDayKey();
    const local = readLocal();
    const server = await loadServerStatus().catch(() => null);
    state.signedIn = server !== null;
    state.status = server ?? statusFromLocal(local, today);
    if (local?.lastDate === today) {
      state.selected = local.lastSelected;
      if (server && !server.answeredToday) state.unsynced = local.lastSelected;
    }
    if (section.isConnected) render();
    syncUnsynced();
  })();
}
