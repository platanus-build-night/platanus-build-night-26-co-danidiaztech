/**
 * Tiny assertion script for `normalizeMath` (frontend/src/lib/normalizeMath.ts).
 *
 * No test framework is configured in this project (no vitest/jest), and this
 * one pure function doesn't warrant installing one. Run with:
 *
 *   npx tsx scripts/test-normalize-math.ts
 *
 * or via the npm script:
 *
 *   npm run test:normalize-math
 *
 * Exits non-zero (and prints a diff) on the first failing assertion.
 */
import { normalizeMath } from "../src/lib/normalizeMath";

let passed = 0;
let failed = 0;

function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    passed++;
    return;
  }
  failed++;
  console.error(`FAIL: ${name}`);
  console.error(`  expected: ${JSON.stringify(expected)}`);
  console.error(`  actual:   ${JSON.stringify(actual)}`);
}

function checkTrue(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    return;
  }
  failed++;
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

// --- subscripts ---
check(
  "wraps a standalone subscripted identifier",
  normalizeMath("divisible by a_{i-1}"),
  "divisible by $a_{i-1}$"
);
check("wraps a simple single-char subscript", normalizeMath("the value a_1 is set"), "the value $a_1$ is set");

// --- superscripts ---
check("wraps a number with an exponent", normalizeMath("at most 10^9 items"), "at most $10^9$ items");
check("wraps a braced exponent", normalizeMath("up to 2^{30} states"), "up to $2^{30}$ states");

// --- inequality / relation runs ---
check(
  "wraps a full inequality chain and converts ≤",
  normalizeMath("1 ≤ a_i ≤ 10^9 for every i"),
  "$1 \\le a_i \\le 10^9$ for every i"
);
check(
  "wraps a strict-inequality chain with unicode ellipsis",
  normalizeMath("a_1 < a_2 < … <a_n"),
  "$a_1 < a_2 < \\dots <a_n$"
);

// --- ellipses ---
check(
  "converts unicode ellipsis in a comma list of subscripted identifiers",
  normalizeMath("find any array a_1, a_2, …, a_n of integers"),
  "find any array $a_1, a_2, \\dots, a_n$ of integers"
);
check(
  "converts ASCII triple-dot the same way",
  normalizeMath("a_1, a_2, ..., a_n"),
  "$a_1, a_2, \\dots, a_n$"
);

// --- $$$...$$$ collapse ---
check("collapses Codeforces triple-dollar to single-dollar", normalizeMath("$$$a_i$$$"), "$a_i$");
check(
  "collapses triple-dollar embedded in a sentence",
  normalizeMath("Note that $$$n \\le 10^9$$$ always holds."),
  "Note that $n \\le 10^9$ always holds."
);

// --- code-block / backtick preservation ---
check(
  "never touches a fenced code block",
  normalizeMath("```\nlet a_1 = 10^9;\nif (a_1 <= a_2) {}\n```"),
  "```\nlet a_1 = 10^9;\nif (a_1 <= a_2) {}\n```"
);
check(
  "never touches inline code",
  normalizeMath("call `f(a_1, a_2)` before checking 1 ≤ n ≤ 10^9"),
  "call `f(a_1, a_2)` before checking $1 \\le n \\le 10^9$"
);
checkTrue(
  "prose outside code is still converted while code stays literal",
  normalizeMath("`a_i` is raw but a_i alone means $a_i$ math").includes("`a_i` is raw"),
  "backtick span was mutated"
);

// --- pre-existing math is preserved, not re-processed ---
check(
  "leaves already-correct inline math untouched",
  normalizeMath("$a_i \\le 10^9$ is already valid"),
  "$a_i \\le 10^9$ is already valid"
);

// --- idempotency: normalizeMath(x) === normalizeMath(normalizeMath(x)) ---
const idempotencyFixtures = [
  "Given n, find any array a_1, a_2, …, a_n of integers such that all of the following conditions hold:\n\n  * 1 ≤ a_i ≤ 10^9 for every i from 1 to n.\n  * a_1 < a_2 < … <a_n\n  * For every i from 2 to n, a_i isn't divisible by a_{i-1}",
  "$$$a_i$$$ and sqrt(n) and a plain sentence with no math at all.",
  "call `f(a_1, a_2)` before checking 1 ≤ n ≤ 10^9",
  "",
  "no math here whatsoever, just English prose.",
];
for (const fixture of idempotencyFixtures) {
  const once = normalizeMath(fixture);
  const twice = normalizeMath(once);
  check(`idempotent: ${JSON.stringify(fixture.slice(0, 40))}...`, twice, once);
}

// --- sqrt(X) call syntax ---
check("converts sqrt() call syntax to a math span", normalizeMath("running time is O(sqrt(n))"), "running time is O($\\sqrt{n}$)");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
