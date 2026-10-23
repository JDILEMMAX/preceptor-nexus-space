import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { GlassCard, PageHeader } from "@/components/AppShell";
import { buddyReply, SUGGESTIONS } from "@/lib/data/metaphors";
import { uid, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/buddy")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "AI Study Buddy — Preceptor Nexus Space" },
      { name: "description", content: "Azure concepts explained through African analogies: matatus, M-Pesa, granaries and power grids." },
      { property: "og:title", content: "AZ-900 Study Buddy — African Metaphor Engine" },
      { property: "og:description", content: "Cloud infrastructure explained with familiar regional analogies." },
    ],
  }),
  component: Buddy,
});

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((p, i) => {
        const bold = p.match(/^\*\*(.+)\*\*$/);
        return bold ? <p key={i} className="font-display font-semibold text-primary">{bold[1]}</p> : <p key={i} className="mt-2">{p}</p>;
      })}
    </>
  );
}

function Buddy() {
  const { state, update } = useStore();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = chatRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [state.chat.length, thinking]);

  const ask = (q: string) => {
    const text = q.trim().slice(0, 500);
    if (!text || thinking) return;
    setInput("");
    update((s) => ({ ...s, chat: [...s.chat, { id: uid(), role: "user", text }] }));
    setThinking(true);
    setTimeout(() => {
      update((s) => ({ ...s, chat: [...s.chat, { id: uid(), role: "buddy", text: buddyReply(text) }] }));
      setThinking(false);
    }, 500);
  };

  return (
    <>
      <PageHeader eyebrow="African Metaphor Engine" title="AI Study Buddy" desc="Abstract cloud ideas, translated into things you see every day. Works fully offline." />
      <GlassCard className="flex h-[65vh] flex-col p-0 md:p-0">
        <div ref={chatRef} role="log" aria-label="Buddy conversation" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {state.chat.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="bg-gradient-brand glow flex h-14 w-14 items-center justify-center rounded-2xl"><Sparkles className="h-6 w-6 text-primary-foreground" /></span>
              <p className="mt-4 font-display text-lg font-semibold">Habari! What shall we demystify?</p>
              <p className="text-sm text-muted-foreground">Pick a suggestion below or ask your own question.</p>
            </div>
          )}
          {state.chat.map((m) => (
            <div key={m.id} className={cn("msg-in flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed", m.role === "user" ? "glass border-primary/30 bg-primary/10 text-foreground" : "glass-strong buddy-response")}>
                {m.role === "buddy" ? <Rich text={m.text} /> : m.text}
              </div>
            </div>
          ))}
          {thinking && <div className="glass-strong buddy-response w-16 animate-pulse rounded-2xl px-4 py-3 text-center">···</div>}
        </div>
        <div className="p-4 pt-2">
          <div className="suggestion-carousel mb-3 flex gap-2 overflow-x-auto px-3 pb-2">
            {SUGGESTIONS.map((s) => (
              <Button variant="ghost" key={s} onClick={() => ask(s)} className="h-auto shrink-0 rounded-full border border-glass-border bg-accent px-3 py-1.5 text-xs text-accent-foreground transition hover:glow">{s}</Button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2">
            {state.chat.length > 0 && (
              <Button variant="ghost" type="button" aria-label="Clear chat" onClick={() => update((s) => ({ ...s, chat: [] }))} className="glass flex h-11 w-11 shrink-0 p-0 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            )}
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Ask about zones, storage, queues, policy..." aria-label="Ask Buddy" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-muted/40 px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <Button variant="ghost" type="submit" aria-label="Send" className="bg-gradient-brand flex h-11 w-11 shrink-0 p-0 items-center justify-center rounded-xl text-primary-foreground"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </GlassCard>
    </>
  );
}
