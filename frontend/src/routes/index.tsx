import { createFileRoute, Link } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { ArrowRight, Brain, CalendarDays, Layers, MessageCircle, RotateCcw } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { domainStats, isDue, PASS_MARK, readinessScore, weakDomains } from "@/lib/logic";
import { DOMAINS, domainById } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Dashboard - Preceptor Nexus Space" },
      { name: "description", content: "Your AZ-900 readiness score, domain radar and weak areas at a glance." },
      { property: "og:title", content: "Preceptor Nexus Space - AZ-900 Readiness" },
      { property: "og:description", content: "Track AZ-900 readiness across Cloud Concepts, Architecture and Governance." },
    ],
  }),
  component: Dashboard,
});

function ScoreDial({ score }: { score: number }) {
  const r = 80, c = 2 * Math.PI * r, arc = c * 0.75;
  const pct = score / 1000;
  const passAngle = 135 + (PASS_MARK / 1000) * 270;
  const px = 100 + r * Math.cos((passAngle * Math.PI) / 180), py = 100 + r * Math.sin((passAngle * Math.PI) / 180);
  const pass = score >= PASS_MARK;
  return (
    <div className="relative mx-auto h-56 w-56">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <linearGradient id="dialg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--secondary)" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" strokeDasharray={`${arc} ${c}`} strokeLinecap="round" transform="rotate(135 100 100)" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="url(#dialg)" strokeWidth="14" strokeDasharray={`${arc * pct} ${c}`} strokeLinecap="round" transform="rotate(135 100 100)" style={{ transition: "stroke-dasharray 1s ease", filter: "drop-shadow(0 0 8px var(--primary))" }} />
        <circle cx={px} cy={py} r="5" fill="var(--warning)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">of 1000 · pass {PASS_MARK}</span>
        <span className={`mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${pass ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{pass ? "Exam ready" : "Building up"}</span>
      </div>
    </div>
  );
}

function Dashboard() {
  const { state, reset } = useStore();
  const stats = domainStats(state.answers);
  const score = readinessScore(stats);
  const weak = weakDomains(stats);
  const due = state.cards.filter((c) => isDue(c)).length;
  const radar = DOMAINS.map((d) => ({ domain: d.short, value: Math.round(stats[d.id].accuracy * 100) }));
  const noData = state.answers.length === 0;

  return (
    <>
      <PageHeader eyebrow="Readiness Tracker" title="Your Adaptive Mastery Loop" desc="Practice feeds readiness, readiness shapes your plan, mistakes become flashcards and the Buddy explains it all with local analogies." />
      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard>
          <h2 className="text-lg font-semibold">Readiness score</h2>
          <ScoreDial score={score} />
          {noData && <p className="text-center text-sm text-muted-foreground">Take a practice set to calibrate your score.</p>}
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold">Domain radar</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold">Domains</h2>
          <ul className="mt-4 space-y-4">
            {DOMAINS.map((d) => {
              const s = stats[d.id];
              const pct = Math.round(s.accuracy * 100);
              return (
                <li key={d.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground">{s.total ? `${pct}%` : "-"} · {d.range}</span>
                  </div>
                  <div role="progressbar" aria-label={`${d.name} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-gradient-brand h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {weak.map((w) => (
              <span key={w} className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs text-destructive">Weak: {domainById(w).short}</span>
            ))}
            {weak.length === 0 && <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">No weak areas</span>}
          </div>
        </GlassCard>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-semibold">Next best actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard to="/assessment" icon={Brain} title="Practice" text={weak.length ? `Drill ${domainById(weak[0]!).short}` : "Mixed practice set"} />
        <ActionCard to="/flashcards" icon={Layers} title="Revise" text={`${due} cards due today`} />
        <ActionCard to="/planner" icon={CalendarDays} title="Plan" text={state.plan.examDate ? `Exam on ${state.plan.examDate}` : "Set your exam date"} />
        <ActionCard to="/buddy" icon={MessageCircle} title="Ask Buddy" text="Cloud explained with local analogies" />
      </div>

      <GlassCard className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <button onClick={() => confirm("Reset all progress?") && reset()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" /> Reset progress
          </button>
        </div>
        {state.attempts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {state.attempts.slice(-6).reverse().map((a) => (
              <li key={a.id} className="flex justify-between py-2.5 text-sm">
                <span>{a.domain === "mixed" ? "Mixed set" : domainById(a.domain).name}</span>
                <span className="text-muted-foreground">{a.correct}/{a.total} · {new Date(a.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}

function ActionCard({ to, icon: Icon, title, text }: { to: "/assessment" | "/flashcards" | "/planner" | "/buddy"; icon: typeof Brain; title: string; text: string }) {
  return (
    <Link to={to} className="glass group rounded-2xl p-4 transition hover:-translate-y-0.5 hover:glow">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-display font-semibold">{title}</p>
      <p className="flex items-center justify-between text-sm text-muted-foreground">{text}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></p>
    </Link>
  );
}
