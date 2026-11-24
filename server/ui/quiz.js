// /quiz and /quiz/r/{token}: components/quiz-app.tsx. Start (a mode, or a
// friend's challenge) → GET /api/quiz → ten questions answered by click or
// by the keys 1–4 and Enter → the result, its share link, its card image
// and the wrong answers. The page carries lib/quiz.ts, lib/quiz-share.ts
// and lib/quiz-card.ts (scripts/build-ui.mjs, PAGE_FILES).
import { eraDecadeLabel, gradeForScore } from "@/lib/quiz";
import { quizResultPath, quizShareTokenFor } from "@/lib/quiz-share";
import { downloadOrShareQuizCard } from "@/lib/quiz-card";
import { SITE_URL } from "@/lib/site";
import { track } from "@/lib/analytics";

{
  const main = document.querySelector("main[data-quiz]");
  if (main) {
    const template = (name) => main.querySelector(`template[data-quiz-template="${name}"]`).content.firstElementChild.cloneNode(true);
    const slot = (root, name) => root.querySelector(`[data-slot="${name}"]`);
    const memePath = (meme) => `/memes/${meme.shortId}-${encodeURIComponent(meme.slug)}`;
    let challenge = JSON.parse(main.dataset.quiz).challenge;
    let phase = "start";
    let mode = challenge?.mode ?? "all";
    let questions = [];
    let index = 0;
    let selected = null;
    let answers = [];
    let screen = main.querySelector("section[data-quiz-screen]");

    const show = (next) => {
      screen.replaceWith(next);
      screen = next;
    };

    async function start(nextMode, set) {
      mode = nextMode;
      phase = "loading";
      questions = [];
      index = 0;
      selected = null;
      answers = [];
      show(template("loading"));
      track("quiz_start", set ? { mode: nextMode, challenge: 1 } : { mode: nextMode });
      const query = new URLSearchParams({ mode: nextMode });
      if (set) query.set("set", set.join(","));
      try {
        const response = await fetch(`/api/quiz?${query.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        if (!Array.isArray(body.questions) || body.questions.length === 0) throw new Error("empty");
        questions = body.questions;
        phase = "playing";
        renderQuestion();
      } catch {
        phase = "error";
        const error = template("error");
        if (!challenge) error.querySelector('[data-quiz-action="skip"]').remove();
        show(error);
      }
    }
    const retry = () => (challenge ? start(challenge.mode, challenge.shortIds) : start(mode));

    function startScreen() {
      phase = "start";
      show(template("start"));
    }

    function renderQuestion() {
      const question = questions[index];
      const total = questions.length;
      const answered = selected !== null;
      const section = phase === "playing" && screen.dataset.quizQuestion === String(index) ? screen : template("question");
      section.dataset.quizQuestion = String(index);
      section.setAttribute("aria-label", `문항 ${index + 1} / ${total}`);
      const bar = slot(section, "bar").parentElement;
      bar.setAttribute("aria-valuemax", String(total));
      bar.setAttribute("aria-valuenow", String(index + 1));
      slot(section, "bar").style.width = `${((index + (answered ? 1 : 0)) / total) * 100}%`;
      slot(section, "count").textContent = `${index + 1}/${total}`;
      slot(section, "question").textContent = question.question;
      const options = slot(section, "options");
      if (!options.children.length) {
        question.options.forEach((option, i) => {
          const item = template("option");
          const button = item.querySelector("button");
          button.querySelector("span[aria-hidden]").textContent = String(i + 1);
          button.querySelector("span.min-w-0").textContent = option;
          button.addEventListener("click", () => select(i));
          options.append(item);
        });
      }
      [...options.querySelectorAll("button")].forEach((button, i) => {
        const isAnswer = i === question.answerIndex;
        const isPicked = i === selected;
        let state = "border-border bg-surface hover:border-accent focus-visible:outline-accent";
        if (answered) {
          if (isAnswer) state = "border-safety-green bg-safety-green-bg text-safety-green";
          else if (isPicked) state = "border-safety-red bg-safety-red-bg text-safety-red";
          else state = "border-border bg-surface text-muted opacity-70";
        }
        button.className = `flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base ${state} ${answered ? "" : "hover-glow-flame active:scale-[0.99]"}`;
        button.disabled = answered;
        button.querySelector("svg")?.remove();
        if (answered && isAnswer) button.append(template("check"));
        else if (answered && isPicked) button.append(template("cross"));
      });
      const feedback = slot(section, "feedback");
      if (answered) {
        const correct = selected === question.answerIndex;
        const span = document.createElement("span");
        span.className = correct ? "text-safety-green" : "text-safety-red";
        span.textContent = correct ? "정답! 밈력이 느껴져요." : `아쉬워요 — 정답은 ${question.answerIndex + 1}번.`;
        feedback.replaceChildren(span);
        if (!feedback.nextElementSibling) {
          const actions = template("answered");
          slot(actions, "meme").href = memePath(question.meme);
          const next = actions.querySelector('[data-quiz-action="next"]');
          next.textContent = index + 1 >= total ? "결과 보기" : "다음";
          next.addEventListener("click", goNext);
          feedback.after(actions);
        }
      }
      if (section !== screen) show(section);
    }

    function select(optionIndex) {
      if (phase !== "playing" || selected !== null) return;
      selected = optionIndex;
      answers = [...answers, optionIndex];
      renderQuestion();
    }

    function goNext() {
      if (phase !== "playing" || selected === null) return;
      if (index + 1 >= questions.length) {
        const score = answers.reduce((sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0), 0);
        track("quiz_complete", { score, mode });
        phase = "result";
        renderResult();
        return;
      }
      index += 1;
      selected = null;
      renderQuestion();
    }

    // versusMessage
    const versus = (score, total) => {
      const mine = total > 0 ? score / total : 0;
      const theirs = challenge.total > 0 ? challenge.score / challenge.total : 0;
      if (mine > theirs) return "친구를 이겼어요! 결과 링크로 자랑해 보세요.";
      if (mine === theirs) return "무승부! 다시 붙어 볼까요?";
      return "아쉽게 졌어요. 한 번 더 도전해 보세요.";
    };

    function renderResult() {
      const section = template("result");
      const total = questions.length;
      const score = answers.reduce((sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0), 0);
      const grade = gradeForScore(score, total);
      const era = eraDecadeLabel(questions.filter((q, i) => answers[i] === q.answerIndex && q.meme.originYear !== null).map((q) => q.meme.originYear));
      const token = quizShareTokenFor(mode, questions, answers);
      const shareUrl = token ? `${SITE_URL}${quizResultPath(token)}` : `${SITE_URL}/quiz`;
      slot(section, "score").textContent = String(score);
      slot(section, "total").textContent = `/${total}`;
      slot(section, "grade").textContent = grade.label;
      slot(section, "comment").textContent = grade.comment;
      if (era) slot(section, "era").textContent = `당신의 밈 감성은 ${era}`;
      else slot(section, "era").remove();
      if (challenge) slot(section, "versus").textContent = `친구 ${challenge.score}/${challenge.total} vs 나 ${score}/${total} — ${versus(score, total)}`;
      else slot(section, "versus").remove();
      slot(section, "retry").textContent = challenge ? "같은 문제 다시 풀기" : "다시 풀기";
      const notice = slot(section, "notice");
      notice.remove();
      const wrong = questions.map((q, i) => ({ q, picked: answers[i] })).filter(({ q, picked }) => picked !== q.answerIndex);
      if (wrong.length) {
        const list = slot(section, "wrong-list");
        for (const { q } of wrong) {
          const item = template("wrong");
          item.querySelector("a").href = memePath(q.meme);
          slot(item, "title").textContent = q.meme.title;
          slot(item, "answer").textContent = q.options[q.answerIndex];
          list.append(item);
        }
      } else {
        slot(section, "wrong").remove();
      }

      let noticeTimer = 0;
      const setNotice = (text) => {
        clearTimeout(noticeTimer);
        if (!text) {
          notice.remove();
          return;
        }
        notice.textContent = text;
        slot(section, "card").append(notice);
        noticeTimer = setTimeout(() => notice.remove(), 3000);
      };
      const imageButton = section.querySelector('[data-quiz-action="image"]');
      imageButton.addEventListener("click", async () => {
        imageButton.disabled = true;
        slot(section, "image-label").textContent = "성적표 생성 중...";
        setNotice(null);
        try {
          const result = await downloadOrShareQuizCard({ score, total, grade, era, mode, questions, answers, shareUrl });
          if (result.downloaded) setNotice("성적표 이미지가 다운로드되었습니다!");
        } catch {
          setNotice("이미지 저장 중 오류가 발생했습니다.");
        } finally {
          imageButton.disabled = false;
          slot(section, "image-label").textContent = "성적표 이미지 저장 (인스타/카톡)";
        }
      });
      let copiedTimer = 0;
      section.querySelector('[data-quiz-action="share"]').addEventListener("click", async () => {
        const text = `나의 밈력 ${score}/${total}점 (${grade.label}) — 같은 문제로 내 점수 이겨볼 사람?`;
        track("quiz_share", { score, mode });
        try {
          if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share({ text, url: shareUrl });
            return;
          }
          await navigator.clipboard.writeText(`${text} ${shareUrl}`);
          slot(section, "share-label").textContent = "결과 링크 복사됨!";
          clearTimeout(copiedTimer);
          copiedTimer = setTimeout(() => { slot(section, "share-label").textContent = "결과 링크 공유"; }, 2000);
        } catch {
          /* The share sheet was closed. */
        }
      });
      section.querySelector('[data-quiz-action="retry"]').addEventListener("click", () => void retry());
      section.querySelector('[data-quiz-action="change"]').addEventListener("click", () => {
        challenge = null;
        startScreen();
      });
      show(section);
    }

    main.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const modeButton = target?.closest("[data-quiz-mode]");
      if (modeButton && screen.contains(modeButton)) {
        void start(modeButton.dataset.quizMode);
        return;
      }
      const action = target?.closest("[data-quiz-action]")?.dataset.quizAction;
      if (phase === "start" && action === "challenge" && challenge) void start(challenge.mode, challenge.shortIds);
      else if (phase === "start" && action === "skip") {
        challenge = null;
        startScreen();
      } else if (phase === "error" && action === "retry") void retry();
      else if (phase === "error" && action === "skip") {
        challenge = null;
        startScreen();
      }
    });

    // Keys 1–4 answer, Enter goes on, while a question is on screen.
    addEventListener("keydown", (event) => {
      if (phase !== "playing" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        select(Number(event.key) - 1);
      } else if (event.key === "Enter" && selected !== null) {
        event.preventDefault();
        goNext();
      }
    });
  }
}
