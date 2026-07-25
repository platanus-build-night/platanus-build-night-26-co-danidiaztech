import type {
  AnalysisResult,
  EventIn,
  ProblemDetail,
  ProblemListItem,
  ProblemMeta,
  ProfileOut,
  Recommendation,
  CustomRunResult,
  RunResult,
  SessionAnalysisOut,
  SessionCreated,
  SessionDetail,
  SessionListItem,
  SettingsOut,
  SettingsTestResult,
  SettingsUpdate,
  SubmitResult,
} from "./types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ProblemFilters {
  tag?: string;
  min_rating?: number;
  max_rating?: number;
  q?: string;
}

function toQuery(params: object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  listProblems: (filters: ProblemFilters = {}) =>
    request<ProblemListItem[]>(`/problems${toQuery(filters)}`),

  getProblem: (id: number) => request<ProblemDetail>(`/problems/${id}`),

  /** Pre-flight-safe subset (no statement/samples/editorial/tags) — the
   * only thing the solve page may fetch before a session exists. */
  getProblemMeta: (id: number) => request<ProblemMeta>(`/problems/${id}/meta`),

  getRecommendations: () => request<Recommendation[]>("/recommendations"),

  /** The one call that hands back the full problem statement — gated
   * behind the user's pre-flight recording choice. */
  createSession: (problem_id: number, language: string, record_voice: boolean) =>
    request<SessionCreated>("/sessions", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, record_voice }),
    }),

  postEvents: (sessionId: number, events: EventIn[]) =>
    request<{ ok: boolean; count: number }>(`/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
    }),

  finishSession: (sessionId: number) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/finish`, { method: "POST" }),

  patchSessionLanguage: (sessionId: number, language: string) =>
    request<SessionListItem>(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ language }),
    }),

  listSessions: () => request<SessionListItem[]>("/sessions"),

  getSession: (id: number) => request<SessionDetail>(`/sessions/${id}`),

  run: (problem_id: number, language: string, code: string) =>
    request<RunResult[]>("/run", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, code }),
    }),

  runCustom: (
    problem_id: number,
    language: string,
    code: string,
    stdin: string,
    expected?: string
  ) =>
    request<CustomRunResult>("/run-custom", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, code, stdin, expected: expected || null }),
    }),

  submit: (problem_id: number, language: string, code: string, session_id?: number) =>
    request<SubmitResult>("/submit", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, code, session_id }),
    }),

  analyzeSession: (sessionId: number) =>
    request<AnalysisResult>(`/sessions/${sessionId}/analyze`, { method: "POST" }),

  getPersistedAnalysis: (sessionId: number) =>
    request<SessionAnalysisOut>(`/sessions/${sessionId}/analysis`),

  getProfile: () => request<ProfileOut>("/profile"),

  getSettings: () => request<SettingsOut>("/settings"),

  updateSettings: (payload: SettingsUpdate) =>
    request<SettingsOut>("/settings", { method: "PUT", body: JSON.stringify(payload) }),

  testSettings: () => request<SettingsTestResult>("/settings/test", { method: "POST" }),
};
