import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Check, Flag } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { domainStats, generatePlan, weakDomains, type PlanSlot } from "@/lib/logic";
import { domainById } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Study Planner - Preceptor Nexus Space" },
      { name: "description", content: "A day-by-day AZ-900 study calendar weighted toward your weak domains." },
      { property: "og:title", content: "AZ-900 Personal Study Planner" },
      { property: "og:description", content: "Set your exam date and hours; get a plan that targets weak areas." },
    ],
  }),
  component: Planner,
});

function Planner() {
  const { state, update } = useStore();
  const { examDate, hoursPerDay, done } = state.plan;
  const stats = domainStats(state.answers);
  const weak = weakDomains(stats);
  const slots = useMemo(() => (examDate ? generatePlan(examDate, hoursPerDay, stats) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examDate, hoursPerDay, state.answers]);
  const byDay = useMemo(() => {
    const m = new Map<string, PlanSlot[]>();
    for (const s of slots) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m.entries()];
  }, [slots]);
  const setPlan = (p: Partial<typeof state.plan>) => update((s) => ({ ...s, plan: { ...s.plan, ...p } }));
  const toggle = (id: string) => setPlan({ done: done.includes(id) ? done.filter((d) => d !== id) : [...done, id] });
  const completed = slots.filter((s) => done.includes(s.id)).length;

  return (
    <>
      <PageHeader eyebrow="Personal Study Planner" title="Your road to exam day" desc="Study slots are weighted by official domain weight and boosted for your weak areas. Retake quizzes and the plan re-balances." />
      <GlassCard className="mb-6">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="text-sm text-muted-foreground">Target exam date</span>
            <input type="date" value={examDate ?? ""} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPlan({ examDate: e.target.value || null })}
              className="mt-1.5 w-full rounded-xl border border-input bg-muted/40 px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block">
            <span className="text-sm text-muted-foreground">Study hours per day: <b className="text-foreground">{hoursPerDay}</b></span>
            <input type="range" min={1} max={6} value={hoursPerDay} onChange={(e) => setPlan({ hoursPerDay: Number(e.target.value) })}
              style={{ "--fill": `${((hoursPerDay - 1) / 5) * 100}%` } as React.CSSProperties}
              className="slider-glass mt-4 w-full" />
          </label>
          <div>
            <span className="text-sm text-muted-foreground">Prioritised domains</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {weak.length ? weak.map((w) => <span key={w} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">{domainById(w).short}</span>) : <span className="text-sm text-success">Balanced</span>}
            </div>
          </div>
        </div>
        {slots.length > 0 && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>{completed}/{slots.length} slots done</span><span>{byDay.length} days</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="bg-gradient-brand h-full transition-all" style={{ width: `${(completed / slots.length) * 100}%` }} /></div>
          </div>
        )}
      </GlassCard>

      {!examDate ? (
        <GlassCard className="text-center text-muted-foreground">Pick your exam date to generate a plan.</GlassCard>
      ) : byDay.length === 0 ? (
        <GlassCard className="text-center text-muted-foreground">Choose a date in the future.</GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byDay.map(([date, ds]) => (
            <div key={date} className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
              <ul className="mt-2 space-y-1.5">
                {ds.map((s) => {
                  const isDone = done.includes(s.id);
                  return (
                    <li key={s.id}>
                      <Button variant="ghost" aria-pressed={isDone} onClick={() => toggle(s.id)} className={cn("flex h-auto w-full justify-start items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-accent", isDone && "opacity-60 line-through")}>
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border", isDone && "border-success bg-success/20")}>{isDone && <Check className="h-3 w-3 text-success" />}</span>
                        {s.kind === "mock" ? <span className="flex items-center gap-1 text-warning"><Flag className="h-3.5 w-3.5" /> Mock exam</span>
                          : <span>{s.kind === "review" ? "Review" : "Study"} · {s.domain ? domainById(s.domain).short : "All domains"}</span>}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
