import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, set } from "idb-keyval";
import { makeSeedState } from "./data/seed";
import { StoreProvider, useStore } from "./store";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn() }));

function Probe() {
  const { state, ready, storageStatus, update, reset } = useStore();
  return <>
    <output aria-label="hydration">{ready ? "ready" : "loading"}</output>
    <output aria-label="storage">{storageStatus}</output>
    <output aria-label="bookmarks">{state.bookmarks.join(",")}</output>
    <output aria-label="cards">{state.cards.length}</output>
    <button onClick={() => update((s) => ({ ...s, bookmarks: [...s.bookmarks, "new"] }))}>Update</button>
    <button onClick={reset}>Reset</button>
  </>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(set).mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("IndexedDB study state", () => {
  it("waits for saved state without overwriting it with the initial seed", async () => {
    const saved = { ...makeSeedState(100), bookmarks: ["saved"] };
    let resolve: (value: typeof saved) => void = () => {};
    vi.mocked(get).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(screen.getByLabelText("hydration")).toHaveTextContent("loading");
    expect(set).not.toHaveBeenCalled();
    await act(async () => resolve(saved));
    expect(screen.getByLabelText("bookmarks")).toHaveTextContent("saved");
    expect(screen.getByLabelText("hydration")).toHaveTextContent("ready");
    await waitFor(() => expect(set).toHaveBeenCalledWith("pns-state-v1", saved));
  });

  it("hydrates a fresh deck when there is no saved blob", async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("hydration")).toHaveTextContent("ready"));
    expect(screen.getByLabelText("cards")).toHaveTextContent("15");
    expect(screen.getByLabelText("bookmarks")).toBeEmptyDOMElement();
  });

  it("falls back to a usable deck when IndexedDB cannot be read or written", async () => {
    vi.mocked(get).mockRejectedValue(new Error("storage unavailable"));
    vi.mocked(set).mockRejectedValue(new Error("storage unavailable"));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("hydration")).toHaveTextContent("ready"));
    expect(screen.getByLabelText("cards")).toHaveTextContent("15");
    act(() => screen.getByRole("button", { name: "Update" }).click());
    expect(screen.getByLabelText("bookmarks")).toHaveTextContent("new");
    expect(screen.getByLabelText("storage")).toHaveTextContent("memory-only");
    expect(set).not.toHaveBeenCalled();
  });

  it("never writes fallback state after a failed read even if writes would succeed", async () => {
    vi.mocked(get).mockRejectedValue(new Error("temporary read error"));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("hydration")).toHaveTextContent("ready"));
    act(() => screen.getByRole("button", { name: "Update" }).click());
    expect(set).not.toHaveBeenCalled();
    expect(screen.getByLabelText("storage")).toHaveTextContent("memory-only");
  });

  it("handles browser storage APIs that throw before returning a promise", async () => {
    vi.mocked(get).mockImplementation(() => { throw new Error("storage blocked"); });
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("storage")).toHaveTextContent("memory-only"));
    expect(screen.getByLabelText("hydration")).toHaveTextContent("ready");
    expect(set).not.toHaveBeenCalled();
  });

  it("reports non-durable state after a rejected write", async () => {
    vi.mocked(get).mockResolvedValue(makeSeedState(100));
    vi.mocked(set).mockRejectedValue(new Error("quota exceeded"));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("storage")).toHaveTextContent("memory-only"));
    await act(async () => screen.getByRole("button", { name: "Update" }).click());
    expect(screen.getByLabelText("bookmarks")).toHaveTextContent("new");
  });

  it("prevents mutations and resets while saved progress is loading", async () => {
    const saved = { ...makeSeedState(100), bookmarks: ["saved"] };
    let resolve: (value: typeof saved) => void = () => {};
    vi.mocked(get).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<StoreProvider><Probe /></StoreProvider>);
    act(() => screen.getByRole("button", { name: "Update" }).click());
    act(() => screen.getByRole("button", { name: "Reset" }).click());
    expect(screen.getByLabelText("bookmarks")).toBeEmptyDOMElement();
    expect(set).not.toHaveBeenCalled();
    await act(async () => resolve(saved));
    expect(screen.getByLabelText("bookmarks")).toHaveTextContent("saved");
  });

  it("persists updates and resets as a single study-state blob", async () => {
    vi.mocked(get).mockResolvedValue(makeSeedState(100));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByLabelText("hydration")).toHaveTextContent("ready"));
    act(() => screen.getByRole("button", { name: "Update" }).click());
    await waitFor(() => expect(set).toHaveBeenLastCalledWith("pns-state-v1", expect.objectContaining({ bookmarks: ["new"] })));
    act(() => screen.getByRole("button", { name: "Reset" }).click());
    await waitFor(() => expect(set).toHaveBeenLastCalledWith("pns-state-v1", expect.objectContaining({ bookmarks: [], cards: expect.any(Array) })));
    expect(screen.getByLabelText("cards")).toHaveTextContent("15");
  });
});