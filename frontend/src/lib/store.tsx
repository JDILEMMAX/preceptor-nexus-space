import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get, set } from "idb-keyval";
import type { AppState } from "./types";
import { makeSeedState } from "./data/seed";

const KEY = "pns-state-v1";

export type StorageStatus = "loading" | "saving" | "active" | "memory-only";

interface Ctx {
  state: AppState;
  ready: boolean;
  storageStatus: StorageStatus;
  update: (fn: (s: AppState) => AppState) => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => makeSeedState(0));
  const [ready, setReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const loaded = useRef(false);
  const canPersist = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    Promise.resolve().then(() => get<AppState>(KEY))
      .then((saved) => {
        canPersist.current = true;
        setState(saved ?? makeSeedState());
      })
      .catch(() => {
        // A failed read must never replace an existing blob with fallback data.
        canPersist.current = false;
        setState(makeSeedState());
        setStorageStatus("memory-only");
      })
      .finally(() => { loaded.current = true; setReady(true); });
  }, []);

  useEffect(() => {
    if (!loaded.current || !canPersist.current) return;
    let current = true;
    setStorageStatus("saving");
    // Serialize complete blobs so an older write cannot land after a newer one.
    writes.current = writes.current.then(async () => {
      try {
        await set(KEY, state);
        if (current) setStorageStatus("active");
      } catch {
        if (current) setStorageStatus("memory-only");
      }
    });
    return () => { current = false; };
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    if (loaded.current) setState(fn);
  }, []);
  const reset = useCallback(() => {
    if (loaded.current) setState(makeSeedState());
  }, []);
  const value = useMemo(() => ({ state, ready, storageStatus, update, reset }), [state, ready, storageStatus, update, reset]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
