import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
import { get, set } from "idb-keyval";
import { StoreProvider } from "@/lib/store";
import { makeSeedState } from "@/lib/data/seed";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/AppShell", () => ({
  GlassCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  PageHeader: () => null,
}));

import { Route as FlashcardRoute } from "@/routes/flashcards";
import { Route as BuddyRoute } from "@/routes/buddy";
import { Route as AssessmentRoute } from "@/routes/assessment";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(set).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("study page regressions", () => {
  it.each([[1, "Missed"], [5, "Got it"]])("advances a selected box %i after a same-box review", async (box, action) => {
    const saved = makeSeedState(100);
    saved.cards = saved.cards.slice(0, 2).map((card) => ({ ...card, box: Number(box) }));
    vi.mocked(get).mockResolvedValue(saved);
    const Component = FlashcardRoute.options.component;
    if (!Component) throw new Error("Flashcard component is required");
    render(<StoreProvider><Component /></StoreProvider>);
    await waitFor(() => expect(set).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Box ${box}`) }));
    const first = saved.cards[0];
    const second = saved.cards[1];
    if (!first || !second) throw new Error("Two cards are required");
    expect(screen.getByRole("button", { name: "Flip flashcard" })).toHaveTextContent(first.front);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(String(action)) }));
    expect(screen.getByRole("button", { name: "Flip flashcard" })).toHaveTextContent(second.front);
    await act(async () => {});
  });

  it("follows Buddy messages by scrolling only the conversation viewport", async () => {
    vi.mocked(get).mockResolvedValue(makeSeedState(100));
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scroll });
    const ancestors = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: ancestors });
    const Component = BuddyRoute.options.component;
    if (!Component) throw new Error("Buddy component is required");
    render(<StoreProvider><Component /></StoreProvider>);
    await waitFor(() => expect(set).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Ask Buddy" }), { target: { value: "storage" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("storage"));
    await waitFor(() => expect(screen.queryByText("···")).not.toBeInTheDocument());
    expect(scroll.mock.instances.every((element) => element === screen.getByRole("log"))).toBe(true);
    expect(scroll).toHaveBeenCalled();
    expect(ancestors).not.toHaveBeenCalled();
  });

  it("does not insert duplicate revision cards during repeat assessment", async () => {
    const { QUESTIONS } = await import("@/lib/data/questions");
    const { addQuizRevision } = await import("@/lib/logic");
    const saved = makeSeedState(100);
    for (const question of QUESTIONS) saved.cards = addQuizRevision(saved.cards, question, 100);
    vi.mocked(get).mockResolvedValue(saved);
    const Component = AssessmentRoute.options.component;
    if (!Component) throw new Error("Assessment component is required");
    render(<StoreProvider><Component /></StoreProvider>);
    await waitFor(() => expect(set).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Cloud Concepts/ }));
    for (let index = 0; index < 8; index++) {
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "Enter" });
    }
    await waitFor(() => expect(vi.mocked(set).mock.calls.at(-1)?.[1]).toMatchObject({ cards: saved.cards }));
  });
});