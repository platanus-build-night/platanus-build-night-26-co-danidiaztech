/**
 * normalizeMath — pure, synchronous, regex-only text transform.
 *
 * No AI, no network, no React/DOM. Converts CodeContests/Codeforces-style
 * plain-text math ("a_i", "10^9", unicode "≤"/"…", the "$$$x$$$"
 * triple-dollar convention) into standard `$...$` inline LaTeX math spans
 * that any KaTeX-aware markdown renderer can typeset.
 *
 * Import this anywhere prose needs math-aware cleanup — it has zero
 * dependency on how the result gets rendered. `frontend/src/lib/mathmd.tsx`
 * is the only consumer today (it feeds the output to `marked` + KaTeX), but
 * nothing here assumes that.
 *
 * SAFETY: fenced code blocks, inline code spans, and any math the source
 * already wrote correctly (`$...$`, `$$...$$`) are protected before any rule
 * runs and restored verbatim afterwards — rules below never see or touch
 * them. When a rule isn't sure a span is math, it leaves the text alone;
 * a wrong-but-readable render beats a broken one.
 */

// ---------------------------------------------------------------------------
// Symbol table — unicode/ASCII math notation -> LaTeX command.
// Exported so the mapping is inspectable/extendable without reading regexes.
// ---------------------------------------------------------------------------

export interface MathSymbolRule {
  /** Source character/sequence as it appears in the dataset. */
  symbol: string;
  /** LaTeX replacement (space-padded so it stays valid next to identifiers). */
  latex: string;
  /** "before -> after" example, inside an already-opened math span. */
  example: string;
}

export const MATH_SYMBOL_TABLE: readonly MathSymbolRule[] = [
  { symbol: "≤", latex: "\\le ", example: "1 ≤ n -> 1 \\le n" },
  { symbol: "≥", latex: "\\ge ", example: "n ≥ 1 -> n \\ge 1" },
  { symbol: "≠", latex: "\\ne ", example: "a ≠ b -> a \\ne b" },
  { symbol: "…", latex: "\\dots ", example: "a_1, …, a_n -> a_1, \\dots, a_n" },
  { symbol: "...", latex: "\\dots ", example: "a_1, ..., a_n -> a_1, \\dots, a_n" },
  // U+22C5 DOT OPERATOR — the dataset's actual "times" glyph (far more common
  // here than U+00B7 MIDDLE DOT, which some problems also use for the same thing).
  { symbol: "⋅", latex: "\\cdot ", example: "n ⋅ m -> n \\cdot m" },
  { symbol: "·", latex: "\\cdot ", example: "a · b -> a \\cdot b" },
  { symbol: "×", latex: "\\times ", example: "n × m -> n \\times m" },
  { symbol: "→", latex: "\\to ", example: "a → b -> a \\to b" },
  { symbol: "⇒", latex: "\\Rightarrow ", example: "a ⇒ b -> a \\Rightarrow b" },
  // U+2212 MINUS SIGN (distinct from the ASCII hyphen, and from the prose
  // em/en dashes "—"/"–", which are deliberately left untouched).
  { symbol: "−", latex: "- ", example: "a_i − 1 -> a_i - 1" },
  { symbol: "±", latex: "\\pm ", example: "n ± 1 -> n \\pm 1" },
  { symbol: "∈", latex: "\\in ", example: "i ∈ S -> i \\in S" },
  { symbol: "∪", latex: "\\cup ", example: "A ∪ B -> A \\cup B" },
  { symbol: "⊕", latex: "\\oplus ", example: "a ⊕ b -> a \\oplus b" },
  { symbol: "⌊", latex: "\\lfloor ", example: "⌊ n/2 ⌋ -> \\lfloor n/2 \\rfloor" },
  { symbol: "⌋", latex: "\\rfloor ", example: "(see ⌊ above)" },
  { symbol: "⌈", latex: "\\lceil ", example: "⌈ n/2 ⌉ -> \\lceil n/2 \\rceil" },
  { symbol: "⌉", latex: "\\rceil ", example: "(see ⌈ above)" },
];

function convertSymbols(mathText: string): string {
  let out = mathText;
  for (const rule of MATH_SYMBOL_TABLE) {
    out = out.split(rule.symbol).join(rule.latex);
  }
  // `rule.latex` always carries a trailing space (LaTeX command names are
  // alphabetic and would otherwise swallow a following letter, e.g. "\lea_i"),
  // which can leave doubled whitespace or a stray space before punctuation
  // when the source already had spacing of its own — tidy that up.
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ ,/g, ",")
    .trim();
}

// ---------------------------------------------------------------------------
// Token grammar used by the run/lone-atom rules below.
// ---------------------------------------------------------------------------

