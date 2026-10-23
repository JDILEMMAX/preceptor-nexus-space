export type ShortcutActions = Record<string, () => void>;

export function handleStudyShortcut(event: KeyboardEvent, actions: ShortcutActions) {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
  // Preserve native Space/Enter activation when a button or link has focus.
  if ((event.key === " " || event.key === "Enter") && target instanceof Element && target.closest("button, a, [role='button']")) return;
  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  action();
}