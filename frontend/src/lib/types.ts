// Mirrors backend/app/schemas.py — keep in sync with CONTRACTS.md.

export interface Sample {
  input: string;
  output: string;
}

export interface ProblemListItem {
  id: number;
  title: string;
  tags: string[];
  rating: number | null;
  solved: boolean;
}

export interface ProblemDetail {
  id: number;
  external_id: string;
  source: string;
  title: string;
  statement_md: string;
  tags: string[];
  rating: number | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  editorial_md: string | null;
  samples: Sample[];
}

export type SessionStatus = "active" | "finished";

export interface SessionListItem {
  id: number;
  problem_id: number;
  language: string;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
}

export interface EventOut {
  id: number;
  t_ms: number;
  kind: EventKind;
  payload: Record<string, unknown>;
}

export interface SessionDetail extends SessionListItem {
  events: EventOut[];
}

export type EventKind =
  | "code_snap"
  | "transcript"
  | "draw_snap"
  | "note_snap"
  | "run"
  | "submit";

export interface EventIn {
  t_ms: number;
  kind: EventKind;
  payload: Record<string, unknown>;
}

export interface RunResult {
  verdict: Verdict;
  time_ms: number;
  stdout: string;
  expected: string;
  compile_error?: string | null;
}

export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";

export interface SubmitResult {
  verdict: Verdict;
  per_test: Array<Record<string, unknown>>;
  time_ms: number;
}

export interface Recommendation {
  problem: ProblemListItem;
  score: number;
  why: string[];
}

export interface Phase {
  label: "reading" | "thinking" | "coding" | "debugging" | "stuck";
  startSec: number;
  endSec: number;
  note: string;
}

export interface Marker {
  kind: "aha" | "hesitation" | "wrong-turn";
  atSec: number;
  quote: string;
  note: string;
}

export interface Drill {
  title: string;
  why: string;
}

export interface EditorialGap {
  missedInsight: string;
  fasterPath: string;
  profileAdvice: string;
}

export interface AnalysisResult {
  summary: string;
  phases: Phase[];
  markers: Marker[];
  ahaMomentSec: number | null;
  firstCorrectCodeSec: number | null;
  ahaGapSeconds: number | null;
  bottleneck: string;
  strengths: string[];
  drills: Drill[];
  editorialGap: EditorialGap;
}

export interface ProfileOut {
  data: Record<string, unknown>;
}

export interface SessionAnalysisOut {
  result: AnalysisResult;
  created_at: string;
}

export type SettingsProvider = "api" | "plan" | "mock";

export interface SettingsOut {
  provider: SettingsProvider;
  model: string;
  api_key_masked: string | null;
  oauth_token_masked: string | null;
  status: string;
}

export interface SettingsUpdate {
  provider?: SettingsProvider;
  api_key?: string;
  oauth_token?: string;
  model?: string;
}

export interface SettingsTestResult {
  ok: boolean;
  provider: string;
  model: string | null;
  error: string | null;
}
