const stripAnsi = (text) => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
const redact = (text) => text
  .replace(/\b(postgres(?:ql)?:\/\/)[^\s"'@]+@/gi, "$1[redacted]@")
  .replace(/\b(authorization:\s*bearer\s+)\S+/gi, "$1[redacted]");
const testFailure = /^(?:not ok\b|✗|✘|×\s|FAIL\s|test\s.+\sFAILED\b|---- .+ stdout ----|\[chromium\].*›)/i;
const errorLine = /\berror(?:\[[^\]]+\])?\s*:|\b(?:error TS\d+|\w+Error\b|panicked at|assertion .+ failed|command not found|timed out|ENOENT|EACCES)/i;
const location = /(?:[\w./@+-]+\.[\w]+:\d+|[\w./@+-]+\.[\w]+\(\d+,\d+\))/;

export function summarizeFailure(output, { worktree, limit = 12 } = {}) {
  const clean = redact(stripAnsi(output)).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
  const lines = clean.split("\n").map((line) => (
    (worktree ? line.replaceAll(`${worktree}/`, "") : line).trim().slice(0, 350)
  )).filter(Boolean);
  const unique = (items) => [...new Set(items)];
  const targeted = unique([
    ...lines.filter((line) => testFailure.test(line)).slice(0, 4),
    ...lines.filter((line) => errorLine.test(line)).slice(0, 4),
    ...lines.filter((line) => location.test(line)).slice(0, 4),
  ]);
  return (targeted.length ? targeted : unique(lines.slice(-limit))).slice(0, limit);
}
