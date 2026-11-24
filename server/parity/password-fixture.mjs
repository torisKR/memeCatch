// Not a comparison of servers: makes password hashes with the app's own code
// (lib/auth/passwords.ts: better-auth's scrypt, and bcryptjs for imported
// accounts) and records the app's verdict on each, for the Rust port in
// src/routes/better_auth/passwords.rs.
//
//   node --import ./scripts/register-ts-paths.mjs server/parity/password-fixture.mjs \
//     > server/tests/fixtures/password_hashes.json
import bcrypt from "bcryptjs";
import { hashNewPassword, verifyStoredPassword } from "@/lib/auth/passwords";

const long = "x".repeat(70);
const cases = [];
async function add(note, password, hash, tried = [password]) {
  for (const attempt of tried) {
    const matches = await verifyStoredPassword(hash, attempt);
    cases.push({ note: `${note}: ${attempt === password ? "same" : "other"} password`, password: attempt, hash, matches });
  }
}

// better-auth's scrypt, as new accounts get it.
for (const [note, password] of [
  ["scrypt ascii", "correct horse battery"],
  ["scrypt korean", "비밀번호는열두자이상이에요"],
  ["scrypt full-width (NFKC)", "ｐａｓｓｗｏｒｄ１２３４"],
  ["scrypt 128 characters", "p".repeat(128)],
]) {
  await add(note, password, await hashNewPassword(password), [password, `${password}!`]);
}
// NFKC: the full-width password and its ASCII form are the same password.
await add("scrypt NFKC equivalence", "password1234", await hashNewPassword("ｐａｓｓｗｏｒｄ１２３４"));
// The key compared as written: an upper-case copy is another hash.
const upper = await hashNewPassword("correct horse battery");
const [salt, key] = upper.split(":");
await add("scrypt key in upper case", "correct horse battery", `${salt}:${key.toUpperCase()}`);
await add("scrypt with a third part", "correct horse battery", `${upper}:extra`);

// bcrypt from the previous store: bcryptjs computes the same for a, b and y;
// the prefix is kept in what it compares.
for (const [note, password] of [
  ["bcrypt ascii", "correct horse battery"],
  ["bcrypt korean", "비밀번호는열두자이상이에요"],
  ["bcrypt over 72 bytes", `${long}ab`],
]) {
  const made = bcrypt.hashSync(password, 4);
  for (const minor of ["a", "b", "y"]) {
    await add(`${note} $2${minor}$`, password, `$2${minor}$${made.slice(4)}`, [password, `${password}?`]);
  }
}
// Past 72 bytes bcrypt reads no further: another tail is the same password.
const truncated = bcrypt.hashSync(`${long}ab`, 4);
await add("bcrypt reads 72 bytes", `${long}abZZZ`, truncated);
await add("bcrypt cost 10", "correct horse battery", bcrypt.hashSync("correct horse battery", 10));
await add("bcrypt of another length", "correct horse battery", `${bcrypt.hashSync("correct horse battery", 4)}x`);

process.stdout.write(`${JSON.stringify(cases, null, 1)}\n`);
