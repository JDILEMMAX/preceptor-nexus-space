import { DOMAINS, type AnswerRecord, type DomainId, type Flashcard, type Question } from "./types";

export const PASS_MARK = 700;
export const WEAK_THRESHOLD = 0.7;
export const LEITNER_INTERVALS_DAYS = [1, 2, 4, 8, 16];
const DAY = 86_400_000;

export type DomainStats = Record<DomainId, { correct: number; total: number; accuracy: number }>;

/** Accuracy per domain from the most recent `window` answers in each domain. */
export function domainStats(answers: AnswerRecord[], window = 30): DomainStats {
  const out = {} as DomainStats;
  for (const d of DOMAINS) {
    const recent = answers.filter((a) => a.domain === d.id).slice(-window);
    const correct = recent.filter((a) => a.correct).length;
    out[d.id] = { correct, total: recent.length, accuracy: recent.length ? correct / recent.length : 0 };
  }
  return out;
}

/** Weighted readiness on Microsoft's 0–1000 scale. */
export function readinessScore(stats: DomainStats): number {
  const totalW = DOMAINS.reduce((s, d) => s + d.weight, 0);
  const v = DOMAINS.reduce((s, d) => s + d.weight * stats[d.id].accuracy, 0) / totalW;
  return Math.round(v * 1000);
}

export const isPassing = (score: number) => score >= PASS_MARK;

export const crossedPassingThreshold = (previous: number, current: number) => previous < PASS_MARK && current >= PASS_MARK;
export const completedPracticeMilestone = (total: number, answered: number) => total === 12 && answered === total;
export const completedDueReview = (dueIds: readonly string[], reviewedIds: ReadonlySet<string>) =>
  dueIds.length > 0 && dueIds.every((id) => reviewedIds.has(id));

export function weakDomains(stats: DomainStats): DomainId[] {
  return DOMAINS.filter((d) => stats[d.id].accuracy < WEAK_THRESHOLD).map((d) => d.id);
}

/* ---------- Leitner ---------- */
export function reviewCard(card: Flashcard, knewIt: boolean, now = Date.now()): Flashcard {
  if (!knewIt) return { ...card, box: 1, due: now + LEITNER_INTERVALS_DAYS[0]! * DAY };
  const box = Math.min(5, card.box + 1);
  return { ...card, box, due: now + LEITNER_INTERVALS_DAYS[box - 1]! * DAY };
}

export const isDue = (c: Flashcard, now = Date.now()) => c.due <= now;

export function reviewQueue(cards: Flashcard[], box: number | null, reviewedIds: ReadonlySet<string>, now = Date.now()) {
  return cards.filter((card) => !reviewedIds.has(card.id) && (box !== null ? card.box === box : isDue(card, now))).sort((a, b) => a.box - b.box);
}

export function addQuizRevision(cards: Flashcard[], question: Question, now = Date.now()): Flashcard[] {
  const id = `q-${question.id}`;
  if (cards.some((card) => card.id === id)) return cards;
  return [...cards, { id, domain: question.domain, front: question.prompt, back: `${question.options[question.answer]} — ${question.explanations[question.answer]}`, box: 1, due: now, source: "quiz" }];
}

export function newRevisionCount(cards: Flashcard[], originalIds: ReadonlySet<string>, questionIds: ReadonlySet<string>) {
  return cards.filter((card) => !originalIds.has(card.id) && questionIds.has(card.id)).length;
}

/* ---------- Planner ---------- */
export interface PlanSlot {
  id: string;
  date: string;
  kind: "study" | "mock" | "review";
  domain: DomainId | null;
  hours: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Domain priority = official weight boosted by how far below mastery it is. */
export function domainPriority(stats: DomainStats): Record<DomainId, number> {
  const out = {} as Record<DomainId, number>;
  for (const d of DOMAINS) out[d.id] = d.weight * (1 + (1 - stats[d.id].accuracy) * 2);
  return out;
}

export function generatePlan(
  examDate: string,
  hoursPerDay: number,
  stats: DomainStats,
  today: Date = new Date(),
): PlanSlot[] {
  const start = new Date(iso(today) + "T00:00:00Z");
  const end = new Date(examDate + "T00:00:00Z");
  const days = Math.min(90, Math.round((end.getTime() - start.getTime()) / DAY));
  if (days <= 0) return [];
  const pri = domainPriority(stats);
  const totalPri = Object.values(pri).reduce((a, b) => a + b, 0);
  const allocated: Record<DomainId, number> = { cloud: 0, architecture: 0, management: 0 };
  let totalAllocated = 0;
  const slots: PlanSlot[] = [];
  const perDay = Math.max(1, Math.round(hoursPerDay));

  for (let i = 0; i < days; i++) {
    const date = iso(new Date(start.getTime() + i * DAY));
    const isLast = i === days - 1;
    const hasMock = isLast || (i + 1) % 7 === 0;
    if (hasMock) {
      slots.push({ id: `${date}-mock`, date, kind: "mock", domain: null, hours: Math.min(perDay, 1) });
      if (isLast) continue;
    }
    const remainingHours = perDay - (hasMock ? 1 : 0);
    for (let h = 0; h < remainingHours; h++) {
      // pick the domain furthest behind its target share
      let best: DomainId = "architecture";
      let bestDeficit = -Infinity;
      for (const d of DOMAINS) {
        const target = (pri[d.id] / totalPri) * (totalAllocated + 1);
        const deficit = target - allocated[d.id];
        if (deficit > bestDeficit) { bestDeficit = deficit; best = d.id; }
      }
      allocated[best]++;
      totalAllocated++;
      slots.push({ id: `${date}-${h}`, date, kind: h === remainingHours - 1 && remainingHours > 1 ? "review" : "study", domain: best, hours: 1 });
    }
  }
  return slots;
}
