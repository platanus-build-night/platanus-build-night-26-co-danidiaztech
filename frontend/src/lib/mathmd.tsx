import { useMemo } from "react";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
// Self-hosted KaTeX CSS (bundled from node_modules by Vite, no CDN).
import "katex/dist/katex.min.css";
import "./mathmd.css";
import { normalizeMath } from "./normalizeMath";

/**
 * Shared prose renderer for problem statements, editorials, and analysis
 * text. Thin wrapper: `normalizeMath` (see normalizeMath.ts) does all the
 * actual text rewriting; this module only turns the result into HTML via
 * `marked` + KaTeX, plus a small bit of structural typography (bare
 * "Input"/"Output"/etc. lines become headings).
 */

// ---------------------------------------------------------------------------
// Markdown + KaTeX renderer (single shared instance, configured once).
// ---------------------------------------------------------------------------

const mathMarked = new Marked();
mathMarked.use(
  markedKatex({
    // normalizeMath fully controls where `$`/`$$` delimiters land, so we
    // don't need KaTeX's default whitespace-boundary heuristics — this lets
    // math sit directly against punctuation/parens without failing to match.
    nonStandard: true,
    throwOnError: false,
    strict: false,
  })
);
mathMarked.setOptions({ breaks: false, gfm: true });

// ---------------------------------------------------------------------------
// Structural cleanup — bare section-label lines become headings. This is a
// typography concern (not math), so it stays local to the render module
// rather than living in the source-agnostic normalizeMath pure function.
// ---------------------------------------------------------------------------

const SECTION_LABELS = [
  "Input",
  "Output",
  "Input Format",
  "Output Format",
  "Constraints",
  "Note",
  "Notes",
  "Example",
  "Examples",
  "Explanation",
];

const SECTION_LABEL_RE = new RegExp(`^(${SECTION_LABELS.join("|")})\\s*$`, "gm");

function promoteSectionHeadings(source: string): string {
  return source.replace(SECTION_LABEL_RE, "#### $1");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Tailwind arbitrary-child selectors give us a lightweight "prose" look
// without pulling in @tailwindcss/typography, which isn't installed.
const PROSE_CLASSES = [
  "mathmd text-sm leading-relaxed text-text [text-wrap:pretty]",
  "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:first:mt-0",
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:first:mt-0",
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_h4]:mb-1.5 [&_h4]:mt-4 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-accent [&_h4]:first:mt-0",
  "[&_p]:mb-3 [&_p]:last:mb-0",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_li]:leading-relaxed",
  "[&_li_p]:mb-0",
  "[&_code]:rounded [&_code]:bg-surface-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-alt [&_pre]:p-3",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-text-muted",
  "[&_a]:text-accent [&_a]:underline",
  "[&_strong]:font-semibold",
  "[&_hr]:my-4 [&_hr]:border-border",
].join(" ");

export interface MathMarkdownProps {
  source: string | null | undefined;
  className?: string;
}

/**
 * Renders dataset prose (problem statements, editorials, analysis text) as
 * typeset markdown with inline/display math. Shared by every prose surface —
 * do not duplicate this pipeline elsewhere.
 */
export function MathMarkdown({ source, className }: MathMarkdownProps) {
  const html = useMemo(() => {
    if (!source) return "";
    const prepared = normalizeMath(promoteSectionHeadings(source));
    return mathMarked.parse(prepared, { async: false }) as string;
  }, [source]);

  if (!source) return null;

  return (
    // Content is app-authored/DB-seeded (no user input), so we skip a
    // sanitizer dependency for this local single-user app.
    <div className={[PROSE_CLASSES, className].filter(Boolean).join(" ")} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
