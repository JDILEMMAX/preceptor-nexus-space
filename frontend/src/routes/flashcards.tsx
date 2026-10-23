import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, RotateCw, X } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { completedDueReview, isDue, LEITNER_INTERVALS_DAYS, reviewCard, reviewQueue } from "@/lib/logic";
import { domainById } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShortcutHint } from "@/components/ShortcutHint";
import { useStudyShortcuts } from "@/hooks/use-study-shortcuts";
import { celebrateStudySuccess } from "@/lib/study-events";

export const Route = createFileRoute("/flashcards")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Flashcard Coach - Preceptor Nexus Space" },
      { name: "description", content: "Leitner spaced-repetition AZ-900 flashcards built from your mistakes." },
      { property: "og:title", content: "AZ-900 Spaced-Repetition Flashcards" },
      { property: "og:description", content: "Five Leitner boxes that turn missed questions into lasting memory." },
    ],
  }),
  component: Flashcards,
});

function Flashcards() {
  const { state, update } = useStore();
  const [flipped, setFlipped] = useState(false);
  const [boxFilter, setBoxFilter] = useState<number | null>(null);
  const [reviewedIds, setReviewedIds] = useState<ReadonlySet<string>>(new Set());
  const reviewing = useRef(false);
  const session = useRef<{ dueIds: string[]; reviewedIds: Set<string>; celebrated: boolean } | null>(null);
  const now = Date.now();
  const queue = useMemo(
    () => reviewQueue(state.cards, boxFilter, reviewedIds, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.cards, boxFilter, reviewedIds],
  );
  const card = queue[0];

  const review = (knew: boolean) => {
    if (!card || reviewing.current) return;
    reviewing.current = true;
    if (!session.current) {
      session.current = { dueIds: queue.filter((c) => isDue(c)).map((c) => c.id), reviewedIds: new Set(), celebrated: false };
    }
    session.current.reviewedIds.add(card.id);
    if (!session.current.celebrated && completedDueReview(session.current.dueIds, session.current.reviewedIds)) {
      session.current.celebrated = true;
      celebrateStudySuccess();
    }
    setFlipped(false);
    setReviewedIds((ids) => new Set([...ids, card.id]));
    update((s) => ({ ...s, cards: s.cards.map((c) => (c.id === card.id ? reviewCard(c, knew) : c)) }));
    setTimeout(() => { reviewing.current = false; }, 150);
  };

  useStudyShortcuts({
    " ": () => setFlipped((value) => !value),
    "1": () => review(false), "2": () => review(true),
  }, Boolean(card));

  return (
    <>
      <PageHeader eyebrow="Leitner Coach" title="Spaced-repetition flashcards" desc="Know it and the card climbs a box and waits longer. Miss it and it drops back to Box 1." />
      <div className="mb-6 grid grid-cols-5 gap-2 md:gap-3">
        {[1, 2, 3, 4, 5].map((b) => {
          const inBox = state.cards.filter((c) => c.box === b);
          const due = inBox.filter((c) => isDue(c, now)).length;
          return (
            <Button variant="ghost" key={b} onClick={() => { session.current = null; setReviewedIds(new Set()); setBoxFilter(boxFilter === b ? null : b); setFlipped(false); }} className={cn("glass h-auto flex-col items-start gap-0 rounded-2xl p-3 text-left transition", boxFilter === b && "border-primary/60 glow")}>
              <p className="text-xs text-muted-foreground">Box {b}</p>
              <p className="font-display text-2xl font-bold">{inBox.length}</p>
              <p className="text-[11px] text-muted-foreground">{due} due · {LEITNER_INTERVALS_DAYS[b - 1]}d</p>
            </Button>
          );
        })}
      </div>

      {card ? (
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-sm text-muted-foreground">{queue.length} card{queue.length === 1 ? "" : "s"} {boxFilter ? `in Box ${boxFilter}` : "due"}</p>
          <Button variant="ghost" aria-label="Flip flashcard" aria-pressed={flipped} className="flip-scene block h-80 w-full whitespace-normal p-0 hover:bg-transparent" onClick={() => setFlipped(!flipped)}>
            <div className={cn("flip-inner relative h-full w-full", flipped && "flipped")}>
              <div aria-hidden={flipped} className="flip-face glass absolute inset-0 flex flex-col rounded-3xl p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{domainById(card.domain).short} · Box {card.box}</span>
                  <span>{card.source === "quiz" ? "From your quiz" : "Starter deck"}</span>
                </div>
                <p className="flip-copy m-auto text-center font-display text-xl font-semibold md:text-2xl">{card.front}</p>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><RotateCw className="h-3.5 w-3.5" /> Tap to flip <ShortcutHint>Space</ShortcutHint></p>
              </div>
              <div aria-hidden={!flipped} className="flip-face flip-back glass absolute inset-0 flex flex-col rounded-3xl border-primary/40 p-6">
                <p aria-hidden="true" className="flip-ghost">{card.front}</p>
                <p className="text-xs uppercase tracking-widest text-primary">Answer</p>
                <p className="flip-copy m-auto text-center text-lg">{card.back}</p>
              </div>
            </div>
          </Button>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => review(false)} className="flex h-auto items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive"><X className="h-4 w-4" /> Missed <ShortcutHint>1</ShortcutHint></Button>
            <Button variant="ghost" onClick={() => review(true)} className="flex h-auto items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-5 py-2.5 text-sm font-medium text-success"><Check className="h-4 w-4" /> Got it <ShortcutHint>2</ShortcutHint></Button>
          </div>
        </div>
      ) : (
        <GlassCard className="mx-auto max-w-xl text-center">
          <p className="font-display text-xl font-semibold">All caught up</p>
          <p className="mt-2 text-sm text-muted-foreground">No cards due right now. Tap a box above to review its cards early or take a practice set.</p>
        </GlassCard>
      )}
    </>
  );
}
