import type {
  AnalysisResult,
  EventIn,
  ProblemDetail,
  ProblemListItem,
  ProfileOut,
  Recommendation,
  RunResult,
  SessionDetail,
  SessionListItem,
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

  getRecommendations: () => request<Recommendation[]>("/recommendations"),

  createSession: (problem_id: number, language: string) =>
    request<{ id: number }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ problem_id, language }),
    }),

  postEvents: (sessionId: number, events: EventIn[]) =>
    request<{ ok: boolean; count: number }>(`/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
    }),

  finishSession: (sessionId: number) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/finish`, { method: "POST" }),

  listSessions: () => request<SessionListItem[]>("/sessions"),

  getSession: (id: number) => request<SessionDetail>(`/sessions/${id}`),

  run: (problem_id: number, language: string, code: string) =>
    request<RunResult[]>("/run", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, code }),
    }),

  submit: (problem_id: number, language: string, code: string, session_id?: number) =>
    request<SubmitResult>("/submit", {
      method: "POST",
      body: JSON.stringify({ problem_id, language, code, session_id }),
    }),

  analyzeSession: (sessionId: number) =>
    request<AnalysisResult>(`/sessions/${sessionId}/analyze`, { method: "POST" }),

  getProfile: () => request<ProfileOut>("/profile"),
};
