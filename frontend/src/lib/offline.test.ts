import { afterEach, describe, expect, it, vi } from "vitest";
import { registerOfflineApp } from "./offline";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("offline registration safety", () => {
  it.each([
    [false, "example.com", "", false],
    [true, "id-preview--app.lovable.app", "", false],
    [true, "preview--app.lovable.app", "", false],
    [true, "example.lovableproject.com", "", false],
    [true, "lovableproject-dev.com", "", false],
    [true, "beta.lovable.dev", "", false],
    [true, "example.com", "?sw=off", false],
    [true, "example.com", "", true],
  ])("refuses unsafe registration (production=%s, host=%s, query=%s, framed=%s)", async (production, hostname, search, framed) => {
    vi.stubEnv("PROD", production);
    const unregister = vi.fn().mockResolvedValue(true);
    const otherUnregister = vi.fn();
    const register = vi.fn();
    const frame = {};
    vi.stubGlobal("window", { location: { hostname, search }, self: frame, top: framed ? {} : frame });
    vi.stubGlobal("navigator", { serviceWorker: { register, getRegistrations: vi.fn().mockResolvedValue([
      { active: { scriptURL: "https://example.com/sw.js" }, unregister },
      { active: { scriptURL: "https://example.com/firebase-messaging-sw.js" }, unregister: otherUnregister },
    ]) } });
    await registerOfflineApp();
    expect(register).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledOnce();
    expect(otherUnregister).not.toHaveBeenCalled();
  });

  it("registers and checks for updates on an unframed production site", async () => {
    vi.stubEnv("PROD", true);
    const frame = {};
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    vi.stubGlobal("window", { location: { hostname: "example.com", search: "" }, self: frame, top: frame });
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    await registerOfflineApp();
    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(update).toHaveBeenCalledOnce();
  });
});