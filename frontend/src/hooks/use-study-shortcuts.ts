import { useEffect } from "react";
import { handleStudyShortcut, type ShortcutActions } from "@/lib/shortcuts";

export function useStudyShortcuts(actions: ShortcutActions, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => handleStudyShortcut(event, actions);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, enabled]);
}