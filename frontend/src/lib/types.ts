export type DomainId = "cloud" | "architecture" | "management";

export interface Domain {
  id: DomainId;
  name: string;
  short: string;
  range: string;
  /** midpoint of the official weighting range, as a fraction */
  weight: number;
}

export const DOMAINS: Domain[] = [
  { id: "cloud", name: "Cloud Concepts", short: "Cloud", range: "25–30%", weight: 0.275 },
  { id: "architecture", name: "Azure Architecture & Services", short: "Architecture", range: "35–40%", weight: 0.375 },
  { id: "management", name: "Azure Management & Governance", short: "Governance", range: "30–35%", weight: 0.325 },
];

export const domainById = (id: DomainId) => DOMAINS.find((d) => d.id === id)!;

export interface Question {
  id: string;
  domain: DomainId;
  topic: string;
  prompt: string;
  options: string[];
  answer: number;
  explanations: string[];
}

export interface AnswerRecord {
  questionId: string;
  domain: DomainId;
  correct: boolean;
  at: number;
}

export interface Attempt {
  id: string;
  at: number;
  domain: DomainId | "mixed";
  correct: number;
  total: number;
}

export interface Flashcard {
  id: string;
  domain: DomainId;
  front: string;
  back: string;
  box: number; // 1..5
  due: number; // epoch ms
  source: "starter" | "quiz";
}

export interface PlanSettings {
  examDate: string | null; // yyyy-mm-dd
  hoursPerDay: number;
  done: string[]; // slot ids
}

export interface ChatMessage {
  id: string;
  role: "user" | "buddy";
  text: string;
}

export interface AppState {
  answers: AnswerRecord[];
  attempts: Attempt[];
  cards: Flashcard[];
  plan: PlanSettings;
  bookmarks: string[];
  chat: ChatMessage[];
}
