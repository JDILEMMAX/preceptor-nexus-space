import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Check, ChevronRight, X } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppShell";
import { QUESTIONS } from "@/lib/data/questions";
import { uid, useStore } from "@/lib/store";
import { DOMAINS, domainById, type DomainId, type Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShortcutHint } from "@/components/ShortcutHint";
import { useStudyShortcuts } from "@/hooks/use-study-shortcuts";
import { celebrateStudySuccess } from "@/lib/study-events";
import { addQuizRevision, completedPracticeMilestone, newRevisionCount } from "@/lib/logic";
import {
  fetchQuestions,
  postEvaluate,
  type ApiQuestion,
  type AnswerSubmission,
  type EvaluationResult,
} from "@/lib/api";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Practice Assessment - Preceptor Nexus Space" },
      { name: "description", content: "Original AZ-900 practice questions with instant, detailed explanations." },
      { property: "og:title", content: "AZ-900 Practice Assessment" },
      { property: "og:description", content: "Topic-organised AZ-900 practice with feedback on every option." },
    ],
  }),
  component: Assessment,
});

type Pick_ = DomainId | "mixed" | "bookmarks";

function apiDomainCodeToLocal(code: string): DomainId {
  if (code === "cloud-concepts") return "cloud";
  if (code === "azure-architecture-services") return "architecture";
  return "management";
}

function localDomainToApiCode(domain: Pick_): string | undefined {
  if (domain === "cloud") return "cloud-concepts";
  if (domain === "architecture") return "azure-architecture-services";
  if (domain === "management") return "azure-management-governance";
  return undefined; // mixed - no domain filter
}

function apiToQuestion(q: ApiQuestion): Question {
  return {
    id: String(q.id),
    domain: apiDomainCodeToLocal(q.domain_code),
    topic: q.domain_code,
    prompt: q.question_text,
    options: [q.option_a, q.option_b, q.option_c, q.option_d],
    answer: -1, // server mode: answer not known client-side
    explanations: [],
  };
}

