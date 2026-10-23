import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brain, CalendarDays, Cloud, Database, Gauge, Layers, MessageCircle, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { celebrateStudySuccess, STUDY_SUCCESS_EVENT } from "@/lib/study-events";
import { useStore } from "@/lib/store";
import { crossedPassingThreshold, domainStats, readinessScore } from "@/lib/logic";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchHealth } from "@/lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/assessment", label: "Assessment", icon: Brain },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/buddy", label: "AI Buddy", icon: MessageCircle },
] as const;

type CloudStatus = "checking" | "connected" | "offline";

function useBackendHealth(): CloudStatus {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const data = await fetchHealth();
        if (!cancelled) {
          setCloudStatus(data.status === "ok" ? "connected" : "offline");
        }
      } catch {
        if (!cancelled) setCloudStatus("offline");
      }
    }

    check();
    const interval = setInterval(check, 30_000);

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return cloudStatus;
}

function HealthBadge({ cloudStatus }: { cloudStatus: CloudStatus }) {
  if (cloudStatus === "checking") return null;
  const connected = cloudStatus === "connected";
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs sm:flex",
        connected
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
      aria-label={connected ? "Cloud engine connected" : "Local engine active"}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          connected ? "bg-success" : "bg-warning animate-pulse motion-reduce:animate-none",
        )}
      />
      {connected ? "Cloud Engine Connected (FastAPI + SQLite)" : "Local Engine Active (IndexedDB)"}
    </span>
  );
}

function StorageStatus({ cloudStatus }: { cloudStatus: CloudStatus }) {
  const { storageStatus } = useStore();
  const durable = storageStatus === "active";
  const memoryOnly = storageStatus === "memory-only";
  const localLabel =
    memoryOnly ? "Local Engine: Memory-only"
    : storageStatus === "loading" ? "Local Engine: Loading progress"
    : storageStatus === "saving" ? "Local Engine: Saving progress"
    : "Local Engine Active (IndexedDB)";
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);

  const cloudConnected = cloudStatus === "connected";
  const cloudLabel =
    cloudStatus === "checking" ? "Cloud Engine: Checking..."
    : cloudConnected ? "Cloud Engine Connected (FastAPI + SQLite)"
    : "Local Engine Active (IndexedDB)";

  return (
    <div className="storage-status fixed z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close storage status" : "Show storage status"}
            title={localLabel}
            data-storage={storageStatus}
            className={cn("glass storage-status-trigger h-12 w-12 rounded-full", durable ? "text-success" : memoryOnly ? "text-warning" : "text-muted-foreground")}
          >
            {open ? <X aria-hidden /> : <Database aria-hidden />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Storage status"
          className="glass-strong storage-status-panel w-[300px] max-w-[calc(100vw-24px)] rounded-xl p-4 motion-reduce:animate-none"
        >
          <div className="flex items-center gap-3 pb-3">
            <Database aria-hidden className={cn("h-4 w-4 shrink-0", durable ? "text-success" : memoryOnly ? "text-warning" : "text-muted-foreground")} />
            <span className="min-w-0 flex-1 text-xs font-medium leading-5">{localLabel}</span>
            <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", durable ? "bg-success" : memoryOnly ? "bg-warning" : "bg-muted-foreground")} />
          </div>
          <div
            title={online ? cloudLabel : "Offline - local engine remains active"}
            className="flex items-center gap-3 border-t border-border pt-3"
          >
            <Cloud aria-hidden className={cn("h-4 w-4 shrink-0", cloudConnected ? "text-success" : "text-warning")} />
            <span className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">{cloudLabel}</span>
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                cloudConnected ? "bg-success" : "bg-warning animate-pulse motion-reduce:animate-none",
              )}
            />
          </div>
          {memoryOnly && (
            <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-warning">
              Progress isn't being saved. Keep this page open; reloading may lose changes.
            </p>
          )}
        </PopoverContent>
      </Popover>
      {memoryOnly && !open && (
        <p role="alert" className="glass-strong absolute bottom-16 right-0 w-64 rounded-xl p-3 text-xs leading-5 text-warning">
          Progress isn't being saved. Keep this page open; reloading may lose changes.
        </p>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("pns-theme") === "light" ? "light" : "dark");
    } catch { /* Theme remains usable when browser storage is blocked. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    el.classList.remove("dark", "light");
    el.classList.add(theme);
    try { localStorage.setItem("pns-theme", theme); } catch { /* Use an in-memory theme. */ }
  }, [theme, hydrated]);
  return (
    <Button variant="ghost"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="glass flex h-9 w-9 items-center justify-center rounded-full transition hover:glow"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function BrandMark() {
  const [pulses, setPulses] = useState(0);
  const { state, ready } = useStore();
  const previousScore = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const score = readinessScore(domainStats(state.answers));
    if (previousScore.current !== null && crossedPassingThreshold(previousScore.current, score)) celebrateStudySuccess();
    previousScore.current = score;
  }, [ready, state.answers]);
  useEffect(() => {
    const pulse = () => setPulses((value) => value + 1);
    window.addEventListener(STUDY_SUCCESS_EVENT, pulse);
    return () => window.removeEventListener(STUDY_SUCCESS_EVENT, pulse);
  }, []);
  return (
    <span className="brand-mark h-9 w-9 shrink-0" aria-hidden>
      <span key={pulses} className={cn("brand-emblem", pulses > 0 && "brand-success")}>
        <span className="brand-orbit brand-orbit-one" />
        <span className="brand-orbit brand-orbit-two" />
        <span className="brand-core" />
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready } = useStore();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cloudStatus = useBackendHealth();

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="blob blob-1 -left-48 -top-48 h-[46rem] w-[46rem]" />
        <div className="blob blob-2 -right-48 top-1/3 h-[42rem] w-[42rem]" />
        <div className="blob blob-3 bottom-[-14rem] left-1/4 h-[38rem] w-[38rem]" />
      </div>

      <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
        <div className="glass-strong mx-auto flex max-w-7xl items-center gap-4 rounded-2xl px-4 py-2.5">
          <Link to="/" aria-label="Preceptor Nexus dashboard" className="brand-link flex shrink-0 items-center gap-2.5">
            <BrandMark />
            <span className="hidden font-display text-base font-semibold sm:block">Preceptor <span className="text-gradient">Nexus</span></span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link key={n.to} to={n.to} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <HealthBadge cloudStatus={cloudStatus} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <StorageStatus cloudStatus={cloudStatus} />

      <main aria-busy={!ready} className="mx-auto w-full max-w-7xl flex-1 px-3 pb-28 pt-6 md:px-6 md:pb-6">
        {ready ? children : <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading your saved progress...</p>}
      </main>

      <nav className="glass-strong fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl p-1.5 md:hidden">
        {NAV.map((n) => {
          const active = path === n.to;
          return (
            <Link key={n.to} to={n.to} aria-current={active ? "page" : undefined} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px]", active ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          );
        })}
      </nav>

      <footer className="mx-auto mt-auto w-full max-w-7xl px-6 pb-24 text-center text-xs text-muted-foreground md:pb-8">
        Unofficial AZ-900 practice for the #1MillionDevs movement. Not affiliated with or endorsed by Microsoft.
      </footer>
    </div>
  );
}

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-3xl p-5 md:p-6", className)}>{children}</section>;
}

export function PageHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold md:text-4xl">{title}</h1>
      {desc && <p className="mt-2 max-w-2xl text-muted-foreground">{desc}</p>}
    </div>
  );
}
