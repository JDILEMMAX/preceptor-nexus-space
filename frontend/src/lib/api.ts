/**
 * Centralized API client for Preceptor Nexus Space.
 * Reads VITE_API_URL from the Vite environment, defaulting to localhost.
 * All functions throw on non-OK responses so callers can catch and fall back.
 */

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface HealthData {
  status: string;
  uptime_seconds: number;
  database_active: boolean;
  total_questions: number;
}

export interface ApiQuestion {
  id: number;
  domain_id: number;
  domain_code: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

export interface AnswerSubmission {
  question_id: number;
  chosen_option: string;
}

export interface DomainBreakdown {
  domain_code: string;
  domain_title: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface ReviewItem {
  question_id: number;
  question_text: string;
  chosen_option: string;
  correct_option: string;
  explanation: string;
}

export interface EvaluationResult {
  scaled_score: number;
  percentage: number;
  passed: boolean;
  passing_mark: number;
  domain_breakdown: DomainBreakdown[];
  reviews: ReviewItem[];
}

export interface BuddyResponse {
  topic: string;
  azure_service: string;
  metaphor_title: string;
  analogy_text: string;
  source: "ai_generated" | "seed_fallback";
  raw_ai_text?: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json() as Promise<HealthData>;
}

export async function fetchQuestions(
  domain?: string,
  limit?: number,
): Promise<ApiQuestion[]> {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/api/questions${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Questions fetch failed: ${res.status}`);
  return res.json() as Promise<ApiQuestion[]>;
}

export async function postEvaluate(
  answers: AnswerSubmission[],
): Promise<EvaluationResult> {
  const res = await fetch(`${API_URL}/api/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(`Evaluate failed: ${res.status}`);
  return res.json() as Promise<EvaluationResult>;
}

export async function postBuddyExplain(query: string): Promise<BuddyResponse> {
  const res = await fetch(`${API_URL}/api/buddy/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Buddy explain failed: ${res.status}`);
  return res.json() as Promise<BuddyResponse>;
}
