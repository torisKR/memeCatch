// lib/actions/admin-users.ts: setUserPassword, sendPasswordReset, setUserRole.
import { psql, sqlText } from "../harness.mjs";

const FILE = "lib/actions/admin-users.ts";
const NO_ACCOUNT = "00000000-0000-4000-8000-0000000000ff";
const NO_ADDRESS = "nobody@example.com";
const NOT_ADDRESS = "not-an-email";

export function cases(ctx) {
  const target = ctx.newAccount("user");
  const operator = ctx.sessions.operator;
  const page = `/admin/users/${target.userId}`;
  const id = sqlText(target.userId);
  const email = psql(`select email from "user" where id = ${id}`);
  const about = `entity_id in (${id}, 'nope', ${sqlText(NO_ACCOUNT)}) or detail->>'email' in (${[email, email.toUpperCase(), NO_ADDRESS, NOT_ADDRESS].map(sqlText).join(", ")})`;
  // Every audit row about the account or the addresses, as it reads back.
  const audit = `select coalesce(json_agg(json_build_object('actor', actor_id = ${sqlText(operator.userId)}, 'action', action,
      'type', entity_type, 'entity', entity_id, 'detail', detail) order by id), '[]')
    from admin_audit_log where ${about}`;
  const clearAudit = `delete from admin_audit_log where ${about};`;
  const base = { file: FILE, page };

  const role = (name, input) => ({
    ...base,
    name,
    action: "setUserRole",
    endpoint: "user-role",
    input,
    setup: () => `${clearAudit} update profiles set role = 'user' where id = ${id}; update profiles set role = 'operator' where id = ${sqlText(operator.userId)};`,
    rows: () => `select json_build_object('target', (select role from profiles where id = ${id}),
      'operator', (select role from profiles where id = ${sqlText(operator.userId)}), 'audit', (${audit}))`,
  });
  const password = (name, input) => ({
    ...base,
    name,
    action: "setUserPassword",
    endpoint: "user-password",
    input,
    setup: () => `${clearAudit} update account set password = 'before' where "userId" = ${id};`,
    // A new hash is salted: whether it changed, and that it has scrypt's form.
    rows: () => `select json_build_object('password', (select case when password = 'before' then 'unchanged'
        when password ~ '^[0-9a-f]{32}:[0-9a-f]{128}$' then 'scrypt' else password end
        from account where "userId" = ${id} and "providerId" = 'credential'), 'audit', (${audit}))`,
  });
  const reset = (name, address) => ({
    ...base,
    name,
    action: "sendPasswordReset",
    endpoint: "user-reset",
    input: address,
    setup: () => `${clearAudit} delete from verification where value = ${id} and identifier like 'reset-password:%';`,
    rows: () => `select json_build_object('tokens', (select count(*) from verification where value = ${id}
        and identifier ~ '^reset-password:[A-Za-z0-9]{24}$'
        and "expiresAt" between now() + interval '59 minutes' and now() + interval '61 minutes'), 'audit', (${audit}))`,
  });

  return [
    role("setUserRole to operator", { userId: target.userId, role: "operator" }),
    role("setUserRole to user", { userId: target.userId, role: "user" }),
    role("setUserRole, a role the enum lacks", { userId: target.userId, role: "admin" }),
    role("setUserRole, an id that is not a uuid", { userId: "nope", role: "operator" }),
    role("setUserRole, the operator's own role", { userId: operator.userId, role: "user" }),
    role("setUserRole, the operator keeps their own role", { userId: operator.userId, role: "operator" }),
    password("setUserPassword", { userId: target.userId, password: "new-password-1" }),
    password("setUserPassword, seven characters", { userId: target.userId, password: "1234567" }),
    password("setUserPassword, eight UTF-16 units", { userId: target.userId, password: "비밀번호비밀번호" }),
    password("setUserPassword, no such account", { userId: NO_ACCOUNT, password: "new-password-1" }),
    password("setUserPassword, an id that is not a uuid", { userId: "nope", password: "new-password-1" }),
    reset("sendPasswordReset", email),
    reset("sendPasswordReset, the address in capitals", email.toUpperCase()),
    reset("sendPasswordReset, no such account", NO_ADDRESS),
    reset("sendPasswordReset, not an address", NOT_ADDRESS),
  ];
}