// Braced subscript/superscript body: identifiers, digits, +/-, and spaces
// (the dataset writes both "a_{i-1}" and "a_{l + 1}" — spaced out).
const BRACED_GROUP = String.raw`\{[A-Za-z0-9+\- ]+\}`;
/** Identifier with an explicit subscript and/or superscript: a_1, a_i, a_{i-1}, x_{l + 1}, n^2. */
const IDENT_SUB = String.raw`[A-Za-z][A-Za-z0-9]*(?:_(?:${BRACED_GROUP}|[A-Za-z0-9])|\^(?:${BRACED_GROUP}|[A-Za-z0-9]))+`;
/** Number with an explicit exponent: 10^9, 2^{30}. */
const NUMBER_POW = String.raw`[0-9]+\^(?:${BRACED_GROUP}|[A-Za-z0-9]+)`;
/**
 * A LaTeX macro span already produced by an earlier prose->macro rule
 * (sqrt-call-to-macro, floor/ceil-brackets-to-macro, below) — treated as one
 * qualifying atom so it can join a run or stand alone like any identifier.
 */
const MACRO_ATOM = String.raw`\\sqrt\{[^{}]+\}|\\lfloor[\s\S]*?\\rfloor|\\lceil[\s\S]*?\\rceil`;
/** Ellipsis, unicode or ASCII triple-dot. */
const ELLIPSIS = String.raw`…|\.\.\.`;
/** Bare integer/decimal — only ever wrapped when chained with a qualifying neighbor (see runQualifies). */
const PLAIN_NUM = String.raw`[0-9]+(?:\.[0-9]+)?`;
/**
 * Bare single-letter variable (t, n, m, k, i, j, …) with no subscript — only
 * usable as a chain member (never alone: see LONE_PATTERN), since a RUN
 * requires an adjacent relation operator or comma-list, and single-letter
 * "words" essentially never appear next to those in ordinary English prose.
 * Word-boundary-anchored so it matches a standalone letter only — never the
 * first letter of a longer word (e.g. the "a" in "and").
 */
const PLAIN_IDENT = String.raw`\b[A-Za-z]\b`;
/** Relation/operator symbols that justify treating a chain as math. */
const RELOP = String.raw`≤|≥|≠|<|>|=|·|×|→|⋅|⇒|−|±|∈|∪|⊕`;

const ATOM = `(?:${NUMBER_POW})|(?:${IDENT_SUB})|(?:${MACRO_ATOM})|(?:${ELLIPSIS})|(?:${PLAIN_NUM})|(?:${PLAIN_IDENT})`;
const CONNECTOR = String.raw`(?:\s*(?:${RELOP})\s*|,\s+)`;
/** Chain of >=2 atoms joined by relation operators or comma-lists. */
const RUN_PATTERN = `(?:${ATOM})(?:${CONNECTOR}(?:${ATOM}))+`;
/** A standalone atom that is math-y on its own, not part of a chain. */
const LONE_PATTERN = `(?:${NUMBER_POW})|(?:${IDENT_SUB})|(?:${MACRO_ATOM})`;
// Single pass so a run and its member atoms are never matched twice (which
// would double-wrap, e.g. "$1 \le $a_i$ \le $10^9$$"). Alternation tries the
// (longer) run pattern first at each position; only falls back to the lone
// pattern when no chain starts there.
const RUN_OR_LONE_RE = new RegExp(`(?<run>${RUN_PATTERN})|(?<lone>${LONE_PATTERN})`, "g");

function runQualifies(run: string): boolean {
  return (
    new RegExp(RELOP).test(run) ||
    /…|\.\.\./.test(run) ||
    new RegExp(IDENT_SUB).test(run) ||
    new RegExp(NUMBER_POW).test(run) ||
    new RegExp(MACRO_ATOM).test(run)
  );
}

function combinedRunOrLoneRule(text: string): string {
  return text.replace(RUN_OR_LONE_RE, (match, run: string | undefined) => {
    if (run !== undefined) {
      // Matched as a chain — only wrap if something in it actually justifies math.
      return runQualifies(run) ? `$${convertSymbols(run)}$` : run;
    }
    // Matched as a lone atom — the pattern itself only matches qualifying atoms.
    return `$${convertSymbols(match)}$`;
  });
}

// ---------------------------------------------------------------------------
// The rule table. Ordered — later rules run on the output of earlier ones.
// Add a rule by appending `{ name, description, example, apply }`; keep it a
// pure `(text: string) => string` with no shared mutable state.
// ---------------------------------------------------------------------------

export interface NormalizeRule {
  name: string;
  description: string;
  /** "before -> after" example of the rule firing. */
  example: string;
  apply: (text: string) => string;
}

// Runs BEFORE code/math protection: it must see the source's raw `$$$...$$$`
// so the collapsed `$...$` result is itself recognized as "already math" and
// protected from every rule below (never re-processed, never double-wrapped).
export const PRE_PROTECTION_RULES: readonly NormalizeRule[] = [
  {
    name: "collapse-triple-dollar",
    description: "Codeforces' `$$$x$$$` inline-math convention collapses to standard `$x$`.",
    example: "$$$a_i$$$ -> $a_i$",
    apply: (text) => text.replace(/\$\$\$([^$]+?)\$\$\$/g, (_m, inner: string) => `$${inner}$`),
  },
];

