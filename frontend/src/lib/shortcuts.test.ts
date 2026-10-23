import { describe, expect, it, vi } from "vitest";
import { handleStudyShortcut } from "./shortcuts";

function press(key: string, actions: Record<string, () => void>, target: HTMLElement = document.body, extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
  target.addEventListener("keydown", (e) => handleStudyShortcut(e, actions), { once: true });
  target.dispatchEvent(event);
  return event;
}

describe("Study shortcuts", () => {
  it("maps Space to flashcard flip", () => {
    const flip = vi.fn();
    expect(press(" ", { " ": flip }).defaultPrevented).toBe(true);
    expect(flip).toHaveBeenCalledOnce();
  });
  it("maps 1 to Missed and 2 to Got it", () => {
    const missed = vi.fn(), gotIt = vi.fn();
    press("1", { "1": missed, "2": gotIt });
    press("2", { "1": missed, "2": gotIt });
    expect(missed).toHaveBeenCalledOnce();
    expect(gotIt).toHaveBeenCalledOnce();
  });
  it.each(["1", "2", "3", "4"])("selects assessment option %s", (key) => {
    const options = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    press(key, Object.fromEntries(options.map((fn, index) => [String(index + 1), fn])));
    options.forEach((fn, index) => expect(fn).toHaveBeenCalledTimes(String(index + 1) === key ? 1 : 0));
  });
  it("maps Enter to Next", () => {
    const next = vi.fn();
    press("Enter", { Enter: next });
    expect(next).toHaveBeenCalledOnce();
  });
  it.each(["input", "textarea", "select"])("does not intercept typing in %s", (tag) => {
    const action = vi.fn();
    expect(press("1", { "1": action }, document.createElement(tag)).defaultPrevented).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
  it("ignores editable descendants", () => {
    const editable = document.createElement("div"), child = document.createElement("span"), action = vi.fn();
    editable.contentEditable = "true";
    editable.setAttribute("contenteditable", "true");
    editable.append(child);
    press("1", { "1": action }, child);
    expect(action).not.toHaveBeenCalled();
  });
  it.each([{ repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }])("ignores repeats and modifiers %j", (extra) => {
    const action = vi.fn();
    press("1", { "1": action }, document.body, extra);
    expect(action).not.toHaveBeenCalled();
  });
  it.each([" ", "Enter"])("preserves native button activation for %s", (key) => {
    const action = vi.fn();
    expect(press(key, { [key]: action }, document.createElement("button")).defaultPrevented).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
});