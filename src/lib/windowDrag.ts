const NON_DRAG_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "a",
  "label",
  "[role='button']",
  "[role='switch']",
  "[role='radio']",
  "[role='tab']",
  "[contenteditable='true']",
  "[data-no-window-drag]",
  "[data-tauri-drag-region]",
].join(",");

export function shouldStartWindowDrag(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true;
  }

  return !target.closest(NON_DRAG_SELECTOR);
}
