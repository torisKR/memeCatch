#!/usr/bin/env node
// Writes the expected values for server/tests/quiz_parity.rs by running the
// real functions of lib/quiz.ts under Node: what /api/quiz builds from a
// pool, for a shared set and for a quiz of ten.
//
//   node server/parity/quiz-fixture.mjs > server/tests/fixtures/quiz.json
//
// Node 22.18 or later (it imports the .ts file directly). The rows are those
// of tests/fixtures/daily_quiz.json, so run daily-quiz-fixture.mjs first when
// both change. The output is deterministic.
import { readFileSync } from "node:fs";
import { buildQuestions, buildQuestionsForSet, seededRng } from "../../lib/quiz.ts";

const { rows } = JSON.parse(readFileSync(new URL("../tests/fixtures/daily_quiz.json", import.meta.url), "utf8"));
const indexOf = new Map(rows.map((row, index) => [row, index]));
const sorted = [...rows].sort((a, b) => (a.short_id < b.short_id ? -1 : 1));

// This script's own generator for choosing sets. Not a function under test.
let state = 20261124;
function next(bound) {
  state = (Math.imul(state, 1103515245) + 12345) >>> 0;
  return Math.floor((state / 4294967296) * bound);
}

/** The two queries of fetchPool, on rows held in memory. */
function routePool(pivot, size, keep) {
  const eligible = sorted.filter(keep);
  const first = eligible.filter((row) => row.short_id >= pivot).slice(0, size);
  if (first.length >= size) return first;
  return [...first, ...eligible.filter((row) => row.short_id < pivot).slice(0, size - first.length)];
}

const YEARS = {
  all: () => true,
  now: (row) => row.origin_year !== null && row.origin_year >= 2020,
  retro: (row) => row.origin_year !== null && row.origin_year <= 2009,
};

// Shared sets: ids of the link in order, some of them unknown to the pool.
const sets = [];
for (const mode of ["all", "now", "retro"]) {
  for (const [count, unknown, size] of [[10, 0, 300], [10, 0, 40], [1, 0, 300], [5, 2, 300], [3, 3, 300], [10, 0, 6], [7, 0, 3]]) {
    const ids = [];
    while (ids.length < count) {
      const id = rows[next(rows.length)].short_id;
      if (!ids.includes(id)) ids.push(id);
    }
    for (let i = 0; i < unknown; i += 1) ids.splice(next(ids.length + 1), 0, `zzzzzzz${i}`);
    // The set is read whatever the mode; only the pool is filtered by it.
    const targets = ids.flatMap((id) => rows.find((row) => row.short_id === id) ?? []);
    const pool = routePool(ids[0], size, YEARS[mode]);
    sets.push({
      mode,
      ids,
      targets: targets.map((row) => indexOf.get(row)),
      pool: pool.map((row) => indexOf.get(row)),
      questions: JSON.stringify(buildQuestionsForSet(targets, pool, seededRng(ids.join("")))),
    });
  }
}

// Quizzes of up to ten from pools of several sizes, with a seeded generator
// in place of Math.random.
const quizzes = [];
for (const size of [0, 4, 9, 13, 40, 300]) {
  for (const seed of ["a", "밈캐치", "quiz-seed-3", ""]) {
    const pool = routePool(rows[next(rows.length)].short_id, size, YEARS.all);
    quizzes.push({ seed, pool: pool.map((row) => indexOf.get(row)), questions: JSON.stringify(buildQuestions(pool, 10, seededRng(seed))) });
  }
}

const SEEDS = ["", "a", "abcdefgh", "jkm2022koyj2021k", "밈캐치 😀", "z".repeat(80)];
process.stdout.write(
  `${JSON.stringify({
    sets,
    quizzes,
    // rng() is n / 2^32 for a 32-bit n; n is stored so no float is compared.
    rng: SEEDS.map((seed) => {
      const rng = seededRng(seed);
      return { seed, draws: Array.from({ length: 16 }, () => rng() * 4294967296) };
    }),
  })}\n`,
);
