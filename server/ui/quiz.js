// /quiz and /quiz/r/{token}: components/quiz-app.tsx. Start (a mode, or a
// friend's challenge) → GET /api/quiz → ten questions answered by click or
// by the keys 1–4 and Enter → the result, its share link, its card image
// and the wrong answers. The page carries lib/quiz.ts, lib/quiz-share.ts
// and lib/quiz-card.ts (scripts/build-ui.mjs, PAGE_FILES).
import { eraDecadeLabel, gradeForScore } from "@/server/ui/lib/quiz";
import { quizResultPath, quizShareTokenFor } from "@/server/ui/lib/quiz-share";
import { downloadOrShareQuizCard } from "@/server/ui/lib/quiz-card";
import { SITE_URL } from "@/lib/site";
import { track } from "@/server/ui/lib/analytics";

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
    let replay = "general";
    let index = 0;
    let selected = null;
    let answers = [];
    let screen = main.querySelector("section[data-quiz-screen]");

    const stages = ["opened", "loaded", "completed"];
    let earned = challenge ? 1 : 0;
    let sent = 0;
    const flushStages = () => {
      if (document.visibilityState !== "visible" || !window.gtag) return;
      while (sent < earned) track(`quiz_challenge_${stages[sent++]}`, undefined, "ga");
      if (sent === stages.length) document.removeEventListener("visibilitychange", flushStages);
    };
    const recordStage = (stage) => {
      earned = Math.max(earned, stage);
      flushStages();
    };
    if (challenge && window.gtag) {
      document.addEventListener("visibilitychange", flushStages);
      flushStages();
    }

    function replayKind(loaded, requested) {
      if (loaded.length < Math.ceil(requested.length / 2) || loaded.length > requested.length) {
        throw new Error("invalid set size");
      }
      let cursor = 0;
      for (const { meme, question, options, answerIndex } of loaded) {
        if (typeof meme?.shortId !== "string" || typeof meme.slug !== "string" ||
            typeof meme.title !== "string" || (meme.originYear !== null && !Number.isFinite(meme.originYear)) ||
            typeof question !== "string" || !Array.isArray(options) || options.length !== 4 ||
            !options.every((option) => typeof option === "string") ||
            !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
          throw new Error("invalid question");
        }
        const i = requested.indexOf(meme.shortId, cursor);
        if (i < 0) throw new Error("invalid set order");
        cursor = i + 1;
      }
      return loaded.length === requested.length ? "challenge" : "practice";
    }

    const show = (next) => {
      screen.replaceWith(next);
      screen = next;
    };

    async function start(nextMode, set) {
      mode = nextMode;
      phase = "loading";
      questions = [];
      replay = "general";
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
        if (set) replay = replayKind(body.questions, set);
        questions = body.questions;
        phase = "playing";
        renderQuestion();
        if (replay === "challenge") recordStage(2);
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
      slot(section, "practice").hidden = replay !== "practice";
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
        track("quiz_complete", { score, mode, item_count: questions.length, state: replay });
        if (replay === "challenge") recordStage(3);
        phase = "result";
        renderResult();
        return;
      }
      index += 1;
      selected = null;
      renderQuestion();
    }

    // versusMessage
    const versus = (mine, theirs) => {
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
      const practice = replay === "practice";
      const token = practice ? null : quizShareTokenFor(mode, questions, answers);
      const site = main.dataset.siteUrl || SITE_URL;
      const shareUrl = token ? `${site}${quizResultPath(token)}` : `${site}/quiz`;
      slot(section, "score").textContent = String(score);
      slot(section, "total").textContent = `/${total}`;
      slot(section, "grade").textContent = grade.label;
      slot(section, "comment").textContent = grade.comment;
      if (era) slot(section, "era").textContent = `당신의 밈 감성은 ${era}`;
      else slot(section, "era").remove();
      if (replay === "challenge") slot(section, "versus").textContent = `친구 ${challenge.score}/${challenge.total} vs 나 ${score}/${total} — ${versus(score, challenge.score)}`;
      else slot(section, "versus").remove();
      slot(section, "practice").hidden = !practice;
      slot(section, "retry").textContent = challenge ? "같은 문제 다시 풀기" : "다시 풀기";
      const notice = slot(section, "notice");
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

      const setNotice = (text) => {
        notice.textContent = text;
        notice.hidden = !text;
      };
      let operation = false;
      const imageButton = section.querySelector('[data-quiz-action="image"]');
      imageButton.addEventListener("click", async () => {
        if (operation) return;
        operation = true;
        imageButton.disabled = true;
        slot(section, "image-label").textContent = "성적표 생성 중...";
        setNotice("");
        try {
          const result = await downloadOrShareQuizCard({ score, total, grade, era, mode, questions, answers, shareUrl, practice });
          if (result.downloaded) setNotice("성적표 이미지가 다운로드되었습니다!");
        } catch {
          setNotice("이미지 저장 중 오류가 발생했습니다.");
        } finally {
          operation = false;
          imageButton.disabled = false;
          slot(section, "image-label").textContent = "성적표 이미지 저장 (인스타/카톡)";
        }
      });
      const share = section.querySelector('[data-quiz-action="share"]');
      const copy = slot(section, "copy");
      const manual = slot(section, "manual");
      if (!token) {
        share.remove();
      } else {
        share.addEventListener("click", async () => {
          if (operation) return;
          setNotice("");
          copy.hidden = true;
          manual.hidden = true;
          track("quiz_share", { score, mode });
          if (typeof navigator.share !== "function") {
            copy.hidden = false;
            copy.focus();
            return;
          }
          operation = true;
          share.disabled = true;
          try {
            await navigator.share({ title: "밈력고사 결과", text: `나의 밈력 ${score}/${total}점 (${grade.label})`, url: shareUrl });
          } catch (error) {
            if (error?.name !== "AbortError") {
              setNotice("공유하지 못했어요. 링크를 복사해 보세요.");
              copy.hidden = false;
            }
          } finally {
            operation = false;
            share.disabled = false;
            if (!copy.hidden) copy.focus();
          }
        });
        copy.addEventListener("click", async () => {
          if (operation) return;
          operation = true;
          copy.disabled = true;
          try {
            await navigator.clipboard.writeText(shareUrl);
            setNotice("링크를 복사했어요.");
            manual.hidden = true;
          } catch {
            const field = manual.querySelector("input");
            field.value = shareUrl;
            manual.hidden = false;
            setNotice("자동으로 복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.");
            field.focus();
            field.select();
          } finally {
            operation = false;
            copy.disabled = false;
          }
        });
      }
      section.querySelector('[data-quiz-action="retry"]').addEventListener("click", () => void retry());
      const change = section.querySelector('[data-quiz-action="change"]');
      if (practice) change.textContent = "새 문제로 풀기";
      change.addEventListener("click", () => {
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
      else if (phase === "error" && action === "retry") void retry();
      else if (action === "skip" && (phase === "start" || phase === "error" || (phase === "playing" && replay === "practice"))) {
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
