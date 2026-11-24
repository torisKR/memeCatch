#!/usr/bin/env node
// The operator actions (server/src/routes/admin): for each case, the same
// input to Next's server action and to its Axum endpoint, as a visitor
// without a session, a user and an operator, and the rows each server
// leaves. The database is put back in the case's state before each call.
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<the servers' secret> TEST_DB_CONTAINER=<its container> \
//     node server/parity/admin-actions.mjs <next> <axum> [group...]
//
// Next's action is called as React calls it: a POST to a page that holds it,
// `Next-Action: <id>` from .next/server/server-reference-manifest.json, the
// arguments as a JSON array, the result in the RSC answer's line `1:`. The
// proxy turns away a POST under /admin without a session (307 to /login) or
// from a non-operator (307 to /) before the action runs; Axum answers 401
// and 403. Those pairs count as the same outcome; the rows must match.
//
// Groups live in admin-actions/<group>.mjs: each exports `cases(ctx)`, a
// list of { name, action, file, endpoint, page, input, setup, rows, roles,
// form }. A `form` case's input is the form's fields: Next gets them as the
// browser posts a server-action form without script, Axum as its screen's
// form posts them; the answer is where each sends the browser.
// Every case also runs with the operator's session from another origin,
// which both servers refuse before the action runs.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axumBase, fail, nextBase, pass, psql, run, send } from "./harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, ".next/server/server-reference-manifest.json"), "utf8"));

/** The id of `exportedName` in `file` (lib/actions/… or app/…). */
function actionId(exportedName, file) {
  const found = Object.entries(manifest.node).filter(
    ([, entry]) => entry.exportedName === exportedName && (!file || entry.filename === file),
  );
  if (found.length !== 1) throw new Error(`${found.length} actions named ${exportedName} in ${file ?? "any file"}`);
  return found[0][0];
}

