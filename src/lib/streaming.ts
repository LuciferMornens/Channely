type FlushCallback = (text: string) => void;

interface Scheduler {
  schedule: (cb: () => void) => number;
  cancel: (id: number) => void;
}

function defaultScheduler(): Scheduler {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    return {
      schedule: (cb) => window.requestAnimationFrame(cb),
      cancel: (id) => window.cancelAnimationFrame(id),
    };
  }

  return {
    schedule: (cb) => globalThis.setTimeout(cb, 16),
    cancel: (id) => globalThis.clearTimeout(id),
  };
}

export interface StreamingBuffer {
  append: (chunk: string) => void;
  flush: () => void;
  reset: () => void;
  destroy: () => void;
  text: () => string;
}

export function createStreamingBuffer(
  onFlush: FlushCallback,
  scheduler: Scheduler = defaultScheduler(),
): StreamingBuffer {
  let text = "";
  let pending = "";
  let flushTask: number | null = null;

  const flushInternal = () => {
    flushTask = null;
    if (!pending) return;
    text += pending;
    pending = "";
    onFlush(text);
  };

  const scheduleFlush = () => {
    if (flushTask !== null) return;
    flushTask = scheduler.schedule(flushInternal);
  };

  return {
    append: (chunk: string) => {
      if (!chunk) return;
      pending += chunk;
      scheduleFlush();
    },
    flush: () => {
      if (flushTask !== null) {
        scheduler.cancel(flushTask);
        flushTask = null;
      }
      flushInternal();
    },
    reset: () => {
      if (flushTask !== null) {
        scheduler.cancel(flushTask);
        flushTask = null;
      }
      text = "";
      pending = "";
    },
    destroy: () => {
      if (flushTask !== null) {
        scheduler.cancel(flushTask);
        flushTask = null;
      }
    },
    text: () => text + pending,
  };
}
