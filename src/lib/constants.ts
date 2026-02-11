// App constants
export const APP_NAME = "Channely";
export const DEFAULT_HOTKEY = "Cmd+Shift+K";
export const DEFAULT_MODEL = "gpt-oss-120b";
export const DEFAULT_REASONING_EFFORT = "high";
export const DEFAULT_STYLE = "casual";
export const AI_TIMEOUT_MS = 30_000;
export const CEREBRAS_EVENTS = {
  DELTA: "cerebras:delta",
  REASONING: "cerebras:reasoning",
  RETRYING: "cerebras:retrying",
  DONE: "cerebras:done",
} as const;

export const APP_EVENTS = {
  TEXT_CAPTURED: "channely://text-captured",
  CAPTURE_ERROR: "channely://capture-error",
  CAPTURE_WARNING: "channely://capture-warning",
  OVERLAY_ACCEPT: "channely://overlay-accept",
  OVERLAY_DISMISS: "channely://overlay-dismiss",
} as const;
