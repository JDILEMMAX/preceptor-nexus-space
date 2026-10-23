import { describe, expect, it } from "vitest";
import { addQuizRevision, completedDueReview, completedPracticeMilestone, crossedPassingThreshold, domainStats, generatePlan, isPassing, newRevisionCount, readinessScore, reviewCard, reviewQueue, weakDomains } from "./logic";
import { QUESTIONS } from "./data/questions";
import type { AnswerRecord, Flashcard } from "./types";

const ans = (domain: AnswerRecord["domain"], correct: boolean): AnswerRecord => ({ questionId: "x", domain, correct, at: 0 });

describe("readiness", () => {
  it("700 is the passing mark", () => {
    expect(isPassing(700)).toBe(true);
    expect(isPassing(699)).toBe(false);
  });
  it("all correct scores 1000, none answered scores 0", () => {
    const all = [ans("cloud", true), ans("architecture", true), ans("management", true)];
    expect(readinessScore(domainStats(all))).toBe(1000);
    expect(readinessScore(domainStats([]))).toBe(0);
  });
  it("flags domains under 70% as weak", () => {
    const s = domainStats([ans("cloud", true), ans("architecture", false), ans("management", true)]);
    expect(weakDomains(s)).toEqual(["architecture"]);
  });
  it("normalises the three official domain weights on the 0–1000 scale", () => {
    expect(readinessScore(domainStats([ans("cloud", true)]))).toBe(282);
    expect(readinessScore(domainStats([ans("architecture", true)]))).toBe(385);
    expect(readinessScore(domainStats([ans("management", true)]))).toBe(333);
  });
});

describe("leitner", () => {
  const card: Flashcard = { id: "c", domain: "cloud", front: "", back: "", box: 2, due: 0, source: "quiz" };
  it("correct promotes one box, capped at 5", () => {
    expect(reviewCard(card, true, 0).box).toBe(3);
    expect(reviewCard({ ...card, box: 5 }, true, 0).box).toBe(5);
  });
  it("missed returns the card to box 1, due in 1 day", () => {
    const r = reviewCard(card, false, 0);
    expect(r.box).toBe(1);
    expect(r.due).toBe(86_400_000);
  });
  it.each([[1, false], [5, true]] as const)("advances early box %i review after a same-box result", (box, knew) => {
    const first = { ...card, id: "a", box };
    const second = { ...card, id: "b", box };
    const reviewed = reviewCard(first, knew, 0);
    expect(reviewed.box).toBe(box);
    expect(reviewQueue([reviewed, second], box, new Set(["a"]), 0).map((item) => item.id)).toEqual(["b"]);
    expect(reviewQueue([reviewed, second], box, new Set(["a", "b"]), 0)).toEqual([]);
    expect(reviewQueue([reviewed, second], box, new Set(), 0)).toHaveLength(2);
  });
  it.each([[1, 2, 2], [2, 3, 4], [3, 4, 8], [4, 5, 16], [5, 5, 16]])("promotes box %i to %i with a %i-day interval", (from, to, days) => {
    const result = reviewCard({ ...card, box: from }, true, 1000);
    expect(result.box).toBe(to);
    expect(result.due).toBe(1000 + days * 86_400_000);
  });
});

describe("celebration milestones", () => {
  it("celebrates only completion of an entire 12-question practice session", () => {
    expect(completedPracticeMilestone(12, 12)).toBe(true);
    expect(completedPracticeMilestone(12, 1)).toBe(false);
    expect(completedPracticeMilestone(12, 11)).toBe(false);
    expect(completedPracticeMilestone(10, 10)).toBe(false);
  });
  it("celebrates crossing 700, not remaining above it or falling below it", () => {
    expect(crossedPassingThreshold(699, 700)).toBe(true);
    expect(crossedPassingThreshold(650, 720)).toBe(true);
    expect(crossedPassingThreshold(700, 750)).toBe(false);
    expect(crossedPassingThreshold(720, 699)).toBe(false);
    expect(crossedPassingThreshold(600, 699)).toBe(false);
  });
  it("celebrates only after all due cards in a nonempty session have been reviewed", () => {
    expect(completedDueReview(["a", "b"], new Set(["a"]))).toBe(false);
    expect(completedDueReview(["a", "b"], new Set(["a", "b"]))).toBe(true);
    expect(completedDueReview([], new Set())).toBe(false);
    expect(completedDueReview(["a"], new Set(["not-due"]))).toBe(false);
  });
});

describe("planner", () => {
  it.each([1, 2, 4, 6])("never schedules more than %i hours on any day, including weekly mocks", (hours) => {
    const slots = generatePlan("2026-11-20", hours, domainStats([]), new Date("2026-10-23T00:00:00Z"));
    const mockDay = slots.filter((slot) => slot.date === "2026-10-29");
    expect(mockDay.reduce((sum, slot) => sum + slot.hours, 0)).toBe(hours);
    for (const date of new Set(slots.map((slot) => slot.date))) {
      expect(slots.filter((slot) => slot.date === date).reduce((sum, slot) => sum + slot.hours, 0)).toBeLessThanOrEqual(hours);
    }
  });
  it("adds more daily study slots when hours rise from 1 to 4", () => {
    const stats = domainStats([]);
    const today = new Date("2026-10-23T00:00:00Z");
    const one = generatePlan("2026-10-26", 1, stats, today);
    const four = generatePlan("2026-10-26", 4, stats, today);
    expect(one).toHaveLength(3);
    expect(four).toHaveLength(9);
    expect(four.filter((slot) => slot.date === "2026-10-23")).toHaveLength(4);
    expect(four.at(-1)).toMatchObject({ date: "2026-10-25", kind: "mock" });
  });
  it("schedules weekly mocks, excludes exam day, and rejects past dates", () => {
    const stats = domainStats([]);
    const today = new Date("2026-10-23T00:00:00Z");
    const slots = generatePlan("2026-11-06", 2, stats, today);
    expect(slots.filter((slot) => slot.kind === "mock").map((slot) => slot.date)).toEqual(["2026-10-29", "2026-11-05"]);
    expect(slots.some((slot) => slot.date === "2026-11-06")).toBe(false);
    expect(generatePlan("2026-10-22", 2, stats, today)).toEqual([]);
  });
  it("gives the weak domain more study slots", () => {
    const s = domainStats([ans("cloud", true), ans("architecture", true), ans("management", false)]);
    const slots = generatePlan("2026-11-20", 2, s, new Date("2026-10-23T00:00:00Z"));
    const count = (d: string) => slots.filter((x) => x.domain === d).length;
    expect(count("management")).toBeGreaterThan(count("architecture"));
    expect(slots.at(-1)?.kind).toBe("mock");
  });
});

describe("assessment revision cards", () => {
  it("deduplicates repeated misses and counts only actual session insertions", () => {
    const question = QUESTIONS[0];
    if (!question) throw new Error("Question fixture is required");
    const questionIds = new Set([`q-${question.id}`]);
    const first = addQuizRevision([], question, 100);
    expect(first).toHaveLength(1);
    expect(newRevisionCount(first, new Set(), questionIds)).toBe(1);
    const repeated = addQuizRevision(first, question, 200);
    expect(repeated).toBe(first);
    expect(newRevisionCount(repeated, new Set(first.map((card) => card.id)), questionIds)).toBe(0);
  });
});