const SUPERSCRIPT_DIGIT_TO_ASCII: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};
// Runs AFTER code/math protection, in order, on whatever plain prose remains.
export const POST_PROTECTION_RULES: readonly NormalizeRule[] = [
  {
    name: "sqrt-call-to-macro",
    description: "`sqrt(X)` function-call syntax becomes the `\\sqrt{X}` LaTeX macro (unwrapped; a later rule adds `$...$`).",
    example: "sqrt(n) -> \\sqrt{n}",
    apply: (text) =>
      text.replace(/\bsqrt\(([^()\n]+)\)/gi, (_m, inner: string) => `\\sqrt{${inner.trim()}}`),
  },
  {
    name: "floor-ceil-brackets-to-macro",
    description:
      "Unicode floor/ceiling bracket pairs `⌊X⌋` / `⌈X⌉` become the `\\lfloor X\\rfloor` / `\\lceil X\\rceil` LaTeX macros (unwrapped; a later rule adds `$...$`).",
    example: "⌊ n/2 ⌋ -> \\lfloor n/2\\rfloor",
    apply: (text) =>
      text
        .replace(/⌊\s*([^⌊⌋⌈⌉\n]+?)\s*⌋/g, (_m, inner: string) => `\\lfloor ${inner}\\rfloor`)
        .replace(/⌈\s*([^⌊⌋⌈⌉\n]+?)\s*⌉/g, (_m, inner: string) => `\\lceil ${inner}\\rceil`),
  },
  {
    name: "superscript-digits-to-caret",
    description:
      "A unicode superscript digit run (as in Codeforces' \"O(n²)\" complexity notation) directly after an identifier/number/closing-paren becomes ASCII `^` exponent syntax, so the next rule picks it up as a normal power.",
    example: "O(n²) -> O(n^2)",
    apply: (text) =>
      text.replace(/([A-Za-z0-9)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, base: string, sup: string) => {
        const digits = [...sup].map((d) => SUPERSCRIPT_DIGIT_TO_ASCII[d] ?? d).join("");
        return digits.length > 1 ? `${base}^{${digits}}` : `${base}^${digits}`;
      }),
  },
  {
    name: "relation-and-list-runs-or-lone-atoms",
    description:
      "Single pass, two behaviors, tried in this order at every position so a chain and its member atoms are never matched (and wrapped) twice: " +
      "(a) a chain of >=2 math atoms (identifiers, numbers, ellipsis, macro atoms) joined by relation/set operators (≤ ≥ ≠ < > = · × ⋅ → ⇒ − ± ∈ ∪ ⊕) or comma-lists wraps as ONE inline math span; " +
      "(b) failing that, a standalone identifier-with-subscript/superscript, exponentiated number, or macro atom (\\sqrt{}/\\lfloor⌋/\\lceil⌉) wraps on its own. Symbols convert via MATH_SYMBOL_TABLE.",
    example: "1 ≤ a_i ≤ 10^9 -> $1 \\le a_i \\le 10^9$   |   divisible by a_{i-1} -> divisible by $a_{i-1}$",
    apply: combinedRunOrLoneRule,
  },
];

/** Full pipeline in execution order — for documentation/inspection only. */
export const MATH_NORMALIZE_RULES: readonly NormalizeRule[] = [
  ...PRE_PROTECTION_RULES,
  ...POST_PROTECTION_RULES,
];

// ---------------------------------------------------------------------------
// Content protection: never let the rules above see fenced code, inline
// code, or math the source already wrote correctly. Restored verbatim.
// ---------------------------------------------------------------------------

interface Protected {
  token: string;
  value: string;
}

const PLACEHOLDER_PREFIX = " MATHMD";

function protect(text: string, regex: RegExp, store: Protected[]): string {
  return text.replace(regex, (match) => {
    const token = `${PLACEHOLDER_PREFIX}${store.length} `;
    store.push({ token, value: match });
    return token;
  });
}

function restoreProtected(text: string, store: Protected[]): string {
  let out = text;
  for (let i = store.length - 1; i >= 0; i--) {
    out = out.split(store[i].token).join(store[i].value);
  }
  return out;
}

/**
 * Runs the full math-normalization pipeline. Idempotent: `normalizeMath(x)
 * === normalizeMath(normalizeMath(x))`, because a second pass finds only
 * already-correct `$...$` math (protected verbatim) and unmodified prose.
 */
export function normalizeMath(source: string): string {
  if (!source) return source;

  const store: Protected[] = [];
  let text = source;

  // 1. Protect fenced code blocks and inline code — never touch code.
  text = protect(text, /```[\s\S]*?```/g, store);
  text = protect(text, /`[^`\n]+`/g, store);

  // 2. Collapse Codeforces' `$$$x$$$` to `$x$` before protecting math, so
  //    triple-dollar spans are recognized as "already math" below too.
  for (const rule of PRE_PROTECTION_RULES) text = rule.apply(text);

  // 3. Protect any math the source already wrote correctly — a later rule
  //    must never re-process or double-wrap it.
  text = protect(text, /\$\$[\s\S]+?\$\$/g, store);
  text = protect(text, /\$[^$\n]+?\$/g, store);

  // 4. Run the remaining conversion rules in order.
  for (const rule of POST_PROTECTION_RULES) text = rule.apply(text);

  return restoreProtected(text, store);
}