function mintSession(role) {
  const result = spawnSync(
    process.execPath,
    ["--import", resolve(root, "scripts/register-ts-paths.mjs"), resolve(here, "behaviour/session.mjs"), role],
    { cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
  );
  if (result.status !== 0) throw new Error(`session.mjs failed: ${result.stderr.slice(-600)}`);
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

const FOREIGN_ORIGIN = "http://evil.example";
const cookieOf = (session) => (session ? `${session.cookieName}=${session.cookieValue}` : null);

/** Multipart form data of `fields` (an object), with an optional extra field. */
function multipart(fields, extra) {
  const boundary = "----admin-actions-parity";
  const parts = Object.entries({ ...extra, ...fields }).map(
    ([name, value]) => `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  return { boundary, body: `${parts.join("")}--${boundary}--\r\n` };
}

/** A form action: where each server sends the browser. */
const location = (response) => response.headers.location?.[0] ?? "";

async function callNextForm(testCase, fields, cookie, foreign) {
  // Without script React posts the form itself: `$ACTION_ID_<id>` names the action.
  const { boundary, body } = multipart(fields, { [`$ACTION_ID_${actionId(testCase.action, testCase.file)}`]: "" });
  const response = await send(nextBase, {
    method: "POST",
    path: testCase.page,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      origin: foreign ? FOREIGN_ORIGIN : nextBase,
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
  if (response.status === 307) return { redirect: location(response) };
  if (response.status === 303) return { seeOther: location(response) };
  if (response.status === 500 && foreign) return { forbidden: true };
  return { status: response.status, body: response.body.toString("utf8").slice(0, 300) };
}

async function callAxumForm(testCase, fields, cookie, foreign) {
  const response = await send(axumBase, {
    method: "POST",
    path: `/_axum/admin/${testCase.endpoint}`,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: foreign ? FOREIGN_ORIGIN : axumBase,
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
  if (response.status === 303) {
    const to = location(response);
    // The proxy's redirects, as the endpoint makes them.
    return to.startsWith("/login") || to === "/" ? { redirect: to } : { seeOther: to };
  }
  if (response.status === 403) return { forbidden: true };
  return { status: response.status, body: response.body.toString("utf8").slice(0, 300) };
}

/** Next's action: its result, or where the proxy sent the POST. */
async function callNext(testCase, input, cookie, foreign) {
  const response = await send(nextBase, {
    method: "POST",
    path: testCase.page,
    headers: {
      "next-action": actionId(testCase.action, testCase.file),
      "content-type": "text/plain;charset=UTF-8",
      accept: "text/x-component",
      origin: foreign ? FOREIGN_ORIGIN : nextBase,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(input === undefined ? [] : [input]),
  });
  if (response.status === 307) return { redirect: response.headers.location?.[0] ?? "" };
  // Next refuses an action from another origin by throwing: a 500 whose
  // result line is an error digest.
  if (response.status === 500 && foreign) return { forbidden: true };
  const line = response.body
    .toString("utf8")
    .split("\n")
    .find((text) => text.startsWith("1:"));
  if (response.status !== 200 || !line) return { status: response.status, body: response.body.toString("utf8").slice(0, 300) };
  return { result: JSON.parse(line.slice(2)) };
}

async function callAxum(testCase, input, cookie, foreign) {
  const response = await send(axumBase, {
    method: "POST",
    path: `/_axum/admin/${testCase.endpoint}`,
    // The site origin the Axum server is given, which the same-origin check
    // compares with.
    headers: {
      "content-type": "application/json",
      origin: foreign ? FOREIGN_ORIGIN : axumBase,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(input),
  });
  const text = response.body.toString("utf8");
  if (response.status === 401) return { redirect: "/login" };
  if (response.status === 403) return text.includes('"forbidden"') ? { forbidden: true } : { redirect: "/" };
  if (response.status !== 200) return { status: response.status, body: text.slice(0, 300) };
  return { result: JSON.parse(text) };
}

/**
 * A redirect to `/login?next=…` and Axum's 401 are the same outcome. Axum's
 * site origin is `axumBase` (NEXT_PUBLIC_SITE_URL of the gate servers).
 */
const outcome = (answer) =>
  answer.redirect !== undefined
    ? `redirect ${answer.redirect.startsWith("/login") ? "/login" : answer.redirect}`
    : answer.forbidden
      ? "forbidden"
      : answer.seeOther !== undefined
        ? `see ${answer.seeOther}`
      : JSON.stringify(sortKeys(answer.result ?? answer));

// Answers are compared as data: the order of an object's keys means nothing
// to the script that reads them.
const sortKeys = (value) =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
      : value;

async function runCase(ctx, testCase) {
  // `foreign`: the operator's session from a page of another origin.
  const roles = testCase.roles ?? ["anon", "user", "operator", "foreign"];
  for (const role of roles) {
    const label = `${testCase.name} [${role}]`;
    const foreign = role === "foreign";
    const cookie = cookieOf(ctx.sessions[foreign ? "operator" : role]);
    const input = typeof testCase.input === "function" ? testCase.input(ctx) : testCase.input;
    const results = [];
    for (const call of testCase.form ? [callNextForm, callAxumForm] : [callNext, callAxum]) {
      // The state of the case, written with the tables' triggers off: they
      // trust only the app's login, and the setup is not what is compared.
      if (testCase.setup) psql(`set session_replication_role = replica;\n${testCase.setup(ctx)}`);
      const answer = await call(testCase, input, cookie, foreign);
      results.push({ answer, rows: psql(testCase.rows(ctx)) });
    }
    const [next, axum] = results;
    const problems = [];
    if (outcome(next.answer) !== outcome(axum.answer)) {
      problems.push(`answer\n  next: ${outcome(next.answer)}\n  axum: ${outcome(axum.answer)}`);
    }
    if (next.rows !== axum.rows) problems.push(`rows\n  next: ${next.rows}\n  axum: ${axum.rows}`);
    if (problems.length) fail(label, problems.join("\n"));
    else pass(label, `${outcome(next.answer).slice(0, 80)} | ${next.rows.replace(/\s+/g, " ").slice(0, 100)}`);
  }
}

const groups = {};
for (const name of ["users", "growth", "radar", "reports", "inquiries", "submissions"]) {
  groups[name] = async () => {
    const ctx = {
      sessions: { anon: null, user: mintSession("user"), operator: mintSession("operator") },
      newAccount: mintSession,
    };
    const group = await import(`./admin-actions/${name}.mjs`);
    for (const testCase of group.cases(ctx)) await runCase(ctx, testCase);
  };
}
await run(groups);