function Assessment() {
  const { state, update } = useStore();
  const [set, setSet] = useState<{ kind: Pick_; qs: Question[] } | null>(null);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [serverEval, setServerEval] = useState<EvaluationResult | null>(null);
  const finished = useRef(false);
  const initialCardIds = useRef<ReadonlySet<string>>(new Set());
  const isServerMode = useRef(false);
  const serverAnswers = useRef<AnswerSubmission[]>([]);

  const start = async (kind: Pick_) => {
    finished.current = false;
    isServerMode.current = false;
    serverAnswers.current = [];
    setServerEval(null);
    initialCardIds.current = new Set(state.cards.map((card) => card.id));

    // Try backend first; fall back to bundled questions on any error
    try {
      const domainCode = localDomainToApiCode(kind);
      const apiQs = await fetchQuestions(domainCode, kind === "mixed" ? 12 : 10);
      if (apiQs.length > 0) {
        const mapped = apiQs.map(apiToQuestion);
        isServerMode.current = true;
        setSet({ kind, qs: mapped });
        setI(0); setChosen(null); setCorrect(0);
        return;
      }
    } catch {
      // Backend unavailable - proceed with local questions below
    }

    // Offline fallback: bundled local questions
    let qs =
      kind === "mixed" ? QUESTIONS
      : kind === "bookmarks" ? QUESTIONS.filter((q) => state.bookmarks.includes(q.id))
      : QUESTIONS.filter((q) => q.domain === kind);
    qs = [...qs].sort(() => Math.random() - 0.5).slice(0, kind === "mixed" ? 12 : 10);
    if (!qs.length) return;
    setSet({ kind, qs }); setI(0); setChosen(null); setCorrect(0);
  };

  const q = set?.qs[i];
  const answered = chosen !== null;
  const bookmarked = q ? state.bookmarks.includes(q.id) : false;
  const serverMode = isServerMode.current;

  const choose = (idx: number) => {
    if (!q || answered) return;
    setChosen(idx);

    if (serverMode) {
      // Record answer for backend evaluation (no per-question feedback)
      serverAnswers.current.push({
        question_id: Number(q.id),
        chosen_option: String.fromCharCode(65 + idx), // 0->A, 1->B, 2->C, 3->D
      });
      // Still update answer history domain tracking (correct unknown, mark false)
      update((s) => ({
        ...s,
        answers: [...s.answers, { questionId: q.id, domain: q.domain, correct: false, at: Date.now() }],
      }));
    } else {
      const ok = idx === q.answer;
      if (ok) setCorrect((c) => c + 1);
      update((s) => {
        const next = { ...s, answers: [...s.answers, { questionId: q.id, domain: q.domain, correct: ok, at: Date.now() }] };
        if (!ok) next.cards = addQuizRevision(s.cards, q);
        return next;
      });
    }
  };

  const next = async () => {
    if (!set || !q || !answered || finished.current) return;
    if (i + 1 >= set.qs.length) {
      finished.current = true;
      if (!serverMode && completedPracticeMilestone(set.qs.length, i + 1)) celebrateStudySuccess();
      const final = correct;
      update((s) => ({
        ...s,
        attempts: [...s.attempts, {
          id: uid(),
          at: Date.now(),
          domain: set.kind === "bookmarks" ? "mixed" : set.kind,
          correct: final,
          total: set.qs.length,
        }],
      }));

      // Server mode: submit answers to backend for authoritative scoring
      if (serverMode && serverAnswers.current.length > 0) {
        try {
          const result = await postEvaluate(serverAnswers.current);
          setServerEval(result);
          if (result.passed) celebrateStudySuccess();
        } catch {
          // Backend evaluation failed - show local summary only
        }
      }
    }
    setI(i + 1); setChosen(null);
  };

  useStudyShortcuts({
    "1": () => choose(0), "2": () => choose(1),
    "3": () => choose(2), "4": () => choose(3),
    Enter: next,
  }, Boolean(q));

  if (!set) {
    return (
      <>
        <PageHeader eyebrow="Assessment Engine" title="Smart practice" desc="Every option comes with its reasoning. Missed questions automatically become Box 1 flashcards." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SetCard title="Mixed exam simulation" sub={`12 questions across all domains`} onClick={() => start("mixed")} featured />
          {DOMAINS.map((d) => (
            <SetCard key={d.id} title={d.name} sub={`${QUESTIONS.filter((q) => q.domain === d.id).length} questions - ${d.range} of exam`} onClick={() => start(d.id)} />
          ))}
          <SetCard title="Bookmarked" sub={`${state.bookmarks.length} saved questions`} onClick={() => start("bookmarks")} disabled={!state.bookmarks.length} />
        </div>
      </>
    );
  }

  const done = i >= set.qs.length;
  if (done) {
    const pct = serverEval
      ? Math.round(serverEval.percentage)
      : Math.round((correct / set.qs.length) * 100);
    return (
      <GlassCard className="mx-auto max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Session complete</p>
        <p className="text-gradient mt-3 font-display text-6xl font-bold">{pct}%</p>
        {serverEval ? (
          <>
            <p className="mt-2 text-muted-foreground">
              Server score: {serverEval.scaled_score}/1000 - {serverEval.passed ? "PASS" : "Not yet"}
            </p>
            <div className="mt-4 space-y-1.5 text-left text-sm">
              {serverEval.domain_breakdown.map((d) => (
                <div key={d.domain_code} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-muted-foreground">{d.domain_title}</span>
                  <span className={cn("font-medium", d.percentage >= 70 ? "text-success" : "text-warning")}>
                    {d.correct}/{d.total}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-muted-foreground">
            {correct} of {set.qs.length} correct. {newRevisionCount(state.cards, initialCardIds.current, new Set(set.qs.map((question) => `q-${question.id}`)))} new revision cards added.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="ghost" onClick={() => setSet(null)} className="glass rounded-xl px-4 py-2 text-sm">Choose another set</Button>
          <Link to="/" className="bg-gradient-brand rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground">See readiness</Link>
        </div>
      </GlassCard>
    );
  }

  if (!q) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <Button variant="ghost" onClick={() => setSet(null)} className="hover:text-foreground">Back</Button>
        <span>Question {i + 1} / {set.qs.length}</span>
        {serverMode && <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">Server mode</span>}
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-gradient-brand h-full transition-all" style={{ width: `${(i / set.qs.length) * 100}%` }} />
      </div>
      <GlassCard>
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">{domainById(q.domain).short} - {q.topic}</span>
          {!serverMode && (
            <Button variant="ghost" aria-label="Bookmark" onClick={() => update((s) => ({ ...s, bookmarks: bookmarked ? s.bookmarks.filter((b) => b !== q.id) : [...s.bookmarks, q.id] }))} className="text-muted-foreground hover:text-primary">
              {bookmarked ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
            </Button>
          )}
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-snug">{q.prompt}</h2>
        <div className="mt-5 space-y-3">
          {q.options.map((o, idx) => {
            const isRight = !serverMode && idx === q.answer;
            const isChosen = idx === chosen;
            return (
              <Button variant="ghost" key={idx} onClick={() => choose(idx)} disabled={answered}
                className={cn("h-auto w-full whitespace-normal justify-start rounded-2xl border p-4 text-left transition",
                  !answered && "border-border bg-muted/40 hover:border-primary/50 hover:bg-accent",
                  answered && !serverMode && isRight && "border-success/50 bg-success/10",
                  answered && !serverMode && isChosen && !isRight && "border-destructive/50 bg-destructive/10",
                  answered && !serverMode && !isRight && !isChosen && "border-border opacity-80",
                  answered && serverMode && isChosen && "border-primary/50 bg-primary/10",
                  answered && serverMode && !isChosen && "border-border opacity-80")}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">
                    {answered && !serverMode && isRight ? <Check className="h-3.5 w-3.5 text-success" /> : answered && !serverMode && isChosen ? <X className="h-3.5 w-3.5 text-destructive" /> : String.fromCharCode(65 + idx)}
                  </span>
                  <div>
                    <p className="font-medium">{o} <ShortcutHint>{String(idx + 1)}</ShortcutHint></p>
                    {answered && !serverMode && q.explanations[idx] && <p className="mt-1.5 text-sm text-muted-foreground">{q.explanations[idx]}</p>}
                    {answered && serverMode && isChosen && <p className="mt-1.5 text-sm text-muted-foreground">Your answer - results shown after submission.</p>}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-5 flex items-center justify-between">
            {!serverMode && (
              <p className={cn("text-sm font-medium", chosen === q.answer ? "text-success" : "text-destructive")}>
                {chosen === q.answer ? "Correct!" : "Not quite - review this in your flashcards."}
              </p>
            )}
            {serverMode && <p className="text-sm text-muted-foreground">Answer recorded.</p>}
            <Button variant="ghost" onClick={next} className="bg-gradient-brand flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground">
              {i + 1 >= set.qs.length ? "Submit" : "Next"} <ShortcutHint>Enter</ShortcutHint> <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function SetCard({ title, sub, onClick, featured, disabled }: { title: string; sub: string; onClick: () => void; featured?: boolean; disabled?: boolean }) {
  return (
    <Button variant="ghost" onClick={onClick} disabled={disabled} className={cn("glass h-auto flex-col items-start whitespace-normal rounded-3xl p-5 text-left transition hover:-translate-y-0.5 hover:glow disabled:opacity-50 disabled:hover:translate-y-0", featured && "border-primary/40")}>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <p className="mt-4 flex items-center gap-1 text-sm text-primary">Start <ChevronRight className="h-4 w-4" /></p>
    </Button>
  );
}
