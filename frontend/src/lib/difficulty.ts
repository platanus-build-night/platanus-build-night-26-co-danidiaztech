/**
 * Difficulty bands for the problem set.
 *
 * Ratings come straight from Codeforces (via the CodeContests dataset), where
 * the numbers are meaningful but opaque to anyone who hasn't internalised the
 * scale — "1500" says nothing on its own. Bucketing them gives the dashboard a
 * way to group, colour and sort problems by something a human can read.
 *
 * Bands follow the conventional CF tiers rather than even splits, so each one
 * corresponds to a real jump in technique rather than an arbitrary cut.
 */

export interface DifficultyBand {
  key: string;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  /** Theme token used for the band's dot/accent. */
  color: string;
  blurb: string;
}

export const DIFFICULTY_BANDS: DifficultyBand[] = [
  {
    key: "warmup",
    label: "Warm-up",
    min: 0,
    max: 1000,
    color: "var(--color-success)",
    blurb: "Direct implementation — get the loop right and you're done.",
  },
  {
    key: "easy",
    label: "Easy",
    min: 1001,
    max: 1300,
    color: "#38bdf8",
    blurb: "One idea, lightly hidden. Spot it and the code is short.",
  },
  {
    key: "medium",
    label: "Medium",
    min: 1301,
    max: 1600,
    color: "var(--color-accent)",
    blurb: "Interview territory — a real technique, applied cleanly.",
  },
  {
    key: "hard",
    label: "Hard",
    min: 1601,
    max: 1900,
    color: "var(--color-warning)",
    blurb: "Needs a proof sketch before you type, or you'll rewrite it.",
  },
  {
    key: "expert",
    label: "Expert",
    min: 1901,
    max: Number.MAX_SAFE_INTEGER,
    color: "var(--color-danger)",
    blurb: "Multi-step reasoning. Budget thinking time generously.",
  },
];

/** Falls back to the first band for unrated problems so nothing is ever orphaned. */
export function bandFor(rating: number | null | undefined): DifficultyBand {
  const r = rating ?? 0;
  return DIFFICULTY_BANDS.find((b) => r >= b.min && r <= b.max) ?? DIFFICULTY_BANDS[0];
}

export type SortKey = "difficulty" | "rating-desc" | "title" | "unsolved";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "difficulty", label: "Easiest first" },
  { key: "rating-desc", label: "Hardest first" },
  { key: "title", label: "A–Z" },
  { key: "unsolved", label: "Unsolved first" },
];

interface Sortable {
  title: string;
  rating: number | null;
  solved: boolean;
}

/** Comparator for the problem list. Ties always fall back to rating then title
 * so the order is stable and never jitters between renders. */
export function compareProblems<T extends Sortable>(sort: SortKey) {
  const byRating = (a: T, b: T) => (a.rating ?? 0) - (b.rating ?? 0);
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title);

  return (a: T, b: T): number => {
    switch (sort) {
      case "rating-desc":
        return -byRating(a, b) || byTitle(a, b);
      case "title":
        return byTitle(a, b);
      case "unsolved":
        return Number(a.solved) - Number(b.solved) || byRating(a, b) || byTitle(a, b);
      case "difficulty":
      default:
        return byRating(a, b) || byTitle(a, b);
    }
  };
}
